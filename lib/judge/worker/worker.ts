import type {
  CodingLanguage,
  CodingVerdict,
  TestCaseVerdictResult,
} from "@/types/contest";
import type {
  JudgeExecutionSummary,
  JudgeTestCase,
  JudgeWorkerJobRequest,
  JudgeWorkerJobResponse,
  SafeTestCaseResult,
} from "../types";
import type { SubmissionJob, IJudgeQueue } from "../queue/types";
import { executeInSandbox } from "../sandbox";
import { executeSqlTestCases } from "../sqlEngine";
import { judgeQueue } from "../queue/queue";
import { judgeObservability } from "../observability";
import { getCodingQuestionRaw, getSqlQuestionRaw, getContestQuestions } from "@/lib/contest/service";

/**
 * Deterministically normalizes stdout and expected output:
 * Converts CRLF to LF, strips trailing whitespace from each line,
 * and trims trailing empty lines.
 */
export function normalizeOutput(str: string): string {
  if (!str) return "";
  return str
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

export class JudgeWorker {
  private isRunning = false;
  private workerId: string;
  private queue: IJudgeQueue;
  private timer: NodeJS.Timeout | null = null;

  constructor(workerId?: string, queue: IJudgeQueue = judgeQueue) {
    this.workerId = workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
    this.queue = queue;
  }

  get id(): string {
    return this.workerId;
  }

  /**
   * Executes a suite of test cases against contestant source code.
   * Enforces zero-leakage masking of hidden test cases.
   */
  async executeTestCases(params: {
    code: string;
    language: CodingLanguage;
    testCases: JudgeTestCase[];
    timeLimitMs?: number;
    memoryLimitMb?: number;
    totalMarks?: number;
  }): Promise<JudgeExecutionSummary> {
    const timeLimitMs = params.timeLimitMs || 2000;
    const memoryLimitMb = params.memoryLimitMb || 256;
    const totalMarks = params.totalMarks !== undefined ? params.totalMarks : 20;

    const testCases = params.testCases || [];
    if (params.language === "sql") {
      return executeSqlTestCases({
        jobId: `sql-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceCode: params.code,
        testCases,
        timeLimitMs,
        totalMarks,
      });
    }

    const testCaseResults: TestCaseVerdictResult[] = [];

    let totalWeight = 0;
    let passedWeight = 0;
    let testCasesPassed = 0;
    let maxTimeMs = 0;
    let hasCompilationError = false;
    let hasRuntimeError = false;
    let hasTle = false;
    let hasSystemError = false;
    let compileMessage = "";
    let systemErrorMessage = "";

    for (const tc of testCases) {
      totalWeight += tc.weight || 1;

      const execRes = await executeInSandbox({
        code: params.code,
        language: params.language,
        input: tc.input,
        timeLimitMs,
        memoryLimitMb,
      });

      maxTimeMs = Math.max(maxTimeMs, execRes.execution_time_ms);

      let tcVerdict: CodingVerdict = execRes.verdict;

      if (execRes.verdict === "SYSTEM_ERROR" || execRes.verdict === "JUDGE_UNAVAILABLE") {
        hasSystemError = true;
        systemErrorMessage = execRes.error || "JUDGE_UNAVAILABLE";
        testCaseResults.push({
          test_case_id: tc.id,
          verdict: execRes.verdict,
          execution_time_ms: execRes.execution_time_ms,
          is_sample: tc.is_sample,
          error: execRes.error,
        });
        break; // Fail closed immediately: abort remaining test cases
      } else if (execRes.verdict === "Accepted") {
        const normalizedActual = normalizeOutput(execRes.actual_output);
        const normalizedExpected = normalizeOutput(tc.expected_output);

        if (normalizedActual === normalizedExpected) {
          tcVerdict = "Accepted";
          testCasesPassed++;
          passedWeight += tc.weight || 1;
        } else {
          tcVerdict = "Wrong Answer";
        }
      } else if (execRes.verdict === "Compilation Error") {
        hasCompilationError = true;
        compileMessage = execRes.error || "Compilation Error";
      } else if (execRes.verdict === "Runtime Error") {
        hasRuntimeError = true;
      } else if (execRes.verdict === "TLE") {
        hasTle = true;
      }

      // Build student-facing test result
      // CRITICAL SECURITY RULE: NEVER leak input/expected/actual for hidden test cases!
      const verdictItem: TestCaseVerdictResult = {
        test_case_id: tc.id,
        verdict: tcVerdict,
        execution_time_ms: execRes.execution_time_ms,
        is_sample: tc.is_sample,
      };

      if (tc.is_sample) {
        verdictItem.input = tc.input;
        verdictItem.expected_output = tc.expected_output;
        verdictItem.actual_output = execRes.actual_output;
        verdictItem.error = execRes.error;
      }

      testCaseResults.push(verdictItem);
    }

    // Weighted score calculation
    const score =
      hasSystemError
        ? 0
        : totalWeight > 0
        ? Math.round((passedWeight / totalWeight) * totalMarks)
        : 0;

    // Overall verdict determination
    let overallVerdict: CodingVerdict = "Wrong Answer";

    if (hasSystemError) {
      overallVerdict = "SYSTEM_ERROR";
      compileMessage = systemErrorMessage;
    } else if (hasCompilationError) {
      overallVerdict = "Compilation Error";
    } else if (testCasesPassed === testCases.length && testCases.length > 0) {
      overallVerdict = "Accepted";
    } else if (testCasesPassed > 0) {
      overallVerdict = "Partial Accepted";
    } else if (hasTle) {
      overallVerdict = "TLE";
    } else if (hasRuntimeError) {
      overallVerdict = "Runtime Error";
    } else {
      overallVerdict = "Wrong Answer";
    }

    return {
      verdict: overallVerdict,
      score,
      test_cases_passed: testCasesPassed,
      total_test_cases: testCases.length,
      execution_time_ms: maxTimeMs,
      memory_kb: 0,
      compile_output: compileMessage,
      test_case_results: testCaseResults,
    };
  }

  /**
   * Process a single submission job with AUTHORITATIVE database lookups.
   * Completely ignores any client-supplied test cases or limits.
   */
  async processJob(job: SubmissionJob): Promise<JudgeExecutionSummary> {
    judgeObservability.recordWorkerStart();
    const startTime = Date.now();
    const queueWaitTime = job.startedAt ? job.startedAt - job.enqueuedAt : 0;

    try {
      // 1. Authoritative Question Lookup
      let rawQuestion: {
        test_cases?: Array<{
          id: string;
          input?: string;
          setup_sql?: string;
          expected_output?: string;
          weight?: number;
          is_sample: boolean;
          is_hidden: boolean;
        }>;
        time_limit_ms: number;
        memory_limit_mb?: number;
        schema_sql?: string;
        order_sensitive?: boolean;
      } | null = null;

      if (job.language === "sql") {
        rawQuestion = await getSqlQuestionRaw(job.questionId);
      } else {
        rawQuestion = await getCodingQuestionRaw(job.questionId);
      }

      if (!rawQuestion) {
        await this.queue.updateJobStatus(job.jobId, "FAILED", {
          error: `Question ${job.questionId} not found in authoritative database.`,
        });
        judgeObservability.recordJobFailed("SYSTEM_ERROR");
        throw new Error(`Question ${job.questionId} not found.`);
      }

      // 2. Authoritative Marks Lookup from Contest Question Configuration
      const contestQuestions = await getContestQuestions(job.contestId, "admin");
      const contestQuestion = contestQuestions.find(
        (q) => q.question_id === job.questionId
      );
      const totalMarks = contestQuestion?.marks ?? 20;

      // 3. Authoritative Test Cases (both sample and hidden)
      const allTestCases: JudgeTestCase[] = (rawQuestion.test_cases || []).map(
        (tc) => ({
          id: tc.id,
          input: tc.input || tc.setup_sql || "",
          setup_sql: tc.setup_sql,
          schema_sql: rawQuestion?.schema_sql,
          sample_data_sql: (rawQuestion as { sample_data_sql?: string })?.sample_data_sql,
          order_sensitive: rawQuestion?.order_sensitive,
          expected_output: tc.expected_output || "",
          weight: tc.weight || 1,
          is_sample: tc.is_sample,
          is_hidden: tc.is_hidden,
        })
      );

      // 4. Execute in Hardened Sandbox
      const summary = await this.executeTestCases({
        code: job.code,
        language: job.language,
        testCases: allTestCases,
        timeLimitMs: rawQuestion.time_limit_ms,
        memoryLimitMb: rawQuestion.memory_limit_mb,
        totalMarks,
      });

      // 5. Update Job in Queue
      await this.queue.updateJobStatus(job.jobId, "COMPLETED", {
        result: summary,
        workerId: this.workerId,
      });

      const execDuration = Date.now() - startTime;
      judgeObservability.recordJobCompleted({
        verdict: summary.verdict,
        executionTimeMs: execDuration,
        queueWaitTimeMs: queueWaitTime,
      });

      return summary;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || "Unknown worker error";
      await this.queue.updateJobStatus(job.jobId, "SYSTEM_ERROR", {
        error: errorMsg,
        workerId: this.workerId,
      });
      judgeObservability.recordJobFailed("SYSTEM_ERROR");
      throw err;
    } finally {
      judgeObservability.recordWorkerEnd();
    }
  }

  /**
   * Deterministic Worker Job Execution implementing Section A3 Contract.
   */
  async executeJob(request: JudgeWorkerJobRequest): Promise<JudgeWorkerJobResponse> {
    if (request.language === "sql") {
      const summary = await executeSqlTestCases({
        jobId: request.job_id,
        sourceCode: request.source_code,
        testCases: request.test_cases,
        schemaSql: request.schema_sql,
        orderSensitive: request.order_sensitive,
        timeLimitMs: request.time_limit_ms,
        totalMarks: request.total_marks ?? (request.execution_mode === "run" ? 0 : 20),
        executionMode: request.execution_mode,
      });

      const safeResults: SafeTestCaseResult[] = summary.test_case_results.map((tc, idx) => {
        const item: SafeTestCaseResult = {
          index: idx + 1,
          passed: tc.verdict === "Accepted",
          verdict: tc.verdict,
          execution_time_ms: tc.execution_time_ms,
          memory_kb: tc.memory_kb,
          is_sample: tc.is_sample,
        };
        if (tc.is_sample) {
          item.input = tc.input;
          item.expected_output = tc.expected_output;
          item.actual_output = tc.actual_output;
          item.error = tc.error;
          item.columns = tc.columns;
          item.rows = tc.rows;
          item.row_count = tc.row_count;
        }
        return item;
      });

      return {
        job_id: request.job_id,
        submission_id: request.submission_id,
        status: summary.verdict === "SYSTEM_ERROR" ? "FAILED" : "COMPLETED",
        verdict: summary.verdict,
        passed_tests: summary.test_cases_passed,
        total_tests: summary.total_test_cases,
        score: request.execution_mode === "run" ? 0 : summary.score,
        max_score: request.execution_mode === "run" ? 0 : (request.total_marks ?? 20),
        execution_time_ms: summary.execution_time_ms,
        memory_used_mb: 0,
        compile_output: summary.compile_output,
        test_results: safeResults,
      };
    }

    const summary = await this.executeTestCases({
      code: request.source_code,
      language: request.language,
      testCases: request.test_cases,
      timeLimitMs: request.time_limit_ms,
      memoryLimitMb: request.memory_limit_mb,
      totalMarks: request.total_marks ?? (request.execution_mode === "run" ? 0 : 20),
    });

    const safeResults: SafeTestCaseResult[] = summary.test_case_results.map((tc, idx) => {
      const item: SafeTestCaseResult = {
        index: idx + 1,
        passed: tc.verdict === "Accepted",
        verdict: tc.verdict,
        execution_time_ms: tc.execution_time_ms,
        memory_kb: tc.memory_kb,
        is_sample: tc.is_sample,
      };
      if (tc.is_sample) {
        item.input = tc.input;
        item.expected_output = tc.expected_output;
        item.actual_output = tc.actual_output;
        item.error = tc.error;
        item.columns = tc.columns;
        item.rows = tc.rows;
        item.row_count = tc.row_count;
      }
      return item;
    });

    return {
      job_id: request.job_id,
      submission_id: request.submission_id,
      status: summary.verdict === "SYSTEM_ERROR" ? "FAILED" : "COMPLETED",
      verdict: summary.verdict,
      passed_tests: summary.test_cases_passed,
      total_tests: summary.total_test_cases,
      score: request.execution_mode === "run" ? 0 : summary.score,
      max_score: request.execution_mode === "run" ? 0 : (request.total_marks ?? 20),
      execution_time_ms: summary.execution_time_ms,
      memory_used_mb: Math.round(summary.memory_kb / 1024),
      compile_output: summary.compile_output,
      test_results: safeResults,
    };
  }

  /**
   * Dequeue and process the next pending job from the durable queue.
   */
  async processNextJob(): Promise<boolean> {
    const job = await this.queue.dequeue();
    if (!job) return false;

    try {
      await this.processJob(job);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Starts a background polling loop for the worker.
   */
  startWorker(pollIntervalMs = 500): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processNextJob();
      } catch {
        // Continue polling
      }
      if (this.isRunning) {
        this.timer = setTimeout(poll, pollIntervalMs);
      }
    };

    poll();
  }

  /**
   * Stops the background worker polling loop.
   */
  stopWorker(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const defaultJudgeWorker = new JudgeWorker();
