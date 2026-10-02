import type {
  CodingLanguage,
  CodingSubmission,
} from "../../types/contest";
import type { JudgeRunRequest, JudgeExecutionSummary } from "./types";
import { defaultJudgeWorker, normalizeOutput } from "./worker/worker";
import { judgeQueue } from "./queue/queue";
import { judgeObservability } from "./observability";
import { createSupabaseServerClient } from "../supabase-server";

// Fallback in-memory store for submissions
const memorySubmissions = new Map<string, CodingSubmission[]>(); // contestId:userId -> submissions

/**
 * Executes code against a set of test cases with strict isolated sandbox enforcement.
 */
export async function runJudge(
  req: JudgeRunRequest
): Promise<JudgeExecutionSummary> {
  return defaultJudgeWorker.executeTestCases({
    code: req.code,
    language: req.language,
    testCases: req.test_cases || [],
    timeLimitMs: req.time_limit_ms,
    memoryLimitMb: req.memory_limit_mb,
    totalMarks: req.total_marks,
  });
}

/**
 * Saves and records student coding submission into repository and database.
 */
export async function saveCodingSubmission(params: {
  contest_id: string;
  user_id: string;
  question_id: string;
  language: CodingLanguage;
  code: string;
  summary: JudgeExecutionSummary;
}): Promise<CodingSubmission> {
  const now = new Date().toISOString();
  const sub: CodingSubmission = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    contest_id: params.contest_id,
    user_id: params.user_id,
    question_id: params.question_id,
    language: params.language,
    code: params.code,
    verdict: params.summary.verdict,
    score: params.summary.score,
    test_cases_passed: params.summary.test_cases_passed,
    total_test_cases: params.summary.total_test_cases,
    execution_time_ms: params.summary.execution_time_ms,
    memory_kb: params.summary.memory_kb,
    compile_output: params.summary.compile_output,
    test_case_results: params.summary.test_case_results,
    submitted_at: now,
  };

  if (process.env.NODE_ENV === "production" && process.env.SMARTZERO_FORCE_MEMORY_FALLBACK !== "true") {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      throw new Error(
        "Production database unavailable: Supabase client could not be initialized. In-memory fallback is disabled in production."
      );
    }
    const { data, error } = await supabase.from("coding_submissions").insert({
      contest_id: sub.contest_id,
      user_id: sub.user_id,
      question_id: sub.question_id,
      language: sub.language,
      code: sub.code,
      verdict: sub.verdict,
      score: sub.score,
      test_cases_passed: sub.test_cases_passed,
      total_test_cases: sub.total_test_cases,
      execution_time_ms: sub.execution_time_ms,
      memory_kb: sub.memory_kb,
      compile_output: sub.compile_output,
    }).select().single();
    if (error) {
      throw new Error(`Database error saving coding submission: ${error.message}`);
    }
    return (data as CodingSubmission) || sub;
  }

  const key = `${params.contest_id}:${params.user_id}`;
  const list = memorySubmissions.get(key) || [];
  list.unshift(sub); // latest first
  memorySubmissions.set(key, list);

  // Sync to Supabase if configured
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from("coding_submissions").insert({
        contest_id: sub.contest_id,
        user_id: sub.user_id,
        question_id: sub.question_id,
        language: sub.language,
        code: sub.code,
        verdict: sub.verdict,
        score: sub.score,
        test_cases_passed: sub.test_cases_passed,
        total_test_cases: sub.total_test_cases,
        execution_time_ms: sub.execution_time_ms,
        memory_kb: sub.memory_kb,
        compile_output: sub.compile_output,
      });
    } catch {
      // Ignore Supabase error in dev
    }
  }

  return sub;
}

/**
 * Retrieves contestant submission history for a contest question.
 */
export async function getStudentSubmissions(
  contest_id: string,
  user_id: string,
  question_id?: string
): Promise<CodingSubmission[]> {
  const key = `${contest_id}:${user_id}`;
  const list = memorySubmissions.get(key) || [];

  if (question_id) {
    return list.filter((s) => s.question_id === question_id);
  }
  return list;
}

export { defaultJudgeWorker, normalizeOutput, judgeQueue, judgeObservability };
export { STARTER_TEMPLATES } from "./templates";
