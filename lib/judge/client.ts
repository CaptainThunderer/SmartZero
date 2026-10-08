import type {
  JudgeWorkerJobRequest,
  JudgeWorkerJobResponse,
  SafeTestCaseResult,
} from "./types";
import { getJudgeMode } from "./config";
import { defaultJudgeWorker } from "./worker/worker";
import { priorityJudgeQueue } from "./queue/priorityQueue";

export class JudgeUnavailableError extends Error {
  readonly code = "JUDGE_UNAVAILABLE";
  constructor(message = "The coding judge is temporarily unavailable. Please try again.") {
    super(message);
    this.name = "JudgeUnavailableError";
  }
}

export type JudgeWorkerTransport = (
  req: JudgeWorkerJobRequest
) => Promise<JudgeWorkerJobResponse>;

/**
 * Clean adapter for decoupled Judge execution.
 *
 * Execution Policy:
 * 1. LOCAL MODE (SMARTZERO_JUDGE_MODE=local):
 *    Executes via HardenedSubprocessSandbox on host machine without Docker.
 *    Managed via PriorityJudgeQueue with controlled concurrency (default: 3 workers)
 *    and strict priority scheduling (Submit > Run).
 *
 * 2. PRODUCTION MODE (SMARTZERO_JUDGE_MODE=production):
 *    Strictly FORBIDS host child_process execution.
 *    Delegates execution to configured dedicated judge worker (HTTP / Redis queue).
 *    Authenticates with Bearer <JUDGE_WORKER_SECRET>.
 *    If dedicated worker is unavailable or unconfigured, FAILS CLOSED with HTTP 503 JUDGE_UNAVAILABLE.
 */
export class JudgeWorkerClient {
  private customTransport: JudgeWorkerTransport | null = null;

  /**
   * Register a custom worker transport (primarily for testing and mock workers).
   */
  setCustomTransport(transport: JudgeWorkerTransport | null): void {
    this.customTransport = transport;
  }

  /**
   * Executes a judge job adhering to strict environment isolation boundaries.
   */
  async executeJob(request: JudgeWorkerJobRequest): Promise<JudgeWorkerJobResponse> {
    const mode = getJudgeMode();

    // A. Custom transport (if registered for test suite or mock worker)
    if (this.customTransport) {
      try {
        const response = await this.customTransport(request);
        // Ensure hidden test cases in worker response are sanitized
        response.test_results = response.test_results.map((r, idx) => {
          const item: SafeTestCaseResult = {
            index: r.index || idx + 1,
            passed: r.passed,
            verdict: r.verdict,
            execution_time_ms: r.execution_time_ms,
            memory_kb: r.memory_kb,
            is_sample: r.is_sample,
          };
          if (r.is_sample) {
            item.input = r.input;
            item.expected_output = r.expected_output;
            item.actual_output = r.actual_output;
            item.error = r.error;
            item.columns = r.columns;
            item.rows = r.rows;
            item.row_count = r.row_count;
          }
          return item;
        });
        return response;
      } catch (err: unknown) {
        if (err instanceof JudgeUnavailableError) throw err;
        throw new JudgeUnavailableError(
          request.execution_mode === "run"
            ? "Code execution service is temporarily unavailable."
            : "Judge service is temporarily unavailable. Your submission was not scored. Please try again."
        );
      }
    }

    // B. External dedicated worker URL
    const workerUrl =
      process.env.JUDGE_WORKER_URL || process.env.SMARTZERO_JUDGE_WORKER_URL;

    if (workerUrl) {
      const controller = new AbortController();
      const timeoutMs = (request.time_limit_ms || 2000) * (request.test_cases.length || 1) + 5000;
      const timeoutId = setTimeout(() => controller.abort(), Math.min(timeoutMs, 15000));
      const workerSecret =
        process.env.JUDGE_WORKER_SECRET ||
        process.env.SMARTZERO_JUDGE_SECRET;

      if (!workerSecret) {
        throw new JudgeUnavailableError(
          "JUDGE_WORKER_SECRET is not configured for remote judge execution."
        );
      }

      try {
        const res = await fetch(`${workerUrl.replace(/\/$/, "")}/api/judge/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${workerSecret}`,
            "x-smartzero-internal": "true",
            "x-smartzero-worker-secret": workerSecret,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new JudgeUnavailableError(
            request.execution_mode === "run"
              ? "Code execution service is temporarily unavailable."
              : "Judge service is temporarily unavailable. Your submission was not scored. Please try again."
          );
        }

        const data: JudgeWorkerJobResponse = await res.json();
        // Sanitize test results
        data.test_results = data.test_results.map((r, idx) => ({
          index: r.index || idx + 1,
          passed: r.passed,
          verdict: r.verdict,
          execution_time_ms: r.execution_time_ms,
          memory_kb: r.memory_kb,
          is_sample: r.is_sample,
          ...(r.is_sample
            ? {
                input: r.input,
                expected_output: r.expected_output,
                actual_output: r.actual_output,
                error: r.error,
                columns: r.columns,
                rows: r.rows,
                row_count: r.row_count,
              }
            : {}),
        }));

        return data;
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        console.error("[JudgeWorkerClient] Worker communication failure:", fetchErr);
        throw new JudgeUnavailableError(
          request.execution_mode === "run"
            ? "Code execution service is temporarily unavailable."
            : "Judge service is temporarily unavailable. Your submission was not scored. Please try again."
        );
      }
    }

    // C. Local development fallback (when mode === "local" and no dedicated worker is set)
    if (mode === "local") {
      return priorityJudgeQueue.enqueueJob(request, (req) =>
        defaultJudgeWorker.executeJob(req)
      );
    }

    // D. In production with no worker configured -> Fail-closed 503 (zero host execution)
    throw new JudgeUnavailableError(
      request.execution_mode === "run"
        ? "Code execution service is temporarily unavailable."
        : "Judge service is temporarily unavailable. Your submission was not scored. Please try again."
    );
  }

  /**
   * Pings remote worker health endpoint (GET /health)
   */
  async pingWorkerHealth(targetUrl?: string): Promise<{ ok: boolean; status?: string; latencyMs: number }> {
    const workerUrl = targetUrl || process.env.JUDGE_WORKER_URL || process.env.SMARTZERO_JUDGE_WORKER_URL;
    if (!workerUrl) return { ok: false, latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(`${workerUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Date.now() - start;
      if (!res.ok) return { ok: false, latencyMs };
      const data = await res.json();
      return { ok: data.status === "ok", status: data.status, latencyMs };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Pings remote worker readiness endpoint (GET /ready)
   */
  async pingWorkerReady(targetUrl?: string): Promise<{ ok: boolean; ready?: boolean; runtimes?: string[]; concurrency?: number }> {
    const workerUrl = targetUrl || process.env.JUDGE_WORKER_URL || process.env.SMARTZERO_JUDGE_WORKER_URL;
    if (!workerUrl) return { ok: false };
    try {
      const res = await fetch(`${workerUrl.replace(/\/$/, "")}/ready`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: true, ready: !!data.ready, runtimes: data.runtimes, concurrency: data.concurrency };
    } catch {
      return { ok: false };
    }
  }
}

export const judgeWorkerClient = new JudgeWorkerClient();
