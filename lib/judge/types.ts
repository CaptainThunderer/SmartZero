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

export type { CodingSubmission, TestCaseVerdictResult, CodingLanguage, CodingVerdict };
