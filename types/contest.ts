export type ContestStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "UPCOMING"
  | "LIVE"
  | "ENDED"
  | "FINAL_RESULTS";

export type QuestionType = "mcq" | "coding" | "sql";

export type QuestionDifficulty = "Easy" | "Medium" | "Hard";

export type ParticipantStatus =
  | "registered"
  | "ready"
  | "exam_started"
  | "in_progress"
  | "in_exam"
  | "submitted"
  | "auto_submitted"
  | "finalized";

export interface AntiCheatSettings {
  fullscreen_required?: boolean;
  auto_submit_on_violation?: boolean;
  max_violations?: number;
  track_tab_switch?: boolean;
  track_blur?: boolean;
  track_copy?: boolean;
  track_paste?: boolean;
  track_context_menu?: boolean;
}

export type LeaderboardVisibility = "PUBLIC" | "ANONYMOUS";

export interface Contest {
  id: string;
  title: string;
  description: string;
  slug: string;
  passcode_hash: string;
  passcode?: string;
  created_by: string | null;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: ContestStatus;
  instructions: string;
  negative_marking: boolean;
  default_negative_mark: number;
  leaderboard_visibility?: LeaderboardVisibility;
  fullscreen_required?: boolean;
  auto_submit_on_violation?: boolean;
  max_violations?: number;
  allow_retake?: boolean;
  max_attempts?: number;
  anti_cheat_settings?: AntiCheatSettings;
  created_at: string;
  updated_at: string;
}

export interface McqOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct?: boolean; // Stripped for students
  sort_order: number;
}

export interface McqQuestion {
  id: string;
  question_text: string;
  explanation?: string;
  difficulty: QuestionDifficulty;
  created_by?: string | null;
  created_at?: string;
  options?: McqOption[];
}

export interface CodingTestCase {
  id: string;
  question_id: string;
  input: string;
  expected_output?: string; // Stripped for hidden cases to students
  is_hidden: boolean;
  is_sample: boolean;
  weight: number;
  sort_order: number;
}

export interface CodingQuestion {
  id: string;
  title: string;
  description: string;
  input_format: string;
  output_format: string;
  constraints: string;
  difficulty: QuestionDifficulty;
  time_limit_ms: number;
  memory_limit_mb: number;
  created_by?: string | null;
  created_at?: string;
  test_cases?: CodingTestCase[];
}

export interface SqlTestCase {
  id: string;
  question_id?: string;
  setup_sql?: string;
  expected_output: string;
  is_hidden: boolean;
  is_sample: boolean;
  weight: number;
  sort_order?: number;
}

export interface SqlQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: QuestionDifficulty;
  marks?: number;
  time_limit_ms: number;
  schema_sql: string;
  sample_data_sql?: string;
  sample_expected_output?: string;
  order_sensitive?: boolean;
  created_by?: string | null;
  created_at?: string;
  test_cases?: SqlTestCase[];
}

export interface ContestQuestion {
  id: string;
  contest_id: string;
  question_id: string;
  question_type: QuestionType;
  sort_order: number;
  marks: number;
  negative_marks: number;
  created_at?: string;
  // Hydrated details
  mcq_details?: McqQuestion;
  coding_details?: CodingQuestion;
  sql_details?: SqlQuestion;
}

export interface ContestParticipant {
  id: string;
  contest_id: string;
  user_id: string;
  joined_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  status: ParticipantStatus;
  score: number;
  attempt_number?: number;
  submission_reason?: "manual" | "timeout" | "timer_expiry" | "integrity_violation";
  violations_count?: number;
  user_profile?: {
    full_name: string | null;
    email: string | null;
    display_name?: string | null;
    student_id?: string | null;
    college?: string | null;
  };
}

export interface McqAnswer {
  id: string;
  contest_id: string;
  user_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_marked_for_review: boolean;
  submitted_at: string;
  updated_at: string;
}

export type CodingVerdict =
  | "Accepted"
  | "Partial Accepted"
  | "Wrong Answer"
  | "Runtime Error"
  | "Compilation Error"
  | "TLE"
  | "MLE"
  | "SYSTEM_ERROR"
  | "JUDGE_UNAVAILABLE"
  | "DRAFT";

export type CodingLanguage =
  | "python"
  | "javascript"
  | "typescript"
  | "cpp"
  | "java"
  | "sql";

export interface TestCaseVerdictResult {
  test_case_id: string;
  verdict: CodingVerdict;
  execution_time_ms: number;
  memory_kb?: number;
  is_sample: boolean;
  input?: string;          // ONLY shown if is_sample === true
  expected_output?: string;// ONLY shown if is_sample === true
  actual_output?: string;  // ONLY shown if is_sample === true
  error?: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  row_count?: number;
}

export interface CodingSubmission {
  id: string;
  contest_id: string;
  user_id: string;
  question_id: string;
  language: CodingLanguage;
  code: string;
  verdict: CodingVerdict;
  score: number;
  test_cases_passed: number;
  total_test_cases: number;
  execution_time_ms: number;
  memory_kb: number;
  compile_output?: string;
  test_case_results?: TestCaseVerdictResult[];
  submitted_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  participant_id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  email?: string | null;
  student_id?: string | null;
  college?: string | null;
  total_score: number;
  solved_count: number;
  total_questions: number;
  effective_time_seconds: number;
  formatted_time: string;
  submission_status: ParticipantStatus;
  last_activity?: string;
  violations_count?: number;
  is_current_user: boolean;
}

export type SecurityEventType =
  | "fullscreen_exit"
  | "tab_switch"
  | "window_blur"
  | "copy_attempt"
  | "paste_attempt"
  | "context_menu"
  | "devtools_open"
  | "keyboard_shortcut";

export type SecurityEventSeverity = "low" | "medium" | "high";

export interface ContestSecurityEvent {
  id: string;
  contest_id: string;
  participant_id: string;
  user_id: string;
  event_type: SecurityEventType;
  severity: SecurityEventSeverity;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PublicContestSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: ContestStatus;
  instructions?: string;
  negative_marking: boolean;
  default_negative_mark: number;
  fullscreen_required?: boolean;
  auto_submit_on_violation?: boolean;
  max_violations?: number;
  allow_retake?: boolean;
  max_attempts?: number;
  question_counts: {
    total: number;
    mcq: number;
    coding: number;
    sql?: number;
  };
  participant_count?: number;
  leaderboard_visibility?: LeaderboardVisibility;
}

