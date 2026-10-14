import type { LeaderboardEntry } from "@/types/contest";
import {
  getContestById,
  listParticipants,
  getContestQuestions,
} from "./service";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

// ── In-Flight Request Deduplication & Short-Lived TTL Cache ──
interface CachedLeaderboardRaw {
  timestamp: number;
  entries: {
    rawEntry: Omit<LeaderboardEntry, "rank" | "display_name" | "is_current_user"> & { full_name?: string };
    latestTimestamp: number;
  }[];
  totalQuestions: number;
  contestStartTime: number;
}

const LEADERBOARD_CACHE_TTL_MS = 2500; // 2.5 seconds cache
const leaderboardCache = new Map<string, CachedLeaderboardRaw>();
const inFlightLeaderboards = new Map<string, Promise<CachedLeaderboardRaw>>();

export function invalidateLeaderboardCache(contestId?: string): void {
  if (contestId) {
    leaderboardCache.delete(contestId);
  } else {
    leaderboardCache.clear();
  }
}

/**
 * Computes raw unprojected leaderboard using batch database reads.
 * Executes exactly 2-3 queries total instead of O(N) sequential queries.
 */
async function computeLeaderboardRaw(contestId: string): Promise<CachedLeaderboardRaw> {
  const contest = await getContestById(contestId);
  if (!contest) {
    return {
      timestamp: Date.now(),
      entries: [],
      totalQuestions: 0,
      contestStartTime: 0,
    };
  }

  const participants = await listParticipants(contestId);
  const questions = await getContestQuestions(contestId, "admin");
  const totalQuestions = questions.length;
  const contestStartTime = new Date(contest.start_at).getTime();

  const supabase = createSupabaseAdminClient() || (await createSupabaseServerClient());

  let allAnswers: Array<{
    user_id: string;
    question_id: string;
    selected_option_id: string | null;
    updated_at?: string;
    submitted_at?: string;
  }> = [];

  let allCodingSubs: Array<{
    user_id: string;
    question_id: string;
    score: number;
    verdict: string;
    submitted_at: string;
  }> = [];

  if (supabase) {
    try {
      const [answersRes, codingRes] = await Promise.all([
        supabase
          .from("mcq_answers")
          .select("user_id, question_id, selected_option_id, updated_at, submitted_at")
          .eq("contest_id", contestId),
        supabase
          .from("coding_submissions")
          .select("user_id, question_id, score, verdict, submitted_at")
          .eq("contest_id", contestId)
          .neq("verdict", "DRAFT"),
      ]);

      if (answersRes.data) {
        allAnswers = answersRes.data as typeof allAnswers;
      }
      if (codingRes.data) {
        allCodingSubs = codingRes.data as typeof allCodingSubs;
      }
    } catch (err) {
      console.error("[Leaderboard] Error during batch fetch, falling back to local memory store:", err);
    }
  }

  // Fallback to memoryStore for local dev / tests if Supabase data empty
  if (allAnswers.length === 0 || allCodingSubs.length === 0) {
    try {
      const { memoryStore } = await import("./service");
      const { memorySubmissions } = await import("@/lib/judge/service");

      if (allAnswers.length === 0) {
        for (const [key, ansList] of memoryStore.answers.entries()) {
          if (key.startsWith(`${contestId}:`)) {
            for (const a of ansList) {
              allAnswers.push(a);
            }
          }
        }
      }

      if (allCodingSubs.length === 0) {
        for (const [key, subList] of memorySubmissions.entries()) {
          if (key.startsWith(`${contestId}:`)) {
            for (const s of subList) {
              if (s.verdict !== "DRAFT") {
                allCodingSubs.push({
                  user_id: s.user_id,
                  question_id: s.question_id,
                  score: s.score,
                  verdict: s.verdict,
                  submitted_at: s.submitted_at,
                });
              }
            }
          }
        }
      }
    } catch {
      // In-memory fallback optional
    }
  }

  // Index answers by user_id
  const answersByUser = new Map<string, typeof allAnswers>();
  for (const ans of allAnswers) {
    let list = answersByUser.get(ans.user_id);
    if (!list) {
      list = [];
      answersByUser.set(ans.user_id, list);
    }
    list.push(ans);
  }

  // Index coding submissions by user_id
  const codingSubsByUser = new Map<string, typeof allCodingSubs>();
  for (const sub of allCodingSubs) {
    let list = codingSubsByUser.get(sub.user_id);
    if (!list) {
      list = [];
      codingSubsByUser.set(sub.user_id, list);
    }
    list.push(sub);
  }

  // Index MCQ question metadata
  interface McqMeta {
    marks: number;
    negative_marks: number;
    correct_option_id: string | null;
  }
  const mcqMetaMap = new Map<string, McqMeta>();
  for (const q of questions) {
    if (q.question_type === "mcq") {
      const options = q.options || q.mcq_details?.options || [];
      const correctOpt = options.find((o: any) => o.is_correct);
      mcqMetaMap.set(q.question_id, {
        marks: Number(q.marks ?? 1),
        negative_marks: Number(q.negative_marks || contest.default_negative_mark || 0),
        correct_option_id: correctOpt?.id || null,
      });
    }
  }

  interface RawSortable {
    rawEntry: Omit<LeaderboardEntry, "rank" | "display_name" | "is_current_user"> & { full_name?: string };
    latestTimestamp: number;
  }
  const rawEntries: RawSortable[] = [];

  for (const p of participants) {
    // 1. MCQ Score calculation
    const userAnswers = answersByUser.get(p.user_id) || [];
    let mcqTotalScore = 0;
    let mcqCorrectCount = 0;
    let latestSubmissionTime = new Date(p.joined_at).getTime();

    for (const ans of userAnswers) {
      const ansTimeStr = ans.updated_at || ans.submitted_at;
      if (ansTimeStr) {
        const t = new Date(ansTimeStr).getTime();
        if (t > latestSubmissionTime) {
          latestSubmissionTime = t;
        }
      }

      const meta = mcqMetaMap.get(ans.question_id);
      if (meta && ans.selected_option_id) {
        if (meta.correct_option_id && ans.selected_option_id === meta.correct_option_id) {
          mcqCorrectCount++;
          mcqTotalScore += meta.marks;
        } else if (contest.negative_marking) {
          mcqTotalScore -= meta.negative_marks;
        }
      }
    }
    mcqTotalScore = Math.max(0, mcqTotalScore);

    // 2. Coding Score calculation (highest score per question)
    const userSubs = codingSubsByUser.get(p.user_id) || [];
    const bestCodingScores = new Map<string, { score: number; verdict: string; time: string }>();

    for (const sub of userSubs) {
      const existing = bestCodingScores.get(sub.question_id);
      if (!existing || sub.score > existing.score) {
        bestCodingScores.set(sub.question_id, {
          score: sub.score,
          verdict: sub.verdict,
          time: sub.submitted_at,
        });
      }
    }

    let codingTotal = 0;
    let codingSolved = 0;

    for (const item of bestCodingScores.values()) {
      codingTotal += item.score;
      if (item.verdict === "Accepted" || item.score > 0) {
        codingSolved++;
      }
      const t = new Date(item.time).getTime();
      if (t > latestSubmissionTime) {
        latestSubmissionTime = t;
      }
    }

    const totalScore = mcqTotalScore + codingTotal;
    const solvedCount = mcqCorrectCount + codingSolved;

    const effectiveTimeSec = Math.max(
      0,
      Math.floor((latestSubmissionTime - contestStartTime) / 1000)
    );

    const m = Math.floor(effectiveTimeSec / 60);
    const s = effectiveTimeSec % 60;
    const formattedTime = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

    const rawItem: Omit<LeaderboardEntry, "rank" | "display_name" | "is_current_user"> & { full_name?: string } = {
      participant_id: p.id,
      user_id: p.user_id,
      avatar_url: null,
      total_score: totalScore,
      solved_count: solvedCount,
      total_questions: totalQuestions,
      effective_time_seconds: effectiveTimeSec,
      formatted_time: formattedTime,
      submission_status: p.status,
      email: p.user_profile?.email || undefined,
      student_id: p.user_profile?.student_id || undefined,
      college: p.user_profile?.college || undefined,
      full_name: p.user_profile?.full_name || undefined,
      last_activity: new Date(latestSubmissionTime).toISOString(),
      violations_count: p.violations_count || 0,
    };

    rawEntries.push({
      rawEntry: rawItem,
      latestTimestamp: latestSubmissionTime,
    });
  }

  // Deterministic multi-tier sorting:
  // 1. Total score DESC
  // 2. Effective time ASC
  // 3. Solved count DESC
  // 4. Latest timestamp ASC
  // 5. User ID ASC
  rawEntries.sort((a, b) => {
    if (b.rawEntry.total_score !== a.rawEntry.total_score) {
      return b.rawEntry.total_score - a.rawEntry.total_score;
    }
    if (a.rawEntry.effective_time_seconds !== b.rawEntry.effective_time_seconds) {
      return a.rawEntry.effective_time_seconds - b.rawEntry.effective_time_seconds;
    }
    if (b.rawEntry.solved_count !== a.rawEntry.solved_count) {
      return b.rawEntry.solved_count - a.rawEntry.solved_count;
    }
    if (a.latestTimestamp !== b.latestTimestamp) {
      return a.latestTimestamp - b.latestTimestamp;
    }
    return a.rawEntry.user_id.localeCompare(b.rawEntry.user_id);
  });

  return {
    timestamp: Date.now(),
    entries: rawEntries,
    totalQuestions,
    contestStartTime,
  };
}

/**
 * Computes authoritative server-side leaderboard with request deduplication and caching.
 * Sorting order:
 * 1. Total score DESC (correctness strictly dominates)
 * 2. Effective time / penalty ASC
 * 3. Problems solved DESC
 */
export async function getContestLeaderboard(
  contestId: string,
  currentUserIdOrScope?: string,
  scopeParam: "student" | "admin" = "student",
  options?: { forceFresh?: boolean }
): Promise<{
  leaderboard: LeaderboardEntry[];
  currentUserRank: number | null;
  currentUserScore: number | null;
  totalParticipants: number;
}> {
  let currentUserId: string | undefined = undefined;
  let scope: "student" | "admin" = "student";

  if (currentUserIdOrScope === "admin" || currentUserIdOrScope === "student") {
    scope = currentUserIdOrScope;
    currentUserId = undefined;
  } else {
    currentUserId = currentUserIdOrScope;
    scope = scopeParam;
  }

  const now = Date.now();
  let raw: CachedLeaderboardRaw | undefined = undefined;

  // Check participants count before relying on cached raw entries
  const participants = await listParticipants(contestId);

  if (!options?.forceFresh) {
    const cached = leaderboardCache.get(contestId);
    if (
      cached &&
      now - cached.timestamp < LEADERBOARD_CACHE_TTL_MS &&
      cached.entries.length === participants.length
    ) {
      raw = cached;
    }
  }

  if (!raw) {
    let pending = inFlightLeaderboards.get(contestId);
    if (!pending) {
      pending = computeLeaderboardRaw(contestId);
      inFlightLeaderboards.set(contestId, pending);
    }
    try {
      raw = await pending;
      leaderboardCache.set(contestId, raw);
    } finally {
      inFlightLeaderboards.delete(contestId);
    }
  }

  // Project entries based on scope and current user
  const ranked: LeaderboardEntry[] = raw.entries.map((item, index) => {
    const isCurrent = currentUserId ? item.rawEntry.user_id === currentUserId : false;

    let displayName =
      item.rawEntry.full_name ||
      item.rawEntry.email ||
      `Contestant ${item.rawEntry.user_id.slice(-4)}`;

    if (isCurrent && scope === "student") {
      displayName = "YOU";
    }

    const projected: LeaderboardEntry = {
      ...item.rawEntry,
      rank: index + 1,
      display_name: displayName,
      is_current_user: isCurrent,
    };

    if (scope === "student") {
      delete projected.email;
      delete projected.student_id;
      delete projected.college;
      delete projected.violations_count;
      delete projected.last_activity;
    }

    return projected;
  });

  const currentUserEntry = ranked.find((e) => e.is_current_user);

  return {
    leaderboard: ranked,
    currentUserRank: currentUserEntry ? currentUserEntry.rank : null,
    currentUserScore: currentUserEntry ? currentUserEntry.total_score : null,
    totalParticipants: ranked.length,
  };
}
