import type {
  Contest,
  ContestQuestion,
  ContestStatus,
  McqQuestion,
  CodingQuestion,
  ContestParticipant,
  McqAnswer,
  PublicContestSummary,
  AntiCheatSettings,
} from "../../types/contest";
import { hashPasscode, verifyPasscode, generateContestSlug } from "./crypto";
import { createSupabaseServerClient, createSupabaseAdminClient } from "../supabase-server";

async function getSupabaseClient() {
  return createSupabaseAdminClient() || (await createSupabaseServerClient());
}

// Fallback in-memory store for local testing and environments without Supabase credentials
const memoryStore = {
  contests: new Map<string, Contest>(),
  contestQuestions: new Map<string, ContestQuestion[]>(), // contestId -> questions
  mcqQuestions: new Map<string, McqQuestion>(),
  codingQuestions: new Map<string, CodingQuestion>(),
  participants: new Map<string, ContestParticipant[]>(), // contestId -> participants
  answers: new Map<string, McqAnswer[]>(), // `${contestId}:${userId}` -> answers
  adminAssignments: new Map<string, string[]>(), // contestId -> adminUserIds
};

/**
 * Computes authoritative server-side contest status.
 * Never trusts client clock.
 */
export function computeContestStatus(contest: {
  status: ContestStatus;
  start_at: string;
  end_at: string;
}): ContestStatus {
  if (contest.status === "DRAFT" || contest.status === "FINAL_RESULTS") {
    return contest.status;
  }

  const now = Date.now();
  const startTime = new Date(contest.start_at).getTime();
  const endTime = new Date(contest.end_at).getTime();

  if (now < startTime) {
    return "UPCOMING";
  } else if (now >= startTime && now < endTime) {
    return "LIVE";
  } else {
    return "ENDED";
  }
}

/**
 * Sanitizes question objects so students NEVER receive answer keys or hidden tests.
 */
export function sanitizeQuestionForStudent(cq: ContestQuestion): ContestQuestion {
  const sanitized = { ...cq };

  if (sanitized.mcq_details && sanitized.mcq_details.options) {
    sanitized.mcq_details = {
      ...sanitized.mcq_details,
      explanation: undefined, // Hidden during exam
      options: sanitized.mcq_details.options.map((opt) => ({
        id: opt.id,
        question_id: opt.question_id,
        option_text: opt.option_text,
        sort_order: opt.sort_order,
        // is_correct is intentionally stripped!
      })),
    };
  }

  if (sanitized.coding_details && sanitized.coding_details.test_cases) {
    sanitized.coding_details = {
      ...sanitized.coding_details,
      // Only keep public sample test cases for students
      test_cases: sanitized.coding_details.test_cases
        .filter((tc) => tc.is_sample && !tc.is_hidden)
        .map((tc) => ({
          id: tc.id,
          question_id: tc.question_id,
          input: tc.input,
          expected_output: tc.expected_output,
          is_hidden: false,
          is_sample: true,
          weight: tc.weight,
          sort_order: tc.sort_order,
        })),
    };
  }

  return sanitized;
}

// ─────────────────────────────────────────────────────────────
// CONTEST OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * In production, memory fallback is strictly prohibited to prevent split-brain state
 * across distributed serverless Lambdas.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.SMARTZERO_FORCE_MEMORY_FALLBACK !== "true";
}

export async function createContest(params: {
  title: string;
  description?: string;
  slug?: string;
  passcode?: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  instructions?: string;
  negative_marking?: boolean;
  default_negative_mark?: number;
  status?: ContestStatus;
  created_by?: string | null;
  fullscreen_required?: boolean;
  auto_submit_on_violation?: boolean;
  max_violations?: number;
  allow_retake?: boolean;
  max_attempts?: number;
  anti_cheat_settings?: AntiCheatSettings;
}): Promise<Contest> {
  const slug = params.slug?.trim() || generateContestSlug(params.title);
  const passcode = params.passcode?.trim() || "SMARTZERO";
  const passcode_hash = hashPasscode(passcode);
  const now = new Date().toISOString();

  const contest: Contest = {
    id: `contest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: params.title.trim(),
    description: params.description?.trim() || "",
    slug,
    passcode_hash,
    passcode,
    created_by: params.created_by || null,
    start_at: params.start_at,
    end_at: params.end_at,
    duration_minutes: params.duration_minutes || 60,
    status: params.status || "DRAFT",
    instructions: params.instructions || "Read instructions carefully before starting.",
    negative_marking: !!params.negative_marking,
    default_negative_mark: params.default_negative_mark || 0,
    fullscreen_required: params.fullscreen_required ?? true,
    auto_submit_on_violation: params.auto_submit_on_violation ?? true,
    max_violations: params.max_violations ?? 1,
    allow_retake: params.allow_retake ?? false,
    max_attempts: params.max_attempts ?? 1,
    anti_cheat_settings: params.anti_cheat_settings || {
      fullscreen_required: params.fullscreen_required ?? true,
      auto_submit_on_violation: params.auto_submit_on_violation ?? true,
      max_violations: params.max_violations ?? 1,
      track_tab_switch: true,
      track_blur: true,
      track_copy: true,
      track_paste: true,
      track_context_menu: true,
    },
    created_at: now,
    updated_at: now,
  };

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("contests")
        .insert({
          title: contest.title,
          description: contest.description,
          slug: contest.slug,
          passcode_hash: contest.passcode_hash,
          created_by: contest.created_by,
          start_at: contest.start_at,
          end_at: contest.end_at,
          duration_minutes: contest.duration_minutes,
          status: contest.status,
          instructions: contest.instructions,
          negative_marking: contest.negative_marking,
          default_negative_mark: contest.default_negative_mark,
          fullscreen_required: contest.fullscreen_required,
          auto_submit_on_violation: contest.auto_submit_on_violation,
          max_violations: contest.max_violations,
          allow_retake: contest.allow_retake,
          max_attempts: contest.max_attempts,
          anti_cheat_settings: contest.anti_cheat_settings,
        })
        .select()
        .single();

      if (error) {
        if (isProduction()) {
          throw new Error(`Database error creating contest: ${error.message}`);
        }
      } else if (data) {
        memoryStore.contests.set(data.id, data);
        return data;
      }
    } catch (err) {
      if (isProduction()) throw err;
      // Fall through to memory store in local dev/testing
    }
  } else if (isProduction()) {
    throw new Error("Production database unavailable: Supabase client could not be initialized. In-memory fallback is disabled in production.");
  }

  memoryStore.contests.set(contest.id, contest);
  return contest;
}

export async function getContestById(id: string): Promise<Contest | null> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from("contests").select("*").eq("id", id).maybeSingle();
      if (!error && data) {
        return {
          ...data,
          status: computeContestStatus(data),
        };
      }
    } catch {
      // Fall through
    }
  }

  const memory = memoryStore.contests.get(id);
  if (memory) {
    return {
      ...memory,
      status: computeContestStatus(memory),
    };
  }
  return null;
}

export async function getContestBySlug(slug: string): Promise<Contest | null> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.from("contests").select("*").eq("slug", slug).maybeSingle();
      if (!error && data) {
        return {
          ...data,
          status: computeContestStatus(data),
        };
      }
    } catch {
      // Fall through
    }
  }

  for (const c of memoryStore.contests.values()) {
    if (c.slug.toLowerCase() === slug.toLowerCase()) {
      return {
        ...c,
        status: computeContestStatus(c),
      };
    }
  }
  return null;
}

export async function listContests(filters?: { status?: ContestStatus }): Promise<Contest[]> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      let query = supabase.from("contests").select("*").order("created_at", { ascending: false });
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((c) => ({
          ...c,
          status: computeContestStatus(c),
        }));
      }
    } catch {
      // Fall through
    }
  }

  const list = Array.from(memoryStore.contests.values()).map((c) => ({
    ...c,
    status: computeContestStatus(c),
  }));

  if (filters?.status) {
    return list.filter((c) => c.status === filters.status);
  }
  return list;
}

export async function getContestQuestionCounts(
  contestId: string
): Promise<{ total: number; mcq: number; coding: number }> {
  // Check memoryStore first
  const memList = memoryStore.contestQuestions.get(contestId);
  if (memList && memList.length > 0) {
    const mcq = memList.filter((q) => q.question_type === "mcq").length;
    const coding = memList.filter((q) => q.question_type === "coding").length;
    return { total: memList.length, mcq, coding };
  }

  // Supabase check if available
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("contest_questions")
        .select("question_type")
        .eq("contest_id", contestId);

      if (!error && data) {
        const mcq = data.filter((q) => q.question_type === "mcq").length;
        const coding = data.filter((q) => q.question_type === "coding").length;
        return { total: data.length, mcq, coding };
      }
    } catch {
      // Fall through
    }
  }

  return { total: 0, mcq: 0, coding: 0 };
}

export async function getContestParticipantCount(contestId: string): Promise<number> {
  const memParts = memoryStore.participants.get(contestId);
  if (memParts && memParts.length > 0) {
    return memParts.length;
  }

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("contest_participants")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", contestId);

      if (!error && count !== null) return count;
    } catch {
      // Fall through
    }
  }

  return 0;
}

export async function getPublicContestSummaries(): Promise<PublicContestSummary[]> {
  const allContests = await listContests();
  // Filter out DRAFT contests for public hub
  const publishedContests = allContests.filter((c) => c.status !== "DRAFT");

  const summaries = await Promise.all(
    publishedContests.map(async (c) => {
      const counts = await getContestQuestionCounts(c.id);
      const participantCount = await getContestParticipantCount(c.id);
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description || "",
        start_at: c.start_at,
        end_at: c.end_at,
        duration_minutes: c.duration_minutes,
        status: computeContestStatus(c),
        instructions: c.instructions,
        negative_marking: c.negative_marking,
        default_negative_mark: c.default_negative_mark,
        fullscreen_required: c.fullscreen_required ?? true,
        auto_submit_on_violation: c.auto_submit_on_violation ?? true,
        max_violations: c.max_violations ?? 1,
        allow_retake: c.allow_retake ?? false,
        max_attempts: c.max_attempts ?? 1,
        question_counts: counts,
        participant_count: participantCount,
      };
    })
  );

  return summaries;
}

export async function updateContest(id: string, updates: Partial<Contest>): Promise<Contest | null> {
  const contest = await getContestById(id);
  if (!contest) return null;

  const patched = {
    ...contest,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("contests").update(updates).eq("id", id);
    } catch {
      // Fall through
    }
  }

  memoryStore.contests.set(id, patched);
  return {
    ...patched,
    status: computeContestStatus(patched),
  };
}

export async function deleteContest(
  id: string,
  options?: { force?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(id);
  if (!contest) {
    return { success: false, error: "Contest not found." };
  }

  const currentStatus = computeContestStatus(contest);

  // Safe Deletion Rule: Live contests cannot be deleted while participants are active
  if (currentStatus === "LIVE") {
    const participants = memoryStore.participants.get(id) || [];
    const hasActive = participants.some(
      (p) => p.status === "in_exam" || p.status === "in_progress" || p.status === "ready"
    );
    if (hasActive && !options?.force) {
      return {
        success: false,
        error: "Live contests cannot be deleted while participants are active.",
      };
    }
  }

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      // Cascading cleanup of dependent tables
      await supabase.from("contest_admin_assignments").delete().eq("contest_id", id);
      await supabase.from("contest_security_events").delete().eq("contest_id", id);
      await supabase.from("coding_submissions").delete().eq("contest_id", id);
      await supabase.from("mcq_answers").delete().eq("contest_id", id);
      await supabase.from("contest_participants").delete().eq("contest_id", id);
      await supabase.from("contest_questions").delete().eq("contest_id", id);
      const { error } = await supabase.from("contests").delete().eq("id", id);
      if (error && isProduction()) {
        return { success: false, error: error.message };
      }
    } catch (err) {
      if (isProduction()) {
        return { success: false, error: (err as Error).message };
      }
    }
  }

  memoryStore.contests.delete(id);
  memoryStore.contestQuestions.delete(id);
  memoryStore.participants.delete(id);
  memoryStore.adminAssignments?.delete(id);

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// QUESTION & LINKING OPERATIONS
// ─────────────────────────────────────────────────────────────

export async function addMcqQuestion(params: {
  question_text?: string;
  prompt?: string;
  explanation?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  options: { option_text: string; is_correct: boolean; sort_order?: number }[];
  created_by?: string | null;
}): Promise<McqQuestion> {
  const questionId = `mcq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const text = (params.question_text || params.prompt || "").trim();
  const q: McqQuestion = {
    id: questionId,
    question_text: text,
    explanation: params.explanation || "",
    difficulty: params.difficulty || "Medium",
    created_by: params.created_by || null,
    created_at: new Date().toISOString(),
    options: params.options.map((opt, i) => ({
      id: `opt-${questionId}-${i}`,
      question_id: questionId,
      option_text: opt.option_text.trim(),
      is_correct: opt.is_correct,
      sort_order: opt.sort_order ?? i,
    })),
  };

  memoryStore.mcqQuestions.set(q.id, q);
  return q;
}

export async function addCodingQuestion(params: {
  title: string;
  description: string;
  input_format?: string;
  output_format?: string;
  constraints?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  time_limit_ms?: number;
  memory_limit_mb?: number;
  test_cases: {
    input: string;
    expected_output: string;
    is_hidden?: boolean;
    is_sample?: boolean;
    weight?: number;
  }[];
  created_by?: string | null;
}): Promise<CodingQuestion> {
  const questionId = `code-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const q: CodingQuestion = {
    id: questionId,
    title: params.title.trim(),
    description: params.description.trim(),
    input_format: params.input_format || "",
    output_format: params.output_format || "",
    constraints: params.constraints || "",
    difficulty: params.difficulty || "Medium",
    time_limit_ms: params.time_limit_ms || 2000,
    memory_limit_mb: params.memory_limit_mb || 256,
    created_by: params.created_by || null,
    created_at: new Date().toISOString(),
    test_cases: params.test_cases.map((tc, i) => ({
      id: `tc-${questionId}-${i}`,
      question_id: questionId,
      input: tc.input,
      expected_output: tc.expected_output,
      is_hidden: tc.is_hidden ?? true,
      is_sample: tc.is_sample ?? false,
      weight: tc.weight ?? 1,
      sort_order: i,
    })),
  };

  memoryStore.codingQuestions.set(q.id, q);
  return q;
}

export async function linkQuestionToContest(params: {
  contest_id: string;
  question_id: string;
  question_type: "mcq" | "coding";
  sort_order?: number;
  marks?: number;
  negative_marks?: number;
}): Promise<ContestQuestion> {
  const cq: ContestQuestion = {
    id: `cq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    contest_id: params.contest_id,
    question_id: params.question_id,
    question_type: params.question_type,
    sort_order: params.sort_order ?? 0,
    marks: params.marks ?? 1,
    negative_marks: params.negative_marks ?? 0,
    created_at: new Date().toISOString(),
    mcq_details: params.question_type === "mcq" ? memoryStore.mcqQuestions.get(params.question_id) : undefined,
    coding_details: params.question_type === "coding" ? memoryStore.codingQuestions.get(params.question_id) : undefined,
  };

  const list = memoryStore.contestQuestions.get(params.contest_id) || [];
  list.push(cq);
  list.sort((a, b) => a.sort_order - b.sort_order);
  memoryStore.contestQuestions.set(params.contest_id, list);

  return cq;
}

export async function getContestQuestions(
  contestId: string,
  forRole: "admin" | "student" = "student"
): Promise<ContestQuestion[]> {
  const rawList = memoryStore.contestQuestions.get(contestId) || [];

  if (forRole === "student") {
    return rawList.map(sanitizeQuestionForStudent);
  }
  return rawList;
}

export async function reorderContestQuestions(
  contestId: string,
  orderedQuestionIds: string[]
): Promise<ContestQuestion[]> {
  const list = memoryStore.contestQuestions.get(contestId) || [];
  const map = new Map(list.map((q) => [q.question_id, q]));

  const reordered: ContestQuestion[] = [];
  orderedQuestionIds.forEach((qid, index) => {
    const q = map.get(qid);
    if (q) {
      q.sort_order = index;
      reordered.push(q);
    }
  });

  memoryStore.contestQuestions.set(contestId, reordered);
  return reordered;
}

export async function getCodingQuestionRaw(
  questionId: string
): Promise<CodingQuestion | null> {
  const local = memoryStore.codingQuestions.get(questionId);
  if (local) return local;

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("coding_questions")
        .select("*, test_cases:coding_test_cases(*)")
        .eq("id", questionId)
        .single();
      if (data) {
        memoryStore.codingQuestions.set(questionId, data as CodingQuestion);
        return data as CodingQuestion;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// PARTICIPANT & PASSCODE OPERATIONS
// ─────────────────────────────────────────────────────────────

export async function registerContestParticipant(params: {
  contest_id: string;
  user_id: string;
  passcode: string;
  user_profile?: ContestParticipant["user_profile"];
}): Promise<{ participant: ContestParticipant | null; error: string | null }> {
  const contest = await getContestById(params.contest_id);
  if (!contest) {
    return { participant: null, error: "Contest not found." };
  }

  // 1. Verify Passcode
  const valid = verifyPasscode(params.passcode, contest.passcode_hash);
  if (!valid) {
    return { participant: null, error: "Invalid contest passcode." };
  }

  // 2. Prevent duplicate participants
  const list = memoryStore.participants.get(params.contest_id) || [];
  const existing = list.find((p) => p.user_id === params.user_id);
  if (existing) {
    return { participant: existing, error: null };
  }

  const p: ContestParticipant = {
    id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    contest_id: params.contest_id,
    user_id: params.user_id,
    joined_at: new Date().toISOString(),
    status: "registered",
    score: 0,
    user_profile: params.user_profile,
  };

  if (isProduction()) {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return { participant: null, error: "Production database unavailable: Supabase client could not be initialized." };
    }
    try {
      const { data, error } = await supabase.from("contest_participants").insert({
        contest_id: p.contest_id,
        user_id: p.user_id,
        status: p.status,
        score: p.score,
      }).select().single();
      if (error) {
        return { participant: null, error: `Database error registering participant: ${error.message}` };
      }
      return { participant: (data as ContestParticipant) || p, error: null };
    } catch (err) {
      return { participant: null, error: (err as Error).message || "Database connection failure." };
    }
  }

  list.push(p);
  memoryStore.participants.set(params.contest_id, list);

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("contest_participants").insert({
        contest_id: p.contest_id,
        user_id: p.user_id,
        status: p.status,
        score: p.score,
      });
    } catch {
      // Ignore Supabase error in local dev
    }
  }

  return { participant: p, error: null };
}

export async function getParticipant(
  contest_id: string,
  user_id: string
): Promise<ContestParticipant | null> {
  const list = memoryStore.participants.get(contest_id) || [];
  const local = list.find((p) => p.user_id === user_id);
  if (local) return local;

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("contest_participants")
        .select("*")
        .eq("contest_id", contest_id)
        .eq("user_id", user_id)
        .single();
      if (data) {
        list.push(data as ContestParticipant);
        memoryStore.participants.set(contest_id, list);
        return data as ContestParticipant;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

export async function listParticipants(contest_id: string, forceFresh: boolean = false): Promise<ContestParticipant[]> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("contest_participants")
        .select("*, user_profile:profiles(full_name, email, student_id, college)")
        .eq("contest_id", contest_id);
      if (data && data.length > 0) {
        memoryStore.participants.set(contest_id, data as ContestParticipant[]);
        return data as ContestParticipant[];
      }
    } catch {
      // Fall through to memory store
    }
  }
  const list = memoryStore.participants.get(contest_id) || [];
  return list;
}

// ─────────────────────────────────────────────────────────────
// MCQ ANSWER / SUBMISSION OPERATIONS (Phase 6 Foundation)
// ─────────────────────────────────────────────────────────────

export async function recordMcqAnswer(params: {
  contest_id: string;
  user_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_marked_for_review?: boolean;
}): Promise<{ answer: McqAnswer | null; error: string | null }> {
  const contest = await getContestById(params.contest_id);
  if (!contest) return { answer: null, error: "Contest not found." };

  const currentStatus = computeContestStatus(contest);
  if (currentStatus === "ENDED" || currentStatus === "FINAL_RESULTS") {
    return { answer: null, error: "Contest has ended. Submissions are closed." };
  }

  const participant = await getParticipant(params.contest_id, params.user_id);
  if (participant?.status === "submitted") {
    return { answer: null, error: "Exam has already been submitted." };
  }
  if (participant && participant.status === "registered") {
    participant.status = "in_exam";
  }

  if (isProduction()) {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return { answer: null, error: "Production database unavailable: Supabase client could not be initialized." };
    }
    try {
      const { data, error } = await supabase.from("mcq_answers").upsert({
        contest_id: params.contest_id,
        user_id: params.user_id,
        question_id: params.question_id,
        selected_option_id: params.selected_option_id,
        is_marked_for_review: params.is_marked_for_review ?? false,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (error) {
        return { answer: null, error: `Database error recording answer: ${error.message}` };
      }
      return { answer: data as McqAnswer, error: null };
    } catch (err) {
      return { answer: null, error: (err as Error).message || "Database connection failure." };
    }
  }

  const key = `${params.contest_id}:${params.user_id}`;
  const list = memoryStore.answers.get(key) || [];
  const now = new Date().toISOString();

  let existing = list.find((a) => a.question_id === params.question_id);
  if (existing) {
    existing.selected_option_id = params.selected_option_id;
    if (params.is_marked_for_review !== undefined) {
      existing.is_marked_for_review = params.is_marked_for_review;
    }
    existing.updated_at = now;
  } else {
    existing = {
      id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      contest_id: params.contest_id,
      user_id: params.user_id,
      question_id: params.question_id,
      selected_option_id: params.selected_option_id,
      is_marked_for_review: params.is_marked_for_review ?? false,
      submitted_at: now,
      updated_at: now,
    };
    list.push(existing);
    memoryStore.answers.set(key, list);
  }

  // Supabase sync if configured
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("mcq_answers").upsert({
        contest_id: params.contest_id,
        user_id: params.user_id,
        question_id: params.question_id,
        selected_option_id: params.selected_option_id,
        is_marked_for_review: params.is_marked_for_review ?? false,
        updated_at: now,
      });
    } catch {
      // Fallback
    }
  }

  return { answer: existing, error: null };
}

export async function getStudentAnswers(
  contest_id: string,
  user_id: string
): Promise<McqAnswer[]> {
  const key = `${contest_id}:${user_id}`;
  const local = memoryStore.answers.get(key);
  if (local && local.length > 0) return local;

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("mcq_answers")
        .select("*")
        .eq("contest_id", contest_id)
        .eq("user_id", user_id);
      if (data && data.length > 0) {
        memoryStore.answers.set(key, data as McqAnswer[]);
        return data as McqAnswer[];
      }
    } catch {
      // Ignore
    }
  }
  return local || [];
}

/**
 * Server calculates score deterministically without exposing keys.
 */
export async function calculateStudentMcqScore(
  contest_id: string,
  user_id: string
): Promise<{ totalScore: number; answeredCount: number; correctCount: number; incorrectCount: number }> {
  const contest = await getContestById(contest_id);
  if (!contest) return { totalScore: 0, answeredCount: 0, correctCount: 0, incorrectCount: 0 };

  const questions = memoryStore.contestQuestions.get(contest_id) || [];
  const answers = memoryStore.answers.get(`${contest_id}:${user_id}`) || [];
  const answerMap = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));

  let totalScore = 0;
  let answeredCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const cq of questions) {
    if (cq.question_type !== "mcq") continue;
    const selectedOptId = answerMap.get(cq.question_id);
    if (!selectedOptId) continue;

    answeredCount++;
    const mcq = memoryStore.mcqQuestions.get(cq.question_id);
    const correctOpt = mcq?.options?.find((o) => o.is_correct);

    if (correctOpt && correctOpt.id === selectedOptId) {
      correctCount++;
      totalScore += cq.marks;
    } else {
      incorrectCount++;
      if (contest.negative_marking) {
        totalScore -= cq.negative_marks || contest.default_negative_mark || 0;
      }
    }
  }

  return { totalScore, answeredCount, correctCount, incorrectCount };
}

/**
 * Finalizes exam submission, deterministically calculates total score,
 * and updates participant status to 'submitted'.
 */
export async function submitContestExam(params: {
  contest_id: string;
  user_id: string;
  reason?: "manual" | "timeout" | "integrity_violation";
  violations_count?: number;
}): Promise<{
  success: boolean;
  participant: ContestParticipant | null;
  score: { totalScore: number; answeredCount: number; correctCount: number; incorrectCount: number } | null;
  error: string | null;
}> {
  const contest = await getContestById(params.contest_id);
  if (!contest) {
    return { success: false, participant: null, score: null, error: "Contest not found." };
  }

  if (isProduction()) {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return { success: false, participant: null, score: null, error: "Production database unavailable: Supabase client could not be initialized." };
    }
  }

  let participant = await getParticipant(params.contest_id, params.user_id);
  if (!participant) {
    // If participant didn't exist in memory yet (e.g. quick test or direct route), register them
    const regResult = await registerContestParticipant({
      contest_id: params.contest_id,
      user_id: params.user_id,
      passcode: "", // Skip if already authorized in route
    });
    participant = regResult.participant;
  }

  if (
    participant &&
    (participant.status === "submitted" ||
      participant.status === "auto_submitted" ||
      participant.status === "finalized")
  ) {
    // Already submitted — return existing score
    const existingScore = await calculateStudentMcqScore(params.contest_id, params.user_id);
    return {
      success: true,
      participant,
      score: existingScore,
      error: "Exam has already been submitted.",
    };
  }

  const scoreResult = await calculateStudentMcqScore(params.contest_id, params.user_id);
  const now = new Date().toISOString();
  const nextStatus = params.reason === "integrity_violation" ? "auto_submitted" : "submitted";

  if (participant) {
    participant.status = nextStatus;
    participant.score = scoreResult.totalScore;
    participant.completed_at = now;
    participant.submission_reason = params.reason || "manual";
    if (params.violations_count !== undefined) {
      participant.violations_count = params.violations_count;
    }
  }

  // Supabase update if available
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from("contest_participants")
        .update({
          status: nextStatus,
          score: scoreResult.totalScore,
          completed_at: now,
          submission_reason: params.reason || "manual",
          violations_count: params.violations_count || 0,
        })
        .eq("contest_id", params.contest_id)
        .eq("user_id", params.user_id);
    } catch {
      // Fallback
    }
  }

  return {
    success: true,
    participant,
    score: scoreResult,
    error: null,
  };
}

export async function startContestExam(params: {
  contest_id: string;
  user_id: string;
}): Promise<{ participant: ContestParticipant | null; error: string | null }> {
  const contest = await getContestById(params.contest_id);
  if (!contest) return { participant: null, error: "Contest not found." };

  const currentStatus = computeContestStatus(contest);
  if (currentStatus !== "LIVE") {
    return { participant: null, error: "Contest is not currently live." };
  }

  let participant = await getParticipant(params.contest_id, params.user_id);
  if (!participant) {
    return { participant: null, error: "Participant is not registered for this contest." };
  }

  if (
    participant.status === "submitted" ||
    participant.status === "auto_submitted" ||
    participant.status === "finalized"
  ) {
    return { participant, error: "Exam attempt has already been submitted." };
  }

  const now = new Date().toISOString();
  participant.status = "in_exam";
  if (!participant.started_at) {
    participant.started_at = now;
  }

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from("contest_participants")
        .update({
          status: "in_exam",
          started_at: participant.started_at,
        })
        .eq("contest_id", params.contest_id)
        .eq("user_id", params.user_id);
    } catch {
      // Fall through
    }
  }

  return { participant, error: null };
}

export async function canStartNewAttempt(
  contest_id: string,
  user_id: string
): Promise<{ can_retake: boolean; current_attempts: number; max_attempts: number; reason?: string }> {
  const contest = await getContestById(contest_id);
  if (!contest) {
    return { can_retake: false, current_attempts: 0, max_attempts: 1, reason: "Contest not found." };
  }

  if (!contest.allow_retake) {
    return {
      can_retake: false,
      current_attempts: 1,
      max_attempts: 1,
      reason: "Retakes are not permitted for this contest.",
    };
  }

  const maxAttempts = contest.max_attempts || 1;
  const participant = await getParticipant(contest_id, user_id);
  const currentAttempt = participant?.attempt_number || 1;

  if (currentAttempt >= maxAttempts) {
    return {
      can_retake: false,
      current_attempts: currentAttempt,
      max_attempts: maxAttempts,
      reason: `Maximum attempts limit reached (${currentAttempt}/${maxAttempts}).`,
    };
  }

  return {
    can_retake: true,
    current_attempts: currentAttempt,
    max_attempts: maxAttempts,
  };
}

export async function startNewAttempt(params: {
  contest_id: string;
  user_id: string;
}): Promise<{ participant: ContestParticipant | null; error: string | null }> {
  const check = await canStartNewAttempt(params.contest_id, params.user_id);
  if (!check.can_retake) {
    return { participant: null, error: check.reason || "New attempt not permitted." };
  }

  const contest = await getContestById(params.contest_id);
  if (!contest) return { participant: null, error: "Contest not found." };

  const currentStatus = computeContestStatus(contest);
  if (currentStatus !== "LIVE") {
    return { participant: null, error: "Contest is no longer live." };
  }

  // Clear previous attempt answers in memory for clean fresh attempt
  const key = `${params.contest_id}:${params.user_id}`;
  memoryStore.answers.delete(key);

  const nextAttemptNum = check.current_attempts + 1;

  let participant = await getParticipant(params.contest_id, params.user_id);
  if (participant) {
    participant.attempt_number = nextAttemptNum;
    participant.status = "ready";
    participant.score = 0;
    participant.started_at = null;
    participant.completed_at = null;
    participant.submission_reason = undefined;
    participant.violations_count = 0;
  }

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from("contest_participants")
        .update({
          attempt_number: nextAttemptNum,
          status: "ready",
          score: 0,
          started_at: null,
          completed_at: null,
          submission_reason: null,
          violations_count: 0,
        })
        .eq("contest_id", params.contest_id)
        .eq("user_id", params.user_id);
    } catch {
      // Fall through
    }
  }

  return { participant, error: null };
}

export async function assignContestAdmin(params: {
  contest_id: string;
  admin_id: string;
  assigned_by?: string | null;
}): Promise<boolean> {
  const list = memoryStore.adminAssignments.get(params.contest_id) || [];
  if (!list.includes(params.admin_id)) {
    list.push(params.admin_id);
    memoryStore.adminAssignments.set(params.contest_id, list);
  }

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("contest_admin_assignments").upsert(
        {
          contest_id: params.contest_id,
          admin_id: params.admin_id,
          assigned_by: params.assigned_by || null,
        },
        { onConflict: "contest_id,admin_id" }
      );
    } catch {
      // Fall through
    }
  }

  return true;
}

export async function removeContestAdmin(contest_id: string, admin_id: string): Promise<boolean> {
  const list = memoryStore.adminAssignments.get(contest_id) || [];
  memoryStore.adminAssignments.set(
    contest_id,
    list.filter((id) => id !== admin_id)
  );

  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from("contest_admin_assignments")
        .delete()
        .eq("contest_id", contest_id)
        .eq("admin_id", admin_id);
    } catch {
      // Fall through
    }
  }

  return true;
}

export async function getContestAdminIds(contest_id: string): Promise<string[]> {
  const list = memoryStore.adminAssignments.get(contest_id) || [];
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("contest_admin_assignments")
        .select("admin_id")
        .eq("contest_id", contest_id);
      if (data && data.length > 0) {
        return Array.from(new Set([...list, ...data.map((r: { admin_id: string }) => r.admin_id)]));
      }
    } catch {
      // Fall through
    }
  }
  return list;
}

export async function canUserManageContest(
  arg1: string | { user_id: string; user_role?: string; contest_id: string },
  arg2?: string,
  arg3?: string
): Promise<boolean> {
  let contestId: string;
  let userId: string;
  let userRole: string;

  if (typeof arg1 === "object") {
    contestId = arg1.contest_id;
    userId = arg1.user_id;
    userRole = arg1.user_role || "student";
  } else {
    contestId = arg1;
    userId = arg2 || "";
    userRole = arg3 || "student";
  }

  if (userRole === "super_admin" || userRole === "admin") {
    return true;
  }
  if (userRole === "contest_admin") {
    const contest = await getContestById(contestId);
    if (contest && contest.created_by === userId) {
      return true;
    }
    const adminIds = await getContestAdminIds(contestId);
    return adminIds.includes(userId);
  }
  return false;
}

