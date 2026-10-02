/**
 * SmartZero 2.0 — Phase 13 Post-Contest AI Intelligence Test Suite
 *
 * Verifies:
 * 1. LIVE Contest Safety: Live AI is strictly disabled during active exams (allowLiveAI = false)
 * 2. Active contestants cannot trigger AI feedback while their exam is in-progress
 * 3. Sanitized structured payloads: absolute minimization of data, zero PII
 * 4. Post-contest student analysis: performance summary, strong/weak topics, mistake patterns, recommendations
 * 5. Suggested lessons mapped to valid SmartZero Excalidraw visual canvas lessons
 * 6. Admin cohort intelligence: difficulty assessment, outlier questions, curriculum recommendations
 * 7. Server-authoritative immutability: AI analysis NEVER modifies scores, ranks, or database records
 *
 * Run: npx tsx tests/post_contest_ai.test.ts
 */

import {
  createContest,
  addMcqQuestion,
  addCodingQuestion,
  linkQuestionToContest,
  registerContestParticipant,
  recordMcqAnswer,
  submitContestExam,
  getParticipant,
} from "../lib/contest/service";
import { saveCodingSubmission } from "../lib/judge/service";
import { getStudentContestResult, getAdminContestAnalytics } from "../lib/contest/analytics";
import {
  isLiveContestAIAllowed,
  sanitizeStudentDataForAI,
  sanitizeAdminCohortDataForAI,
  generateStudentPostContestAnalysis,
  generateAdminContestAISummary,
  generateDeterministicStudentAnalysis,
  generateDeterministicAdminSummary,
} from "../lib/contest/postContestAI";

console.log("▶ Running SmartZero Phase 13 Post-Contest AI Intelligence Tests...\n");

let passed = 0;
function testAssert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    throw new Error(`Assertion failed: ${name}`);
  }
}

async function run() {
  const now = Date.now();
  const contestPasscode = "AI_INTELLIGENCE_PASS_2026";

  // ── 1. Setup Contest & Questions ──
  console.log("── 1. Contest & Questions Setup ──");
  const contest = await createContest({
    title: "AI Diagnostic National Olympiad",
    slug: "ai-diagnostic-2026",
    passcode: contestPasscode,
    start_at: new Date(now - 7200000).toISOString(),
    end_at: new Date(now + 3600000).toISOString(),
    duration_minutes: 120,
    status: "LIVE",
  });

  const mcq = await addMcqQuestion({
    prompt: "What is the worst-case time complexity of Binary Search in a sorted array?",
    options: [
      { option_text: "O(1)", is_correct: false },
      { option_text: "O(log N)", is_correct: true },
      { option_text: "O(N)", is_correct: false },
      { option_text: "O(N^2)", is_correct: false },
    ],
    explanation: "Binary search eliminates half the search space at each comparison step: O(log N).",
  });

  const codingArray = await addCodingQuestion({
    title: "Maximum Subarray Sum",
    description: "Find the maximum sum of a contiguous subarray using Kadane's Algorithm.",
    time_limit_ms: 1000,
    memory_limit_mb: 256,
    test_cases: [
      { input: "5\n-1 2 3 -4 5", expected_output: "6", is_sample: true, is_hidden: false },
    ],
  });

  const codingGraph = await addCodingQuestion({
    title: "Graph BFS Shortest Path",
    description: "Find the shortest path in an unweighted graph using Breadth-First Search.",
    time_limit_ms: 1500,
    memory_limit_mb: 256,
    test_cases: [
      { input: "4 3\n0 1\n1 2\n2 3", expected_output: "3", is_sample: true, is_hidden: false },
    ],
  });

  await linkQuestionToContest({ contest_id: contest.id, question_id: mcq.id, question_type: "mcq", marks: 10, sort_order: 1 });
  await linkQuestionToContest({ contest_id: contest.id, question_id: codingArray.id, question_type: "coding", marks: 40, sort_order: 2 });
  await linkQuestionToContest({ contest_id: contest.id, question_id: codingGraph.id, question_type: "coding", marks: 50, sort_order: 3 });

  // ── 2. Setup Participants: Submitted vs In-Progress ──
  console.log("\n── 2. Participants Setup ──");
  // Student 1: Submits complete contest
  const student1Id = "student-ai-001";
  await registerContestParticipant({ contest_id: contest.id, user_id: student1Id, passcode: contestPasscode });
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: student1Id,
    question_id: mcq.id,
    selected_option_id: mcq.options![1].id,
  }); // Correct (+10)
  await saveCodingSubmission({
    contest_id: contest.id,
    question_id: codingArray.id,
    user_id: student1Id,
    language: "python",
    code: "def maxSubArray(nums): return max(nums)",
    summary: {
      verdict: "Accepted",
      test_cases_passed: 10,
      total_test_cases: 10,
      score: 40,
      execution_time_ms: 45,
      memory_kb: 1024,
      test_case_results: [],
    },
  });
  await submitContestExam({ contest_id: contest.id, user_id: student1Id });

  // Student 2: Registered and In-Progress (Has NOT submitted)
  const student2Id = "student-ai-002";
  await registerContestParticipant({ contest_id: contest.id, user_id: student2Id, passcode: contestPasscode });

  // Student 3: Submits with TLE & boundary errors
  const student3Id = "student-ai-003";
  await registerContestParticipant({ contest_id: contest.id, user_id: student3Id, passcode: contestPasscode });
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: student3Id,
    question_id: mcq.id,
    selected_option_id: mcq.options![2].id,
  }); // Wrong (+0)
  await saveCodingSubmission({
    contest_id: contest.id,
    question_id: codingArray.id,
    user_id: student3Id,
    language: "python",
    code: "def maxSubArray(nums): while True: pass",
    summary: {
      verdict: "TLE",
      test_cases_passed: 2,
      total_test_cases: 10,
      score: 0,
      execution_time_ms: 1200,
      memory_kb: 2048,
      test_case_results: [],
    },
  });
  await submitContestExam({ contest_id: contest.id, user_id: student3Id });

  // ── 3. Test Live Contest AI Safety Rule ──
  console.log("\n── 3. LIVE Contest AI Safety Rule ──");
  testAssert(isLiveContestAIAllowed() === false, "isLiveContestAIAllowed() is strictly false");

  let inProgressBlocked = false;
  try {
    // Student 2 is still taking the live contest: AI MUST be rejected
    await generateStudentPostContestAnalysis(contest.id, student2Id);
  } catch (err: any) {
    if (err.message.includes("Live AI is strictly disabled during active contests")) {
      inProgressBlocked = true;
    }
  }
  testAssert(inProgressBlocked, "In-progress contestant is strictly blocked from receiving AI analysis during active exam");

  // ── 4. Test Data Sanitization (Zero PII) ──
  console.log("\n── 4. Data Sanitization (Zero PII) ──");
  const rawResult = await getStudentContestResult(contest.id, student1Id);
  testAssert(rawResult !== null, "Student 1 authoritative contest result retrieved");

  const sanitizedStudent = sanitizeStudentDataForAI(rawResult!);
  testAssert((sanitizedStudent as any).user_id === undefined, "Sanitized student data strictly omits user_id");
  testAssert((sanitizedStudent as any).email === undefined, "Sanitized student data strictly omits email");
  testAssert((sanitizedStudent as any).token === undefined, "Sanitized student data strictly omits tokens");
  testAssert(sanitizedStudent.total_score === 50, "Sanitized student data retains score: 50 pts");
  testAssert(sanitizedStudent.questions.length === 3, "Sanitized student data retains question count: 3");

  const rawCohort = await getAdminContestAnalytics(contest.id);
  testAssert(rawCohort !== null, "Authoritative cohort analytics retrieved");

  const sanitizedCohort = sanitizeAdminCohortDataForAI(rawCohort!);
  testAssert((sanitizedCohort as any).participants === undefined, "Sanitized cohort data omits individual participant records");
  testAssert(sanitizedCohort.total_participants === 3, "Sanitized cohort data retains aggregate count: 3");
  testAssert(sanitizedCohort.questions.length === 3, "Sanitized cohort data retains questions: 3");

  // ── 5. Test Student Post-Contest AI Analysis ──
  console.log("\n── 5. Student Post-Contest AI Analysis Generation ──");
  const student1Analysis = await generateStudentPostContestAnalysis(contest.id, student1Id);

  testAssert(typeof student1Analysis.summary === "string" && student1Analysis.summary.length > 20, "Student 1 AI summary generated");
  testAssert(student1Analysis.isAIGenerated === true, "Analysis marked as AI generated");
  testAssert(
    student1Analysis.disclaimer.includes("Authoritative score and rank are strictly server-determined"),
    "Analysis includes mandatory authoritative server scoring disclaimer"
  );
  testAssert(student1Analysis.strongestTopics.length > 0, "Strongest topics identified for successful problem solving");
  testAssert(student1Analysis.suggestedSmartZeroLessons.length > 0, "Suggested SmartZero interactive lessons provided");

  const validVisualLessons = new Set([
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
  ]);
  const allSuggestedValid = student1Analysis.suggestedSmartZeroLessons.every((l) => validVisualLessons.has(l));
  testAssert(allSuggestedValid, "Suggested lessons map strictly to registered SmartZero visual canvas lessons");

  // ── 6. Test Mistake Pattern Detection ──
  console.log("\n── 6. Mistake Pattern & Algorithmic Diagnosis ──");
  const student3Analysis = await generateStudentPostContestAnalysis(contest.id, student3Id);

  const detectedTLE = student3Analysis.mistakePatterns.some((p) => p.includes("Time Limit Exceeded") || p.includes("TLE"));
  testAssert(detectedTLE, "Identified repeated Time Limit Exceeded (TLE) complexity pattern for Student 3");

  const recommendedComplexity = student3Analysis.recommendations.some(
    (r) => r.toLowerCase().includes("complexity") || r.toLowerCase().includes("binary search") || r.toLowerCase().includes("constraints")
  );
  testAssert(recommendedComplexity, "AI recommended asymptotic complexity and constraint analysis for Student 3");

  // ── 7. Authoritative Score & Rank Immutability ──
  console.log("\n── 7. Authoritative Score & Rank Immutability ──");
  const partBefore = await getParticipant(contest.id, student1Id);
  const scoreBefore = partBefore?.score;

  // Execute post-contest AI multiple times
  await generateStudentPostContestAnalysis(contest.id, student1Id);
  await generateStudentPostContestAnalysis(contest.id, student1Id);

  const partAfter = await getParticipant(contest.id, student1Id);
  const scoreAfter = partAfter?.score;

  testAssert(scoreBefore === scoreAfter, "Authoritative student score is strictly immutable and cannot be altered by AI");
  testAssert(partBefore?.status === partAfter?.status, "Participant status remains unchanged after AI analysis");

  // ── 8. Admin Post-Contest Cohort Summary ──
  console.log("\n── 8. Admin Post-Contest Cohort Intelligence ──");
  const cohortSummary = await generateAdminContestAISummary(contest.id);

  testAssert(typeof cohortSummary.cohortSummary === "string" && cohortSummary.cohortSummary.length > 20, "Cohort executive summary generated");
  testAssert(typeof cohortSummary.difficultyAssessment === "string", "Cohort difficulty assessment generated");
  testAssert(cohortSummary.outlierQuestions.length > 0, "Outlier questions with low success rates identified");
  testAssert(cohortSummary.curriculumRecommendations.length > 0, "Curriculum recommendations provided for instructors");
  testAssert(
    cohortSummary.disclaimer.includes("AI-generated cohort insight for administrative curriculum review only"),
    "Cohort summary includes administrative review disclaimer"
  );

  // ── 9. Offline / Deterministic Heuristic Resiliency ──
  console.log("\n── 9. Offline / Deterministic Heuristic Resiliency ──");
  const directDetStudent = generateDeterministicStudentAnalysis(sanitizedStudent);
  testAssert(directDetStudent.strongestTopics.length > 0, "Deterministic student fallback produces valid topics");
  testAssert(directDetStudent.recommendations.length > 0, "Deterministic student fallback produces recommendations");

  const directDetAdmin = generateDeterministicAdminSummary(sanitizedCohort);
  testAssert(directDetAdmin.outlierQuestions.length > 0, "Deterministic admin fallback identifies outliers");

  console.log(`\n🎉 All ${passed} Phase 13 Post-Contest AI Intelligence assertions passed!`);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
