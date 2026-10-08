import http from "node:http";
import { defaultJudgeWorker } from "../../lib/judge/worker/worker";
import { priorityJudgeQueue } from "../../lib/judge/queue/priorityQueue";
import { JUDGE_RESOURCE_LIMITS } from "../../lib/judge/config";
import type { JudgeWorkerJobRequest, JudgeWorkerJobResponse, SafeTestCaseResult } from "../../lib/judge/types";
import type { CodingLanguage } from "../../types/contest";

const PORT = parseInt(process.env.PORT || "8080", 10);
// The dedicated judge worker operates inside an isolated container boundary (Docker/gVisor).
process.env.SMARTZERO_CONTAINER_WORKER = "true";

const getExpectedSecret = () =>
  process.env.JUDGE_WORKER_SECRET ||
  process.env.SMARTZERO_JUDGE_SECRET ||
  "";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const method = req.method || "GET";

  // Helper: JSON response
  const json = (statusCode: number, data: unknown) => {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-smartzero-internal",
    });
    res.end(JSON.stringify(data));
  };

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-smartzero-internal",
    });
    res.end();
    return;
  }

  // 1. Health Probe (GET /health)
  if (method === "GET" && (url.pathname === "/health" || url.pathname === "/api/judge/health")) {
    return json(200, {
      status: "ok",
      worker: "smartzero-judge",
      uptime_seconds: Math.floor(process.uptime()),
    });
  }

  // 2. Readiness Probe (GET /ready)
  if (method === "GET" && (url.pathname === "/ready" || url.pathname === "/api/judge/ready")) {
    return json(200, {
      status: "ok",
      ready: true,
      worker: "smartzero-judge",
      runtimes: ["python", "javascript", "typescript", "cpp", "java", "sql"],
      concurrency: priorityJudgeQueue.getConcurrency(),
      memory_mb: 512,
    });
  }

  // 3. Authenticated Execution Endpoint (POST /api/judge/execute)
  if (method === "POST" && (url.pathname === "/api/judge/execute" || url.pathname === "/execute")) {
    const authHeader = req.headers["authorization"] || "";
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const internalHeader = req.headers["x-smartzero-worker-secret"] || req.headers["x-smartzero-internal"];

    const expectedSecret = getExpectedSecret();
    if (!expectedSecret) {
      return json(500, {
        error: "JUDGE_WORKER_SECRET is not configured on this worker.",
      });
    }

    if (token !== expectedSecret && internalHeader !== expectedSecret) {
      return json(401, {
        error: "Unauthorized worker request. Valid Bearer secret required.",
      });
    }

    // Read body
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf-8");
        const body: Partial<JudgeWorkerJobRequest> = JSON.parse(rawBody);

        if (!body.job_id || !body.language || typeof body.source_code !== "string") {
          return json(400, {
            error: "Missing required fields: job_id, language, source_code.",
          });
        }

        const supportedLanguages: CodingLanguage[] = ["python", "javascript", "typescript", "cpp", "java", "sql"];
        if (!supportedLanguages.includes(body.language as CodingLanguage)) {
          return json(400, {
            error: `Unsupported language: ${body.language}. Supported: ${supportedLanguages.join(", ")}`,
          });
        }

        const codeBytes = Buffer.byteLength(body.source_code, "utf-8");
        if (codeBytes > JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES) {
          return json(400, {
            error: `Source code exceeds limit (${JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES} bytes).`,
          });
        }

        if (!Array.isArray(body.test_cases) || body.test_cases.length === 0) {
          return json(400, {
            error: "Invalid test_cases payload: array of at least 1 test case required.",
          });
        }

        const jobRequest: JudgeWorkerJobRequest = {
          job_id: body.job_id,
          submission_id: body.submission_id || body.job_id,
          contest_id: body.contest_id || "contest-default",
          question_id: body.question_id || "question-default",
          language: body.language as CodingLanguage,
          source_code: body.source_code,
          execution_mode: body.execution_mode === "submit" ? "submit" : "run",
          test_cases: body.test_cases,
          time_limit_ms: Math.min(body.time_limit_ms || 2000, JUDGE_RESOURCE_LIMITS.MAX_TIME_LIMIT_MS),
          memory_limit_mb: Math.min(body.memory_limit_mb || 256, JUDGE_RESOURCE_LIMITS.MAX_MEMORY_LIMIT_MB),
          total_marks: body.total_marks,
          schema_sql: body.schema_sql,
          order_sensitive: body.order_sensitive,
        };

        const result: JudgeWorkerJobResponse = await priorityJudgeQueue.enqueueJob(
          jobRequest,
          (reqToExec) => defaultJudgeWorker.executeJob(reqToExec)
        );

        // Guarantee hidden test sanitization
        const safeResults: SafeTestCaseResult[] = (result.test_results || []).map((tr, idx) => ({
          index: tr.index || idx + 1,
          passed: tr.passed,
          verdict: tr.verdict,
          execution_time_ms: tr.execution_time_ms,
          memory_kb: tr.memory_kb,
          is_sample: tr.is_sample,
          ...(tr.is_sample
            ? {
                input: tr.input,
                expected_output: tr.expected_output,
                actual_output: tr.actual_output,
                error: tr.error,
                columns: tr.columns,
                rows: tr.rows,
                row_count: tr.row_count,
              }
            : {}),
        }));

        result.test_results = safeResults;
        return json(200, result);
      } catch (err: unknown) {
        return json(500, {
          error: (err as Error).message || "Internal judge worker error",
        });
      }
    });
    return;
  }

  // Not found
  return json(404, { error: `Endpoint not found: ${method} ${url.pathname}` });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[SmartZero Judge Worker] Server listening on port ${PORT}`);
  console.log(`[SmartZero Judge Worker] Health: http://0.0.0.0:${PORT}/health`);
  console.log(`[SmartZero Judge Worker] Ready:  http://0.0.0.0:${PORT}/ready`);
  console.log(`[SmartZero Judge Worker] Concurrency: ${priorityJudgeQueue.getConcurrency()} workers`);
});

export { server };
