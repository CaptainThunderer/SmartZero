import assert from "node:assert/strict";
import {
  createContest,
  addMcqQuestion,
  addCodingQuestion,
  linkQuestionToContest,
  registerContestParticipant,
  recordMcqAnswer,
  calculateStudentMcqScore,
  calculateStudentCodingScore,
  submitContestExam,
  getContestQuestions,
  getStudentAnswers,
} from "../lib/contest/service";
import { saveCodingSubmission, saveCodingDraft, getStudentSubmissions } from "../lib/judge/service";
import { getContestLeaderboard } from "../lib/contest/leaderboard";

console.log("==================================================");
console.log("▶ RUNNING MASTER SCORING, AUTOSAVE & LEADERBOARD SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  const contest = await createContest({
    title: "Master Verification Contest",
    description: "Testing autosave, deterministic scoring, and leaderboard",
    start_at: new Date(Date.now() - 600_000).toISOString(),
    end_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_minutes: 60,
    passcode: "MASTER2026",
    negative_marking: true,
    default_negative_mark: 0.25,
    status: "PUBLISHED",
  });
  testAssert(!!contest.id, "Contest created successfully");

  // ── 1. Create and Link Questions ──
  console.log("\n── 1. Question Bank Creation & Linking ──");
  const q1 = await addMcqQuestion({
    question_text: "What is the capital of France?",
    options: [
      { option_text: "Paris", is_correct: true },
      { option_text: "London", is_correct: false },
      { option_text: "Berlin", is_correct: false },
      { option_text: "Madrid", is_correct: false },
    ],
  });
  const opt1Paris = q1.options!.find((o) => o.is_correct)!.id;
  const opt1London = q1.options!.find((o) => !o.is_correct)!.id;

  const linkedQ1 = await linkQuestionToContest({
    contest_id: contest.id,
    question_id: q1.id,
    question_type: "mcq",
    marks: 4,
    negative_marks: 1,
    sort_order: 0,
  });
  testAssert(linkedQ1.marks === 4, "MCQ Q1 linked with 4 marks (+4 / -1)");

  const q2 = await addMcqQuestion({
    question_text: "Which of the following is prime?",
    options: [
      { option_text: "4", is_correct: false },
      { option_text: "6", is_correct: false },
      { option_text: "7", is_correct: true },
      { option_text: "9", is_correct: false },
    ],
  });
  const opt2Wrong = q2.options!.find((o) => !o.is_correct)!.id;

  const linkedQ2 = await linkQuestionToContest({
    contest_id: contest.id,
    question_id: q2.id,
    question_type: "mcq",
    marks: 3,
    negative_marks: 1,
    sort_order: 1,
  });
  testAssert(linkedQ2.marks === 3, "MCQ Q2 linked with 3 marks (+3 / -1)");

  const codeQ = await addCodingQuestion({
    title: "Double Integer",
    description: "Given integer N, return N * 2.",
    test_cases: [
      { input: "5", expected_output: "10", is_sample: true, is_hidden: false, weight: 5 },
      { input: "-3", expected_output: "-6", is_sample: false, is_hidden: true, weight: 5 },
    ],
  });
  const linkedCodeQ = await linkQuestionToContest({
    contest_id: contest.id,
    question_id: codeQ.id,
    question_type: "coding",
    marks: 10,
    sort_order: 2,
  });
  testAssert(linkedCodeQ.marks === 10, "Coding problem linked with 10 marks");

  // Verify retrieval
  const contestQuestions = await getContestQuestions(contest.id, "admin");
  testAssert(contestQuestions.length === 3, "getContestQuestions retrieved 3 linked questions");

  // ── 2. Student Registration & Autosave Answers ──
  console.log("\n── 2. Student Registration & MCQ Answer Autosave ──");
  const testStudentId = "student-audit-001";
  const reg = await registerContestParticipant({
    contest_id: contest.id,
    user_id: testStudentId,
    passcode: "MASTER2026",
  });
  testAssert(!!reg.participant, "Student successfully registered as participant");

  // Record Answer for Q1: Paris (Correct)
  const ans1 = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: testStudentId,
    question_id: q1.id,
    selected_option_id: opt1Paris,
  });
  testAssert(ans1.answer?.selected_option_id === opt1Paris, "Autosaved Q1 answer (Paris)");

  // Change answer to London then back to Paris (simulating rapid change)
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: testStudentId,
    question_id: q1.id,
    selected_option_id: opt1London,
  });
  const ans1Final = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: testStudentId,
    question_id: q1.id,
    selected_option_id: opt1Paris,
  });
  testAssert(ans1Final.answer?.selected_option_id === opt1Paris, "Final recorded answer for Q1 is Paris");

  // Record Answer for Q2: Wrong option (Incorrect)
  const ans2 = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: testStudentId,
    question_id: q2.id,
    selected_option_id: opt2Wrong,
  });
  testAssert(ans2.answer?.selected_option_id === opt2Wrong, "Autosaved Q2 answer (Wrong Option)");

  // Verify student answers retrieval
  const studentAnswers = await getStudentAnswers(contest.id, testStudentId);
  testAssert(studentAnswers.length === 2, "getStudentAnswers returns exactly 2 answers");

  // ── 3. Coding Draft & Submission Scoring ──
  console.log("\n── 3. Coding Draft & Submission Scoring ──");
  // Save Draft (verdict = DRAFT, score = 0)
  const draftResult = await saveCodingDraft({
    contest_id: contest.id,
    user_id: testStudentId,
    question_id: codeQ.id,
    language: "python",
    code: "n = int(input())\nprint(n * 2)",
  });
  testAssert(draftResult.success, "Coding draft saved successfully");

  // Draft should not affect score
  const draftScore = await calculateStudentCodingScore(contest.id, testStudentId);
  testAssert(draftScore.totalScore === 0, "Draft code has 0 score impact");

  // Save Official Submission (Accepted, score = 10)
  await saveCodingSubmission({
    contest_id: contest.id,
    user_id: testStudentId,
    question_id: codeQ.id,
    language: "python",
    code: "n = int(input())\nprint(n * 2)",
    summary: {
      verdict: "Accepted",
      score: 10,
      test_cases_passed: 2,
      total_test_cases: 2,
      execution_time_ms: 45,
      memory_kb: 4096,
      compile_output: "",
      test_case_results: [],
    },
  });

  const codingScore = await calculateStudentCodingScore(contest.id, testStudentId);
  testAssert(codingScore.totalScore === 10, "Coding submission score is 10/10");

  // ── 4. Deterministic Total Evaluation & Zero-Score Bug Eradication ──
  console.log("\n── 4. Deterministic Scoring Evaluation ──");
  const mcqScore = await calculateStudentMcqScore(contest.id, testStudentId);
  testAssert(mcqScore.correctCount === 1, "MCQ correct count is 1 (Q1)");
  testAssert(mcqScore.incorrectCount === 1, "MCQ incorrect count is 1 (Q2)");
  // Q1 = +4, Q2 = -1 => MCQ total = 3
  testAssert(mcqScore.totalScore === 3, `MCQ total score is 3 (+4 - 1 = 3), got ${mcqScore.totalScore}`);

  // Final submission: Total = MCQ (3) + Coding (10) = 13
  const submitResult = await submitContestExam({
    contest_id: contest.id,
    user_id: testStudentId,
    reason: "manual",
  });
  testAssert(submitResult.success, "Exam submitted successfully");
  testAssert(submitResult.score !== null, "Submit result contains score object");
  testAssert(submitResult.score!.totalScore === 13, `Total score is exactly 13 (3 MCQ + 10 Coding), got ${submitResult.score!.totalScore}`);
  testAssert(submitResult.participant!.score === 13, `Participant record score updated to 13, got ${submitResult.participant!.score}`);
  testAssert(submitResult.participant!.status === "submitted", "Participant status is 'submitted'");

  // ── 5. Realtime Leaderboard Propagation ──
  console.log("\n── 5. Authoritative Leaderboard Propagation ──");
  const leaderboard = await getContestLeaderboard(contest.id, testStudentId, "admin");
  testAssert(leaderboard.totalParticipants >= 1, "Leaderboard includes participants");
  const studentEntry = leaderboard.leaderboard.find((e) => e.user_id === testStudentId);
  testAssert(!!studentEntry, "Student entry exists in leaderboard");
  testAssert(studentEntry!.total_score === 13, `Leaderboard reflects exact authoritative score of 13, got ${studentEntry!.total_score}`);
  testAssert(studentEntry!.solved_count === 2, `Leaderboard reflects 2 solved problems (Q1 + CodeQ), got ${studentEntry!.solved_count}`);
  testAssert(studentEntry!.rank === 1, "Student ranked #1 on leaderboard");

  // ── 6. Idempotent Double-Submission Protection ──
  console.log("\n── 6. Idempotent Double-Submission ──");
  const doubleSubmit = await submitContestExam({
    contest_id: contest.id,
    user_id: testStudentId,
    reason: "manual",
  });
  testAssert(doubleSubmit.success, "Double-submission handled gracefully");
  testAssert(doubleSubmit.score!.totalScore === 13, "Double-submission score remains strictly 13");
  testAssert(doubleSubmit.error === "Exam has already been submitted.", "Returns informative already_submitted message");

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} MASTER SCORING & AUTOSAVE ASSERTIONS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
