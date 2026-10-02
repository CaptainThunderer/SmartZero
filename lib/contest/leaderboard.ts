import type { LeaderboardEntry } from "@/types/contest";
import {
  getContestById,
  listParticipants,
  calculateStudentMcqScore,
  getContestQuestions,
} from "./service";
import { getStudentSubmissions } from "@/lib/judge/service";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Computes authoritative server-side leaderboard.
 * Sorting order:
 * 1. Total score DESC (correctness strictly dominates)
 * 2. Effective time / penalty ASC
 * 3. Problems solved DESC
 */
export async function getContestLeaderboard(
  contestId: string,
  currentUserId?: string
): Promise<{
  leaderboard: LeaderboardEntry[];
  currentUserRank: number | null;
  currentUserScore: number | null;
  totalParticipants: number;
}> {
  const contest = await getContestById(contestId);
  if (!contest) {
    return {
      leaderboard: [],
      currentUserRank: null,
      currentUserScore: null,
      totalParticipants: 0,
    };
  }

  const participants = await listParticipants(contestId);
  const questions = await getContestQuestions(contestId, "admin");
  const totalQuestions = questions.length;
  const contestStartTime = new Date(contest.start_at).getTime();

  interface SortableEntry {
    entry: Omit<LeaderboardEntry, "rank">;
    latestTimestamp: number;
  }

  const entries: SortableEntry[] = [];

  for (const p of participants) {
    // 1. MCQ Score
    const mcqRes = await calculateStudentMcqScore(contestId, p.user_id);

    // 2. Coding Score
    const codingSubs = await getStudentSubmissions(contestId, p.user_id);
    const bestCodingScores = new Map<string, { score: number; verdict: string; time: string }>();

    for (const sub of codingSubs) {
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
    let latestSubmissionTime = new Date(p.joined_at).getTime();

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

    const totalScore = mcqRes.totalScore + codingTotal;
    const solvedCount = mcqRes.correctCount + codingSolved;

    // Effective time in seconds from contest start
    const effectiveTimeSec = Math.max(
      0,
      Math.floor((latestSubmissionTime - contestStartTime) / 1000)
    );

    const m = Math.floor(effectiveTimeSec / 60);
    const s = effectiveTimeSec % 60;
    const formattedTime = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

    const isCurrent = currentUserId ? p.user_id === currentUserId : false;

    // Display Name resolution
    let displayName = p.user_profile?.full_name || p.user_profile?.email || `Contestant ${p.user_id.slice(-4)}`;
    if (isCurrent) {
      displayName = "YOU";
    }

    entries.push({
      entry: {
        participant_id: p.id,
        user_id: p.user_id,
        display_name: displayName,
        avatar_url: null,
        total_score: totalScore,
        solved_count: solvedCount,
        total_questions: totalQuestions,
        effective_time_seconds: effectiveTimeSec,
        formatted_time: formattedTime,
        submission_status: p.status,
        is_current_user: isCurrent,
      },
      latestTimestamp: latestSubmissionTime,
    });
  }

  // 3. Multi-tier deterministic sorting:
  // 1. Total score DESC (correctness strictly dominates)
  // 2. Effective time ASC
  // 3. Solved count DESC
  // 4. Final accepted submission timestamp ASC
  entries.sort((a, b) => {
    if (b.entry.total_score !== a.entry.total_score) {
      return b.entry.total_score - a.entry.total_score;
    }
    if (a.entry.effective_time_seconds !== b.entry.effective_time_seconds) {
      return a.entry.effective_time_seconds - b.entry.effective_time_seconds;
    }
    if (b.entry.solved_count !== a.entry.solved_count) {
      return b.entry.solved_count - a.entry.solved_count;
    }
    return a.latestTimestamp - b.latestTimestamp;
  });

  // Assign ranks
  const ranked: LeaderboardEntry[] = entries.map((item, index) => ({
    ...item.entry,
    rank: index + 1,
  }));

  const currentUserEntry = ranked.find((e) => e.is_current_user);

  return {
    leaderboard: ranked,
    currentUserRank: currentUserEntry ? currentUserEntry.rank : null,
    currentUserScore: currentUserEntry ? currentUserEntry.total_score : null,
    totalParticipants: ranked.length,
  };
}
