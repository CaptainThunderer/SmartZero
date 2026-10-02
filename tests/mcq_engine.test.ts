/**
 * SmartZero 2.0 — Phase 6 MCQ Contest Engine Test Suite
 *
 * Verifies:
 * 1. Sanitization of student questions (zero leak of is_correct / explanation)
 * 2. Real-time answer recording & autosave state
 * 3. Updating and clearing student answer selections
 * 4. "Mark for Review" toggling
 * 5. Rejection of answers when contest is ENDED
 * 6. Deterministic scoring with positive marks and negative penalty marking
 * 7. Exam finalization, locking out subsequent answers
 * 8. Idempotent submission handling
 *
 * Run: npx tsx tests/mcq_engine.test.ts
 */

import {
  createContest,
  addMcqQuestion,
  linkQuestionToContest,
  getContestQuestions,
  registerContestParticipant,
  recordMcqAnswer,
  getStudentAnswers,
  calculateStudentMcqScore,
  submitContestExam,
  getParticipant,
} from "../lib/contest/service";

console.log("▶ Running SmartZero Phase 6 MCQ Contest Engine Tests...\n");

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
  const contestPasscode = "MCQ_ENGINE_TEST_PASS";

  // ── 1. Create Contest & Questions ──
  console.log("── 1. Contest & MCQ Question Provisioning ──");
  const contest = await createContest({
    title: "Data Structures Diagnostic 2026",
    slug: "ds-diagnostic-2026",
    passcode: contestPasscode,
    start_at: new Date(now - 600000).toISOString(), // started 10m ago (LIVE)
    end_at: new Date(now + 3600000).toISOString(),  // ends in 60m
    duration_minutes: 60,
    status: "PUBLISHED",
    negative_marking: true,
    default_negative_mark: 1,
  });

  // Question 1: 4 marks, -1 penalty
  const q1 = await addMcqQuestion({
    prompt: "What is the amortized time complexity of inserting into a dynamic array?",
    explanation: "Dynamic array doubling gives O(1) amortized insertion.",
    options: [
      { option_text: "O(1)", is_correct: true, sort_order: 0 },
      { option_text: "O(n)", is_correct: false, sort_order: 1 },
      { option_text: "O(log n)", is_correct: false, sort_order: 2 },
      { option_text: "O(n^2)", is_correct: false, sort_order: 3 },
    ],
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: q1.id,
    question_type: "mcq",
    sort_order: 0,
    marks: 4,
    negative_marks: 1,
  });

  // Question 2: 4 marks, -1 penalty
  const q2 = await addMcqQuestion({
    prompt: "Which data structure is typically used to implement a Breadth-First Search (BFS)?",
    explanation: "BFS utilizes a FIFO Queue.",
    options: [
      { option_text: "Stack", is_correct: false, sort_order: 0 },
      { option_text: "Queue", is_correct: true, sort_order: 1 },
      { option_text: "Min-Heap", is_correct: false, sort_order: 2 },
      { option_text: "Binary Search Tree", is_correct: false, sort_order: 3 },
    ],
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: q2.id,
    question_type: "mcq",
    sort_order: 1,
    marks: 4,
    negative_marks: 1,
  });

  // Question 3: 2 marks, -1 penalty
  const q3 = await addMcqQuestion({
    prompt: "What is the worst-case time complexity of QuickSort?",
    explanation: "Worst case when array is already sorted or reverse sorted with bad pivot is O(n^2).",
    options: [
      { option_text: "O(n log n)", is_correct: false, sort_order: 0 },
      { option_text: "O(n^2)", is_correct: true, sort_order: 1 },
      { option_text: "O(n)", is_correct: false, sort_order: 2 },
      { option_text: "O(log n)", is_correct: false, sort_order: 3 },
    ],
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: q3.id,
    question_type: "mcq",
    sort_order: 2,
    marks: 2,
    negative_marks: 1,
  });

  testAssert(q1.options?.length === 4, "Question 1 has 4 options");
  testAssert(q2.options?.length === 4, "Question 2 has 4 options");
  testAssert(q3.options?.length === 4, "Question 3 has 4 options");

  // ── 2. Zero-Leakage Sanitization Verification ──
  console.log("\n── 2. Zero-Leakage Student Sanitization ──");
  const studentQuestions = await getContestQuestions(contest.id, "student");
  testAssert(studentQuestions.length === 3, "Retrieved 3 questions for student");

  studentQuestions.forEach((sq, idx) => {
    testAssert(sq.mcq_details?.explanation === undefined, `Q${idx + 1}: Explanation stripped for student`);
    sq.mcq_details?.options?.forEach((opt, optIdx) => {
      testAssert(opt.is_correct === undefined, `Q${idx + 1} Opt ${optIdx}: is_correct stripped`);
    });
  });

  // ── 3. Student Registration & Autosave Flow ──
  console.log("\n── 3. Student Registration & Answer Recording ──");
  const studentId = "student-eval-bob-200";
  const reg = await registerContestParticipant({
    contest_id: contest.id,
    user_id: studentId,
    passcode: contestPasscode,
  });
  testAssert(reg.participant !== null, "Bob registered as participant");

  const q1CorrectOptId = q1.options![0].id;
  const q1WrongOptId = q1.options![1].id;
  const q2WrongOptId = q2.options![0].id;

  // Answer Q1 with correct answer
  const ans1 = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q1.id,
    selected_option_id: q1CorrectOptId,
  });
  testAssert(ans1.answer !== null, "Answer 1 recorded successfully");
  testAssert(ans1.answer?.selected_option_id === q1CorrectOptId, "Selected option saved");

  // Participant status should transition to 'in_exam'
  const partCheck = await getParticipant(contest.id, studentId);
  testAssert(partCheck?.status === "in_exam", "Participant status transitions to 'in_exam'");

  // Answer Q2 with incorrect answer
  const ans2 = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q2.id,
    selected_option_id: q2WrongOptId,
    is_marked_for_review: true,
  });
  testAssert(ans2.answer?.is_marked_for_review === true, "Q2 marked for review");

  // Check saved answers in store
  const savedAnswers = await getStudentAnswers(contest.id, studentId);
  testAssert(savedAnswers.length === 2, "Saved answers retrieved correctly");

  // ── 4. Modifying, Reviewing, and Clearing Responses ──
  console.log("\n── 4. Answer Modification & Clearing ──");
  // Change Q1 option
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q1.id,
    selected_option_id: q1WrongOptId,
  });
  let currentAnswers = await getStudentAnswers(contest.id, studentId);
  let q1Ans = currentAnswers.find((a) => a.question_id === q1.id);
  testAssert(q1Ans?.selected_option_id === q1WrongOptId, "Q1 selection updated to new choice");

  // Revert back to correct option
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q1.id,
    selected_option_id: q1CorrectOptId,
  });

  // Clear choice for Q2
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q2.id,
    selected_option_id: null,
  });
  currentAnswers = await getStudentAnswers(contest.id, studentId);
  let q2Ans = currentAnswers.find((a) => a.question_id === q2.id);
  testAssert(q2Ans?.selected_option_id === null, "Q2 selection cleared");

  // Set Q2 back to wrong option for scoring test
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q2.id,
    selected_option_id: q2WrongOptId,
  });

  // Toggle marked for review on Q1
  await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q1.id,
    selected_option_id: q1CorrectOptId,
    is_marked_for_review: true,
  });
  currentAnswers = await getStudentAnswers(contest.id, studentId);
  q1Ans = currentAnswers.find((a) => a.question_id === q1.id);
  testAssert(q1Ans?.is_marked_for_review === true, "Q1 marked for review preserved");

  // ── 5. Server-Authoritative Scoring Engine ──
  console.log("\n── 5. Server-Authoritative Scoring Engine ──");
  // Expected:
  // Q1: Correct (+4 marks)
  // Q2: Incorrect (-1 penalty)
  // Q3: Unanswered (0 marks)
  // Total expected score: 4 - 1 = 3 marks
  const scoreResult = await calculateStudentMcqScore(contest.id, studentId);
  testAssert(scoreResult.answeredCount === 2, "2 questions answered");
  testAssert(scoreResult.correctCount === 1, "1 question correct (Q1)");
  testAssert(scoreResult.incorrectCount === 1, "1 question incorrect (Q2)");
  testAssert(scoreResult.totalScore === 3, "Total score is 3 (4 - 1 penalty)");

  // ── 6. Final Exam Submission & Answer Locking ──
  console.log("\n── 6. Exam Finalization & Locking ──");
  const submission = await submitContestExam({
    contest_id: contest.id,
    user_id: studentId,
  });
  testAssert(submission.success === true, "Exam submitted successfully");
  testAssert(submission.participant?.status === "submitted", "Participant status is 'submitted'");
  testAssert(submission.participant?.score === 3, "Participant final score saved as 3");

  // Attempting to submit again is idempotent and non-destructive
  const repeatSub = await submitContestExam({
    contest_id: contest.id,
    user_id: studentId,
  });
  testAssert(repeatSub.success === true, "Repeat submission handled gracefully");
  testAssert(repeatSub.error === "Exam has already been submitted.", "Informs caller already submitted");
  testAssert(repeatSub.score?.totalScore === 3, "Score remains consistent");

  // Attempting to modify answers AFTER submission must be REJECTED!
  const lateAnswer = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: studentId,
    question_id: q3.id,
    selected_option_id: q3.options![1].id,
  });
  testAssert(lateAnswer.answer === null, "Answer after submission rejected");
  testAssert(lateAnswer.error === "Exam has already been submitted.", "Clear rejection message");

  // ── 7. Submission Rejection on Ended Contest ──
  console.log("\n── 7. Expired Contest Submission Enforcement ──");
  const expiredContest = await createContest({
    title: "Expired Contest",
    passcode: "EXPIRED_PASS",
    start_at: new Date(now - 7200000).toISOString(), // 2 hours ago
    end_at: new Date(now - 3600000).toISOString(),   // 1 hour ago (ENDED)
    duration_minutes: 60,
    status: "PUBLISHED",
  });

  const expiredStudent = "student-late-999";
  const lateAttempt = await recordMcqAnswer({
    contest_id: expiredContest.id,
    user_id: expiredStudent,
    question_id: q1.id,
    selected_option_id: q1CorrectOptId,
  });
  testAssert(lateAttempt.answer === null, "Answer rejected when contest is ENDED");
  testAssert(lateAttempt.error === "Contest has ended. Submissions are closed.", "Rejection on ended contest verified");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 6 MCQ ENGINE TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
