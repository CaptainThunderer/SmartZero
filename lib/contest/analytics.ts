import type {
  Contest,
  ContestQuestion,
  CodingVerdict,
  ParticipantStatus,
} from "@/types/contest";
import {
  getContestById,
  listParticipants,
  getParticipant,
  getContestQuestions,
  calculateStudentMcqScore,
  getStudentAnswers,
} from "./service";
import { getStudentSubmissions } from "@/lib/judge/service";
import { getContestLeaderboard } from "./leaderboard";
import { getParticipantSecurityEvents } from "./security";

export interface StudentQuestionPerformance {
  question_id: string;
  question_type: "mcq" | "coding";
  title: string;
  allocated_marks: number;
  earned_marks: number;
  status: "solved" | "partial" | "unsolved" | "unattempted";
  mcq_info?: {
    selected_option_id: string | null;
    is_correct: boolean;
    explanation?: string;
  };
  coding_info?: {
    best_verdict?: CodingVerdict;
    test_cases_passed?: number;
    total_test_cases?: number;
    submissions_count: number;
    execution_time_ms?: number;
  };
}

export interface StudentContestResult {
  contest_id: string;
  contest_title: string;
  user_id: string;
  participant_status: ParticipantStatus;
  rank: number | null;
  total_participants: number;
  percentile: number | null;
  total_score: number;
  max_possible_score: number;
  mcq_score: number;
  coding_score: number;
  problems_attempted: number;
  problems_solved: number;
  total_problems: number;
  effective_time_formatted: string;
  verdict_distribution: Record<string, number>;
  question_performance: StudentQuestionPerformance[];
}

export interface AdminQuestionAnalytics {
  question_id: string;
  question_type: "mcq" | "coding";
  title: string;
  max_marks: number;
  attempts_count: number;
  solved_count: number;
  success_rate_percent: number;
  average_score: number;
  mcq_option_counts?: Record<string, number>;
  coding_verdicts?: Record<string, number>;
}

export interface AdminContestAnalytics {
  contest_id: string;
  contest_title: string;
  total_participants: number;
  completed_count: number;
  completion_rate_percent: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  score_distribution: { range: string; count: number }[];
  question_analytics: AdminQuestionAnalytics[];
  verdict_distribution: Record<string, number>;
  security_events_summary: {
    total_events: number;
    flagged_participants_count: number;
    by_type: Record<string, number>;
  };
}

/**
 * Calculates comprehensive, authoritative results for a single student.
 * Never exposes other contestants' private details.
 */
export async function getStudentContestResult(
  contestId: string,
  userId: string
): Promise<StudentContestResult | null> {
  const contest = await getContestById(contestId);
  if (!contest) return null;

  const participant = await getParticipant(contestId, userId);
  if (!participant) return null;

  // Retrieve leaderboard for authoritative rank & percentile
  const lbData = await getContestLeaderboard(contestId, userId);
  const totalParts = lbData.totalParticipants;
  const userRank = lbData.currentUserRank;

  let percentile: number | null = null;
  if (userRank !== null && totalParts > 0) {
    if (totalParts === 1) {
      percentile = 100;
    } else {
      percentile = Math.round(((totalParts - userRank) / (totalParts - 1)) * 100);
    }
  }

  // Admin view of questions to get full details for post-contest review
  const questions = await getContestQuestions(contestId, "admin");
  const studentAnswers = await getStudentAnswers(contestId, userId);
  const studentSubmissions = await getStudentSubmissions(contestId, userId);

  const answerMap = new Map(studentAnswers.map((a) => [a.question_id, a]));
  const codingSubsMap = new Map<string, typeof studentSubmissions>();

  studentSubmissions.forEach((sub) => {
    const list = codingSubsMap.get(sub.question_id) || [];
    list.push(sub);
    codingSubsMap.set(sub.question_id, list);
  });

  let mcqTotalScore = 0;
  let codingTotalScore = 0;
  let maxPossibleScore = 0;
  let problemsAttempted = 0;
  let problemsSolved = 0;

  const verdictDistribution: Record<string, number> = {
    Accepted: 0,
    "Partial Accepted": 0,
    "Wrong Answer": 0,
    "Runtime Error": 0,
    "Compilation Error": 0,
    TLE: 0,
  };

  const questionPerformance: StudentQuestionPerformance[] = [];

  for (const q of questions) {
    maxPossibleScore += q.marks;

    if (q.question_type === "mcq") {
      const ans = answerMap.get(q.question_id);
      const isAttempted = !!ans && ans.selected_option_id !== null;
      let isCorrect = false;
      let earned = 0;

      if (isAttempted) {
        problemsAttempted++;
        const correctOpt = q.mcq_details?.options?.find((o) => o.is_correct);
        if (correctOpt && correctOpt.id === ans.selected_option_id) {
          isCorrect = true;
          earned = q.marks;
          mcqTotalScore += q.marks;
          problemsSolved++;
          verdictDistribution.Accepted++;
        } else {
          verdictDistribution["Wrong Answer"]++;
          if (contest.negative_marking) {
            const penalty = q.negative_marks || contest.default_negative_mark || 0;
            earned = -penalty;
            mcqTotalScore -= penalty;
          }
        }
      }

      questionPerformance.push({
        question_id: q.question_id,
        question_type: "mcq",
        title: q.mcq_details?.question_text || "MCQ Question",
        allocated_marks: q.marks,
        earned_marks: earned,
        status: isCorrect ? "solved" : isAttempted ? "unsolved" : "unattempted",
        mcq_info: {
          selected_option_id: ans?.selected_option_id ?? null,
          is_correct: isCorrect,
          explanation: q.mcq_details?.explanation,
        },
      });
    } else {
      // Coding Question
      const subs = codingSubsMap.get(q.question_id) || [];
      const isAttempted = subs.length > 0;
      let bestSub = subs[0];

      subs.forEach((sub) => {
        if (verdictDistribution[sub.verdict] !== undefined) {
          verdictDistribution[sub.verdict]++;
        }
        if (!bestSub || sub.score > bestSub.score) {
          bestSub = sub;
        }
      });

      let earned = 0;
      let status: "solved" | "partial" | "unsolved" | "unattempted" = "unattempted";

      if (isAttempted && bestSub) {
        problemsAttempted++;
        earned = bestSub.score;
        codingTotalScore += earned;

        if (bestSub.verdict === "Accepted" || earned === q.marks) {
          status = "solved";
          problemsSolved++;
        } else if (earned > 0) {
          status = "partial";
          problemsSolved++;
        } else {
          status = "unsolved";
        }
      }

      questionPerformance.push({
        question_id: q.question_id,
        question_type: "coding",
        title: q.coding_details?.title || "Coding Challenge",
        allocated_marks: q.marks,
        earned_marks: earned,
        status,
        coding_info: {
          best_verdict: bestSub?.verdict,
          test_cases_passed: bestSub?.test_cases_passed,
          total_test_cases: bestSub?.total_test_cases,
          submissions_count: subs.length,
          execution_time_ms: bestSub?.execution_time_ms,
        },
      });
    }
  }

  const userEntry = lbData.leaderboard.find((e) => e.is_current_user);

  return {
    contest_id: contestId,
    contest_title: contest.title,
    user_id: userId,
    participant_status: participant.status,
    rank: userRank,
    total_participants: totalParts,
    percentile,
    total_score: mcqTotalScore + codingTotalScore,
    max_possible_score: maxPossibleScore,
    mcq_score: mcqTotalScore,
    coding_score: codingTotalScore,
    problems_attempted: problemsAttempted,
    problems_solved: problemsSolved,
    total_problems: questions.length,
    effective_time_formatted: userEntry?.formatted_time || "00:00",
    verdict_distribution: verdictDistribution,
    question_performance: questionPerformance,
  };
}

/**
 * Calculates comprehensive cohort analytics for contest administrators.
 * Evaluates performance metrics, score distributions, and security events.
 */
export async function getAdminContestAnalytics(
  contestId: string
): Promise<AdminContestAnalytics | null> {
  const contest = await getContestById(contestId);
  if (!contest) return null;

  const participants = await listParticipants(contestId);
  const questions = await getContestQuestions(contestId, "admin");
  const lbData = await getContestLeaderboard(contestId);

  const totalParticipants = participants.length;
  const completedCount = participants.filter((p) => p.status === "submitted").length;
  const completionRate =
    totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0;

  // Score stats
  const scores = lbData.leaderboard.map((e) => e.total_score);
  const sumScores = scores.reduce((a, b) => a + b, 0);
  const averageScore = totalParticipants > 0 ? Math.round((sumScores / totalParticipants) * 10) / 10 : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  // Score distribution buckets (0-20, 21-40, 41-60, 61-80, 81+)
  const buckets = [
    { range: "0 - 20", min: 0, max: 20, count: 0 },
    { range: "21 - 40", min: 21, max: 40, count: 0 },
    { range: "41 - 60", min: 41, max: 60, count: 0 },
    { range: "61 - 80", min: 61, max: 80, count: 0 },
    { range: "81+", min: 81, max: Infinity, count: 0 },
  ];

  scores.forEach((s) => {
    const bucket = buckets.find((b) => s >= b.min && s <= b.max);
    if (bucket) bucket.count++;
  });

  const overallVerdicts: Record<string, number> = {
    Accepted: 0,
    "Partial Accepted": 0,
    "Wrong Answer": 0,
    "Runtime Error": 0,
    "Compilation Error": 0,
    TLE: 0,
  };

  // Question Analytics
  const questionAnalytics: AdminQuestionAnalytics[] = [];

  for (const q of questions) {
    let attemptsCount = 0;
    let solvedCount = 0;
    let totalMarksEarned = 0;

    const optCounts: Record<string, number> = {};
    const codingVerdicts: Record<string, number> = {};

    for (const p of participants) {
      if (q.question_type === "mcq") {
        const answers = await getStudentAnswers(contestId, p.user_id);
        const ans = answers.find((a) => a.question_id === q.question_id);
        if (ans && ans.selected_option_id) {
          attemptsCount++;
          optCounts[ans.selected_option_id] = (optCounts[ans.selected_option_id] || 0) + 1;

          const correctOpt = q.mcq_details?.options?.find((o) => o.is_correct);
          if (correctOpt && correctOpt.id === ans.selected_option_id) {
            solvedCount++;
            totalMarksEarned += q.marks;
            overallVerdicts.Accepted++;
          } else {
            overallVerdicts["Wrong Answer"]++;
          }
        }
      } else {
        const subs = await getStudentSubmissions(contestId, p.user_id, q.question_id);
        if (subs.length > 0) {
          attemptsCount++;
          const bestSub = subs.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
          totalMarksEarned += bestSub.score;
          codingVerdicts[bestSub.verdict] = (codingVerdicts[bestSub.verdict] || 0) + 1;
          overallVerdicts[bestSub.verdict] = (overallVerdicts[bestSub.verdict] || 0) + 1;

          if (bestSub.verdict === "Accepted" || bestSub.score === q.marks) {
            solvedCount++;
          }
        }
      }
    }

    const avgEarned = attemptsCount > 0 ? Math.round((totalMarksEarned / attemptsCount) * 10) / 10 : 0;
    const successRate = attemptsCount > 0 ? Math.round((solvedCount / attemptsCount) * 100) : 0;

    questionAnalytics.push({
      question_id: q.question_id,
      question_type: q.question_type,
      title:
        q.question_type === "mcq"
          ? q.mcq_details?.question_text || "MCQ Question"
          : q.coding_details?.title || "Coding Question",
      max_marks: q.marks,
      attempts_count: attemptsCount,
      solved_count: solvedCount,
      success_rate_percent: successRate,
      average_score: avgEarned,
      mcq_option_counts: q.question_type === "mcq" ? optCounts : undefined,
      coding_verdicts: q.question_type === "coding" ? codingVerdicts : undefined,
    });
  }

  // Security Events aggregation
  let totalSecEvents = 0;
  const secEventsByType: Record<string, number> = {};
  let flaggedParticipantsCount = 0;

  for (const p of participants) {
    const events = await getParticipantSecurityEvents(contestId, p.id);
    if (events.length > 0) {
      totalSecEvents += events.length;
      flaggedParticipantsCount++;
      events.forEach((ev) => {
        secEventsByType[ev.event_type] = (secEventsByType[ev.event_type] || 0) + 1;
      });
    }
  }

  return {
    contest_id: contestId,
    contest_title: contest.title,
    total_participants: totalParticipants,
    completed_count: completedCount,
    completion_rate_percent: completionRate,
    average_score: averageScore,
    highest_score: highestScore,
    lowest_score: lowestScore,
    score_distribution: buckets.map((b) => ({ range: b.range, count: b.count })),
    question_analytics: questionAnalytics,
    verdict_distribution: overallVerdicts,
    security_events_summary: {
      total_events: totalSecEvents,
      flagged_participants_count: flaggedParticipantsCount,
      by_type: secEventsByType,
    },
  };
}
