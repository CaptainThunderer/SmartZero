import type {
  CodingLanguage,
  CodingVerdict,
  TestCaseVerdictResult,
  CodingSubmission,
} from "@/types/contest";

export interface JudgeTestCase {
  id: string;
  input: string;
  expected_output: string;
  weight: number;
  is_sample: boolean;
  is_hidden: boolean;
  setup_sql?: string;
  schema_sql?: string;
  sample_data_sql?: string;
  order_sensitive?: boolean;
}

export interface JudgeRunRequest {
  code: string;
  language: CodingLanguage;
  test_cases: JudgeTestCase[];
  time_limit_ms?: number;
  memory_limit_mb?: number;
  total_marks?: number;
}

export interface SingleExecutionResult {
  verdict: CodingVerdict;
  execution_time_ms: number;
  actual_output: string;
  error?: string;
  timed_out: boolean;
}

export interface JudgeExecutionSummary {
  verdict: CodingVerdict;
  score: number;
  test_cases_passed: number;
  total_test_cases: number;
  execution_time_ms: number;
  memory_kb: number;
  compile_output?: string;
  test_case_results: TestCaseVerdictResult[];
}

/**
 * Deterministic Judge Worker Job Request Contract (Section A3)
 */
export interface JudgeWorkerJobRequest {
  job_id: string;
  submission_id: string;
  contest_id: string;
  question_id: string;
  language: CodingLanguage;
  source_code: string;
  execution_mode: "run" | "submit";
  test_cases: JudgeTestCase[];
  time_limit_ms: number;
  memory_limit_mb: number;
  total_marks?: number;
  schema_sql?: string;
  sample_data_sql?: string;
  order_sensitive?: boolean;
}

/**
 * Sanitized test case result for browser delivery.
 * CRITICAL SECURITY GUARANTEE: Never exposes hidden test input/output or worker internals.
 */
export interface SafeTestCaseResult {
  index: number;
  passed: boolean;
  verdict: CodingVerdict;
  execution_time_ms: number;
  memory_kb?: number;
  is_sample: boolean;
  input?: string;          // ONLY present if is_sample === true
  expected_output?: string;// ONLY present if is_sample === true
  actual_output?: string;  // ONLY present if is_sample === true
  error?: string;          // ONLY present if is_sample === true
  columns?: string[];      // For tabular SQL results (ONLY present if is_sample === true)
  rows?: (string | number | null)[][]; // For tabular SQL results (ONLY present if is_sample === true)
  row_count?: number;      // For tabular SQL results (ONLY present if is_sample === true)
}

/**
 * Deterministic Judge Worker Job Response Contract (Section A3)
 */
export interface JudgeWorkerJobResponse {
  job_id: string;
  submission_id: string;
  status: "COMPLETED" | "FAILED" | "TIMEOUT" | "ERROR";
  verdict: CodingVerdict;
  passed_tests: number;
  total_tests: number;
  score: number;
  max_score: number;
  execution_time_ms: number;
  memory_used_mb: number;
  compile_output?: string;
  test_results: SafeTestCaseResult[];
}

export type { CodingSubmission, TestCaseVerdictResult, CodingLanguage, CodingVerdict };
