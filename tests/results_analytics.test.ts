/**
 * SmartZero 2.0 — Phase 11 Results + Analytics Test Suite
 *
 * Verifies:
 * 1. Student scorecard calculation (rank, percentile, MCQ + Coding combined score)
 * 2. Question-level breakdown (marks earned, explanations, test cases passed)
 * 3. Accurate attempt & solved statistics
 * 4. Admin cohort analytics: completion rate, score distribution, average score
 * 5. Question success rates and security events aggregation
 *
 * Run: npx tsx tests/results_analytics.test.ts
 */

import {
  createContest,
  addMcqQuestion,
  addCodingQuestion,
  linkQuestionToContest,
  registerContestParticipant,
  recordMcqAnswer,
  submitContestExam,
} from "../lib/contest/service";
import { saveCodingSubmission } from "../lib/judge/service";
import {
  getStudentContestResult,
  getAdminContestAnalytics,
} from "../lib/contest/analytics";
import { recordSecurityEvent } from "../lib/contest/security";

console.log("▶ Running SmartZero Phase 11 Results & Analytics Tests...\n");

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
  const contestPasscode = "RESULTS_ANALYTICS_PASS";

  // ── 1. Contest Setup ──
  console.log("── 1. Contest Setup for Results & Analytics ──");
  const contest = await createContest({
    title: "Analytics Championship 2026",
    slug: "analytics-2026",
    passcode: contestPasscode,
    start_at: new Date(now - 7200000).toISOString(),
    end_at: new Date(now + 3600000).toISOString(),
    duration_minutes: 120,
    status: "PUBLISHED",
  });

  const mcq = await addMcqQuestion({
    prompt: "Which data structure uses LIFO ordering?",
    explanation: "Stack operates on Last-In First-Out.",
    options: [
      { option_text: "Stack", is_correct: true, sort_order: 0 },
      { option_text: "Queue", is_correct: false, sort_order: 1 },
    ],
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: mcq.id,
    question_type: "mcq",
    sort_order: 0,
    marks: 10,
  });

  const coding = await addCodingQuestion({
    title: "Sum of Array",
    description: "Sum all numbers",
    test_cases: [
      { input: "1 2 3", expected_output: "6", is_sample: true, is_hidden: false, weight: 10 },
      { input: "4 5 6", expected_output: "15", is_sample: false, is_hidden: true, weight: 10 },
    ],
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: coding.id,
    question_type: "coding",
    sort_order: 1,
    marks: 20,
  });

  // ── 2. Register Students & Record Submissions ──
  console.log("\n── 2. Student Submissions & Submissions Finalization ──");
  const student1 = "student-analytics-top";
  const student2 = "student-analytics-mid";

  await registerContestParticipant({ contest_id: contest.id, user_id: student1, passcode: contestPasscode });
  const reg2 = await registerContestParticipant({ contest_id: contest.id, user_id: student2, passcode: contestPasscode });

  // Student 1: 10 (MCQ) + 20 (Coding) = 30 pts
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: student1,
    question_id: mcq.id,
    selected_option_id: mcq.options![0].id,
  });
  await saveCodingSubmission({
    contest_id: contest.id,
    user_id: student1,
    question_id: coding.id,
    language: "python",
    code: "print(6)",
    summary: {
      verdict: "Accepted",
      score: 20,
      test_cases_passed: 2,
      total_test_cases: 2,
      execution_time_ms: 100,
      memory_kb: 512,
      test_case_results: [],
    },
  });
  await submitContestExam({ contest_id: contest.id, user_id: student1 });

  // Student 2: 10 (MCQ) + 0 (Coding) = 10 pts
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: student2,
    question_id: mcq.id,
    selected_option_id: mcq.options![0].id,
  });
  await submitContestExam({ contest_id: contest.id, user_id: student2 });

  // Add a security event for audit tracking
  await recordSecurityEvent({
    contest_id: contest.id,
    participant_id: reg2.participant!.id,
    user_id: student2,
    event_type: "tab_switch",
    metadata: { reason: "test tab switch" },
  });

  // ── 3. Test Student Contest Result ──
  console.log("\n── 3. Evaluating Student Scorecard ──");
  const student1Result = await getStudentContestResult(contest.id, student1);
  testAssert(student1Result !== null, "Student 1 result retrieved");
  testAssert(student1Result?.total_score === 30, "Student 1 total score is 30");
  testAssert(student1Result?.mcq_score === 10, "MCQ score is 10");
  testAssert(student1Result?.coding_score === 20, "Coding score is 20");
  testAssert(student1Result?.rank === 1, "Student 1 is ranked #1");
  testAssert(student1Result?.percentile === 100, "Student 1 percentile is 100%");
  testAssert(student1Result?.problems_solved === 2, "2 problems solved");
  testAssert(student1Result?.question_performance.length === 2, "Question breakdown contains 2 questions");

  const mcqPerf = student1Result?.question_performance.find((p) => p.question_type === "mcq");
  testAssert(mcqPerf?.earned_marks === 10, "MCQ question earned 10 marks");
  testAssert(mcqPerf?.mcq_info?.is_correct === true, "MCQ marked correct");
  testAssert(Boolean(mcqPerf?.mcq_info?.explanation?.includes("Stack")), "Explanation revealed post-contest");

  const student2Result = await getStudentContestResult(contest.id, student2);
  testAssert(student2Result?.rank === 2, "Student 2 is ranked #2");
  testAssert(student2Result?.total_score === 10, "Student 2 total score is 10");

  // ── 4. Test Admin Cohort Analytics ──
  console.log("\n── 4. Evaluating Admin Cohort Analytics ──");
  const adminAnalytics = await getAdminContestAnalytics(contest.id);
  testAssert(adminAnalytics !== null, "Admin analytics retrieved");
  testAssert(adminAnalytics?.total_participants === 2, "2 total participants");
  testAssert(adminAnalytics?.completed_count === 2, "2 completed participants");
  testAssert(adminAnalytics?.completion_rate_percent === 100, "100% completion rate");
  testAssert(adminAnalytics?.average_score === 20, "Average score is (30 + 10) / 2 = 20");
  testAssert(adminAnalytics?.highest_score === 30, "Highest score is 30");
  testAssert(adminAnalytics?.lowest_score === 10, "Lowest score is 10");

  // Question Analytics verification
  const mcqAnalytics = adminAnalytics?.question_analytics.find((q) => q.question_type === "mcq");
  testAssert(mcqAnalytics?.attempts_count === 2, "MCQ attempted by 2 contestants");
  testAssert(mcqAnalytics?.success_rate_percent === 100, "MCQ success rate is 100%");

  // Security Events verification
  testAssert(adminAnalytics?.security_events_summary.total_events === 1, "1 total security event logged");
  testAssert(adminAnalytics?.security_events_summary.flagged_participants_count === 1, "1 flagged participant");
  testAssert(adminAnalytics?.security_events_summary.by_type.tab_switch === 1, "1 tab_switch event logged");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 11 RESULTS & ANALYTICS TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
