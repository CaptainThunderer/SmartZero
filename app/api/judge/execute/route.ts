import { NextResponse } from "next/server";
import { priorityJudgeQueue } from "@/lib/judge/queue/priorityQueue";
import { defaultJudgeWorker } from "@/lib/judge/worker/worker";
import { JUDGE_RESOURCE_LIMITS, LANGUAGE_CONFIGS } from "@/lib/judge/config";
import type { JudgeWorkerJobRequest, JudgeWorkerJobResponse, SafeTestCaseResult } from "@/lib/judge/types";
import type { CodingLanguage } from "@/types/contest";

const getExpectedWorkerSecret = () =>
  process.env.JUDGE_WORKER_SECRET || process.env.SMARTZERO_JUDGE_SECRET || "";

export async function POST(req: Request) {
  // 1. Verify Worker Authorization
  const expectedWorkerSecret = getExpectedWorkerSecret();
  if (!expectedWorkerSecret) {
    return NextResponse.json(
      { error: "JUDGE_WORKER_SECRET is not configured on this server." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const internalHeader = req.headers.get("x-smartzero-worker-secret") || "";

  if (token !== expectedWorkerSecret && internalHeader !== expectedWorkerSecret) {
    return NextResponse.json(
      { error: "Unauthorized worker request. Valid Bearer secret required." },
      { status: 401 }
    );
  }

  // 2. Parse and Validate Job Payload
  let body: Partial<JudgeWorkerJobRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
  }

  if (!body.job_id || !body.language || typeof body.source_code !== "string") {
    return NextResponse.json(
      { error: "Missing required fields: job_id, language, source_code." },
      { status: 400 }
    );
  }

  // Check language support
  const supportedLanguages: CodingLanguage[] = ["python", "javascript", "typescript", "cpp", "java"];
  if (!supportedLanguages.includes(body.language as CodingLanguage)) {
    return NextResponse.json(
      { error: `Unsupported language: ${body.language}. Supported: ${supportedLanguages.join(", ")}` },
      { status: 400 }
    );
  }

  // Check source code size limit
  const codeBytes = Buffer.byteLength(body.source_code, "utf-8");
  if (codeBytes > JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES) {
    return NextResponse.json(
      { error: `Source code exceeds maximum size limit (${JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES} bytes).` },
      { status: 400 }
    );
  }

  // Check test cases payload
  if (!Array.isArray(body.test_cases) || body.test_cases.length === 0) {
    return NextResponse.json(
      { error: "Invalid test_cases payload: array of at least 1 test case required." },
      { status: 400 }
    );
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
  };

  try {
    // 3. Enqueue and execute via PriorityQueue (Submit > Run, controlled concurrency 2-4)
    const result: JudgeWorkerJobResponse = await priorityJudgeQueue.enqueueJob(
      jobRequest,
      (reqToExec) => defaultJudgeWorker.executeJob(reqToExec)
    );

    // 4. Double ensure sanitization before returning over network
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
          }
        : {}),
    }));

    result.test_results = safeResults;

    return NextResponse.json(result);
  } catch (execErr: unknown) {
    return NextResponse.json(
      {
        job_id: jobRequest.job_id,
        status: "FAILED",
        verdict: "SYSTEM_ERROR",
        passed_tests: 0,
        total_tests: jobRequest.test_cases.length,
        score: 0,
        max_score: jobRequest.total_marks || 20,
        execution_time_ms: 0,
        memory_used_mb: 0,
        compile_output: (execErr as Error).message || "Execution error",
        test_results: [],
      },
      { status: 500 }
    );
  }
}
