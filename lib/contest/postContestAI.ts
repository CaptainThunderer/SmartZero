import { getContestById, getParticipant } from "./service";
import {
  getStudentContestResult,
  getAdminContestAnalytics,
  type StudentContestResult,
  type AdminContestAnalytics,
} from "./analytics";
import { generateAIText } from "@/ai";

export interface SanitizedStudentPerformance {
  title: string;
  question_type: "mcq" | "coding";
  allocated_marks: number;
  earned_marks: number;
  status: "solved" | "partial" | "unsolved" | "unattempted";
  coding_verdict?: string;
  submissions_count?: number;
  is_mcq_correct?: boolean;
}

export interface SanitizedStudentContestData {
  contest_title: string;
  total_score: number;
  max_possible_score: number;
  mcq_score: number;
  coding_score: number;
  rank: number | null;
  total_participants: number;
  percentile: number | null;
  problems_attempted: number;
  problems_solved: number;
  total_problems: number;
  verdict_distribution: Record<string, number>;
  questions: SanitizedStudentPerformance[];
}

export interface StudentPostContestAIAnalysis {
  summary: string;
  strongestTopics: string[];
  weakTopics: string[];
  mistakePatterns: string[];
  recommendations: string[];
  suggestedSmartZeroLessons: string[];
  disclaimer: string;
  isAIGenerated: boolean;
}

export interface SanitizedAdminCohortData {
  contest_title: string;
  total_participants: number;
  completed_count: number;
  completion_rate_percent: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  score_distribution: { range: string; count: number }[];
  verdict_distribution: Record<string, number>;
  questions: Array<{
    title: string;
    question_type: "mcq" | "coding";
    max_marks: number;
    attempts_count: number;
    solved_count: number;
    success_rate_percent: number;
    average_score: number;
  }>;
}

export interface AdminPostContestAISummary {
  cohortSummary: string;
  difficultyAssessment: string;
  outlierQuestions: Array<{
    questionTitle: string;
    questionType: "mcq" | "coding";
    successRate: number;
    insight: string;
  }>;
  curriculumRecommendations: string[];
  disclaimer: string;
  isAIGenerated: boolean;
}

/**
 * Live contest AI safety rule:
 * Live AI is strictly prohibited during active contests.
 */
export function isLiveContestAIAllowed(): boolean {
  return false;
}

/**
 * Sanitizes student performance data to prevent PII exposure (user IDs, emails, names, auth tokens).
 */
export function sanitizeStudentDataForAI(
  result: StudentContestResult
): SanitizedStudentContestData {
  return {
    contest_title: result.contest_title,
    total_score: result.total_score,
    max_possible_score: result.max_possible_score,
    mcq_score: result.mcq_score,
    coding_score: result.coding_score,
    rank: result.rank,
    total_participants: result.total_participants,
    percentile: result.percentile,
    problems_attempted: result.problems_attempted,
    problems_solved: result.problems_solved,
    total_problems: result.total_problems,
    verdict_distribution: { ...result.verdict_distribution },
    questions: result.question_performance.map((q) => ({
      title: q.title,
      question_type: q.question_type,
      allocated_marks: q.allocated_marks,
      earned_marks: q.earned_marks,
      status: q.status,
      coding_verdict: q.coding_info?.best_verdict,
      submissions_count: q.coding_info?.submissions_count,
      is_mcq_correct: q.mcq_info?.is_correct,
    })),
  };
}

/**
 * Sanitizes cohort analytics to only aggregated statistical data.
 */
export function sanitizeAdminCohortDataForAI(
  analytics: AdminContestAnalytics
): SanitizedAdminCohortData {
  return {
    contest_title: analytics.contest_title,
    total_participants: analytics.total_participants,
    completed_count: analytics.completed_count,
    completion_rate_percent: analytics.completion_rate_percent,
    average_score: analytics.average_score,
    highest_score: analytics.highest_score,
    lowest_score: analytics.lowest_score,
    score_distribution: analytics.score_distribution.map((b) => ({ ...b })),
    verdict_distribution: { ...analytics.verdict_distribution },
    questions: analytics.question_analytics.map((q) => ({
      title: q.title,
      question_type: q.question_type,
      max_marks: q.max_marks,
      attempts_count: q.attempts_count,
      solved_count: q.solved_count,
      success_rate_percent: q.success_rate_percent,
      average_score: q.average_score,
    })),
  };
}

const AVAILABLE_LESSONS = [
  "second-max",
  "binary-search",
  "bst-insert",
  "linked-list-reverse",
  "max-subarray",
  "bubble-sort",
  "selection-sort",
  "insertion-sort",
  "merge-sort",
  "quick-sort",
  "heap-sort",
  "graph-bfs",
  "graph-dfs",
  "stack-ops",
  "queue-ops",
  "hash-table-ops",
];

function extractTopicKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const topics: string[] = [];
  if (lower.includes("array") || lower.includes("sub") || lower.includes("sum")) topics.push("Arrays");
  if (lower.includes("binary search") || lower.includes("search") || lower.includes("sorted")) topics.push("Binary Search");
  if (lower.includes("sort")) topics.push("Sorting");
  if (lower.includes("tree") || lower.includes("bst")) topics.push("Binary Trees");
  if (lower.includes("graph") || lower.includes("bfs") || lower.includes("dfs")) topics.push("Graphs");
  if (lower.includes("dp") || lower.includes("dynamic") || lower.includes("knapsack")) topics.push("Dynamic Programming");
  if (lower.includes("stack") || lower.includes("queue")) topics.push("Linear Data Structures");
  if (lower.includes("hash") || lower.includes("map") || lower.includes("two sum")) topics.push("Hash Tables");
  if (lower.includes("string") || lower.includes("palindrome")) topics.push("String Manipulation");
  if (topics.length === 0) topics.push("General Problem Solving");
  return topics;
}

/**
 * Deterministic heuristic generator for student post-contest analysis.
 * Operates offline or as a fallback when LLM credentials are absent.
 */
export function generateDeterministicStudentAnalysis(
  data: SanitizedStudentContestData
): StudentPostContestAIAnalysis {
  const pct =
    data.max_possible_score > 0
      ? Math.round((data.total_score / data.max_possible_score) * 100)
      : 0;

  const strongestTopicsSet = new Set<string>();
  const weakTopicsSet = new Set<string>();
  const suggestedLessonsSet = new Set<string>();
  const mistakePatterns: string[] = [];
  const recommendations: string[] = [];

  data.questions.forEach((q) => {
    const topics = extractTopicKeywords(q.title);
    if (q.status === "solved" || q.earned_marks === q.allocated_marks) {
      topics.forEach((t) => strongestTopicsSet.add(t));
    } else {
      topics.forEach((t) => weakTopicsSet.add(t));
      if (topics.includes("Binary Search")) suggestedLessonsSet.add("binary-search");
      if (topics.includes("Sorting")) {
        suggestedLessonsSet.add("quick-sort");
        suggestedLessonsSet.add("merge-sort");
      }
      if (topics.includes("Binary Trees")) suggestedLessonsSet.add("bst-insert");
      if (topics.includes("Graphs")) suggestedLessonsSet.add("graph-bfs");
      if (topics.includes("Arrays")) suggestedLessonsSet.add("max-subarray");
    }
  });

  // Check verdict distributions for mistake patterns
  if ((data.verdict_distribution["TLE"] || 0) > 0) {
    mistakePatterns.push(
      "Your coding submissions encountered Time Limit Exceeded (TLE), indicating quadratic or unoptimized asymptotic complexity."
    );
    recommendations.push(
      "Analyze constraints early: for N ≤ 10^5, target O(N) or O(N log N) using divide-and-conquer or binary search."
    );
    suggestedLessonsSet.add("binary-search");
  }

  if ((data.verdict_distribution["Wrong Answer"] || 0) > 0) {
    mistakePatterns.push(
      "Submissions produced Wrong Answer verdicts, commonly associated with boundary conditions, off-by-one indices, or empty container edge cases."
    );
    recommendations.push(
      "Before submitting, test against extreme edge cases: single element, duplicates, negative numbers, and maximum limits."
    );
  }

  if ((data.verdict_distribution["Runtime Error"] || 0) > 0) {
    mistakePatterns.push(
      "Runtime Errors were recorded; check for null/undefined pointer dereferences or array index out-of-bounds access."
    );
    recommendations.push(
      "Add guard statements at the beginning of functions to handle empty arrays or invalid bounds safely."
    );
  }

  if (data.mcq_score === 0 && data.problems_attempted > 0) {
    mistakePatterns.push(
      "Multiple-choice theoretical questions showed conceptual difficulty with Big-O notation or data structure guarantees."
    );
    recommendations.push(
      "Review core asymptotic recurrence relations (Master Theorem) and amortized complexity of hash tables."
    );
  }

  if (data.problems_attempted < data.total_problems) {
    recommendations.push(
      `Pace yourself during the contest: ${
        data.total_problems - data.problems_attempted
      } problems were left unattempted. Read all problem statements in the first 5 minutes to identify quick wins.`
    );
  }

  if (suggestedLessonsSet.size === 0) {
    suggestedLessonsSet.add("second-max");
    suggestedLessonsSet.add("binary-search");
  }

  const strongestTopics = Array.from(strongestTopicsSet);
  const weakTopics = Array.from(weakTopicsSet).filter((t) => !strongestTopics.includes(t));

  const summary = `You achieved ${data.total_score}/${data.max_possible_score} points (${pct}%) in ${data.contest_title}, solving ${data.problems_solved} of ${data.total_problems} problems.${
    data.rank ? ` You placed #${data.rank} out of ${data.total_participants} participants.` : ""
  } ${
    strongestTopics.length > 0
      ? `Your strongest performance was in ${strongestTopics.slice(0, 2).join(" and ")}.`
      : "You showed great effort across attempted challenges."
  } ${
    weakTopics.length > 0
      ? `Focus targeted practice on ${weakTopics.slice(0, 2).join(" and ")} to boost your rating in the next contest.`
      : "Outstanding consistency across all tested topics!"
  }`;

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue maintaining algorithmic proficiency by solving medium-hard problems on dynamic programming and graph theory."
    );
  }

  return {
    summary,
    strongestTopics: strongestTopics.length > 0 ? strongestTopics : ["Fundamental Problem Solving"],
    weakTopics: weakTopics.length > 0 ? weakTopics : ["None identified — balanced performance!"],
    mistakePatterns: mistakePatterns.length > 0 ? mistakePatterns : ["No repetitive failure patterns identified; clean execution."],
    recommendations,
    suggestedSmartZeroLessons: Array.from(suggestedLessonsSet).slice(0, 4),
    disclaimer:
      "AI-generated recommendations for educational analysis only. Authoritative score and rank are strictly server-determined.",
    isAIGenerated: true,
  };
}

/**
 * Deterministic heuristic generator for admin cohort post-contest summary.
 */
export function generateDeterministicAdminSummary(
  data: SanitizedAdminCohortData
): AdminPostContestAISummary {
  let diffAssessment = "The contest demonstrated balanced difficulty with healthy score spread across contestants.";
  if (data.average_score < 25) {
    diffAssessment = "The contest was highly challenging for this cohort, resulting in a low overall average score and high submission friction.";
  } else if (data.average_score > 75) {
    diffAssessment = "The contest difficulty was accessible, resulting in high completion rates and top scores.";
  }

  const outlierQuestions: AdminPostContestAISummary["outlierQuestions"] = [];
  const curriculumRecs: string[] = [];

  data.questions.forEach((q) => {
    if (q.attempts_count > 0 && q.success_rate_percent < 35) {
      outlierQuestions.push({
        questionTitle: q.title,
        questionType: q.question_type,
        successRate: q.success_rate_percent,
        insight: `Significantly lower success rate (${q.success_rate_percent}%) than cohort average. Contestants encountered edge case pitfalls or algorithmic efficiency barriers.`,
      });
      curriculumRecs.push(`Hold a focused review session on topics tested in "${q.title}".`);
    }
  });

  if (outlierQuestions.length === 0 && data.questions.length > 0) {
    // Pick the question with lowest success rate
    const sorted = [...data.questions].sort((a, b) => a.success_rate_percent - b.success_rate_percent);
    const lowest = sorted[0];
    outlierQuestions.push({
      questionTitle: lowest.title,
      questionType: lowest.question_type,
      successRate: lowest.success_rate_percent,
      insight: `Most challenging problem in the contest (${lowest.success_rate_percent}% success rate).`,
    });
  }

  if (curriculumRecs.length === 0) {
    curriculumRecs.push("Encourage learners to practice timed mock assessments to improve pacing.");
    curriculumRecs.push("Incorporate more live visual tracing of boundary conditions and edge cases in lectures.");
  }

  const cohortSummary = `Cohort Assessment: ${data.total_participants} participants registered, with ${data.completed_count} (${data.completion_rate_percent}%) completing all sections. The cohort average score was ${data.average_score} points (highest: ${data.highest_score}, lowest: ${data.lowest_score}).`;

  return {
    cohortSummary,
    difficultyAssessment: diffAssessment,
    outlierQuestions,
    curriculumRecommendations: curriculumRecs,
    disclaimer:
      "AI-generated cohort insight for administrative curriculum review only.",
    isAIGenerated: true,
  };
}

/**
 * Generates post-contest AI performance analysis for a student.
 * Failsafe: Rejects if contest is LIVE and student has not completed/submitted.
 */
export async function generateStudentPostContestAnalysis(
  contestId: string,
  userId: string
): Promise<StudentPostContestAIAnalysis> {
  const contest = await getContestById(contestId);
  if (!contest) {
    throw new Error("Contest not found");
  }

  // LIVE CONTEST AI SAFETY RULE:
  // If contest is LIVE, student MUST have completed/submitted their attempt.
  // Active exams never receive AI feedback.
  if (contest.status === "LIVE") {
    const participant = await getParticipant(contestId, userId);
    if (!participant || participant.status !== "submitted") {
      throw new Error(
        "Live AI is strictly disabled during active contests. Post-contest analysis is only available after contest completion."
      );
    }
  }

  if (contest.status === "DRAFT" || contest.status === "UPCOMING") {
    throw new Error("Contest has not concluded. Post-contest AI analysis is unavailable.");
  }

  const result = await getStudentContestResult(contestId, userId);
  if (!result) {
    throw new Error("No participation record found for student.");
  }

  // 1. Sanitize data — completely strips PII
  const sanitized = sanitizeStudentDataForAI(result);

  // 2. Fallback baseline
  const deterministicFallback = generateDeterministicStudentAnalysis(sanitized);

  // 3. Attempt LLM invocation via Phase 2 AI Gateway (Gemini, OpenRouter, Featherless)
  try {
    const systemPrompt = `You are SmartZero's Post-Contest AI Academic Tutor.
Your purpose is to analyze student performance after a competitive programming / DSA contest has finished.
CRITICAL RULES:
1. You DO NOT determine correctness, score, rank, or acceptance. Those are server-authoritative and already finalized.
2. Provide constructive, pedagogical recommendations and identify weak and strong DSA topics.
3. Output strictly valid JSON matching this schema:
{
  "summary": "Short 2-3 sentence overview of student performance",
  "strongestTopics": ["string", ...],
  "weakTopics": ["string", ...],
  "mistakePatterns": ["string", ...],
  "recommendations": ["string", ...],
  "suggestedSmartZeroLessons": ["string", ...]
}
Valid lesson names for suggestedSmartZeroLessons are: ${AVAILABLE_LESSONS.join(", ")}.`;

    const userPrompt = `Here is the student's sanitized contest performance:
${JSON.stringify(sanitized, null, 2)}

Provide your post-contest analysis JSON:`;

    const rawResponse = await generateAIText(systemPrompt, userPrompt);
    const cleaned = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : deterministicFallback.summary,
      strongestTopics: Array.isArray(parsed.strongestTopics) && parsed.strongestTopics.length > 0
        ? parsed.strongestTopics
        : deterministicFallback.strongestTopics,
      weakTopics: Array.isArray(parsed.weakTopics) && parsed.weakTopics.length > 0
        ? parsed.weakTopics
        : deterministicFallback.weakTopics,
      mistakePatterns: Array.isArray(parsed.mistakePatterns) && parsed.mistakePatterns.length > 0
        ? parsed.mistakePatterns
        : deterministicFallback.mistakePatterns,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations
        : deterministicFallback.recommendations,
      suggestedSmartZeroLessons: Array.isArray(parsed.suggestedSmartZeroLessons) && parsed.suggestedSmartZeroLessons.length > 0
        ? parsed.suggestedSmartZeroLessons.filter((l: string) => AVAILABLE_LESSONS.includes(l))
        : deterministicFallback.suggestedSmartZeroLessons,
      disclaimer: deterministicFallback.disclaimer,
      isAIGenerated: true,
    };
  } catch {
    // If AI Gateway is unconfigured (offline / test mode) or throws, safely return deterministic intelligence
    return deterministicFallback;
  }
}

/**
 * Generates post-contest cohort intelligence for administrators.
 */
export async function generateAdminContestAISummary(
  contestId: string
): Promise<AdminPostContestAISummary> {
  const contest = await getContestById(contestId);
  if (!contest) {
    throw new Error("Contest not found");
  }

  if (contest.status === "DRAFT" || contest.status === "UPCOMING") {
    throw new Error("Contest has not started or concluded. Cohort AI summary is unavailable.");
  }

  const analytics = await getAdminContestAnalytics(contestId);
  if (!analytics) {
    throw new Error("Analytics unavailable for this contest.");
  }

  // 1. Sanitize cohort data
  const sanitized = sanitizeAdminCohortDataForAI(analytics);

  // 2. Fallback baseline
  const deterministicFallback = generateDeterministicAdminSummary(sanitized);

  // 3. Attempt LLM invocation via Phase 2 AI Gateway
  try {
    const systemPrompt = `You are SmartZero's Post-Contest Cohort Intelligence Analyst.
Analyze aggregated cohort statistics for contest instructors and administrators.
CRITICAL RULES:
1. All scores and rankings are authoritative and final.
2. Highlight outlier questions with low success rates, assess cohort difficulty, and recommend curriculum focus.
3. Output strictly valid JSON matching this schema:
{
  "cohortSummary": "Concise overview of cohort performance",
  "difficultyAssessment": "Assessment of contest difficulty and tier separation",
  "outlierQuestions": [
    {
      "questionTitle": "string",
      "questionType": "mcq" | "coding",
      "successRate": number,
      "insight": "string"
    }
  ],
  "curriculumRecommendations": ["string", ...]
}`;

    const userPrompt = `Here is the contest cohort analytics:
${JSON.stringify(sanitized, null, 2)}

Provide your cohort analysis JSON:`;

    const rawResponse = await generateAIText(systemPrompt, userPrompt);
    const cleaned = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      cohortSummary: typeof parsed.cohortSummary === "string" ? parsed.cohortSummary : deterministicFallback.cohortSummary,
      difficultyAssessment: typeof parsed.difficultyAssessment === "string" ? parsed.difficultyAssessment : deterministicFallback.difficultyAssessment,
      outlierQuestions: Array.isArray(parsed.outlierQuestions) && parsed.outlierQuestions.length > 0
        ? parsed.outlierQuestions
        : deterministicFallback.outlierQuestions,
      curriculumRecommendations: Array.isArray(parsed.curriculumRecommendations) && parsed.curriculumRecommendations.length > 0
        ? parsed.curriculumRecommendations
        : deterministicFallback.curriculumRecommendations,
      disclaimer: deterministicFallback.disclaimer,
      isAIGenerated: true,
    };
  } catch {
    return deterministicFallback;
  }
}
