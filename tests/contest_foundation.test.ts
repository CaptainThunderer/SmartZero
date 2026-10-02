/**
 * SmartZero 2.0 — Phase 3 Contest & Admin Foundation Test Suite
 *
 * Run: npx tsx tests/contest_foundation.test.ts
 */

import assert from "node:assert/strict";
import {
  hashPasscode,
  verifyPasscode,
  generateContestSlug,
} from "../lib/contest/crypto";
import {
  createContest,
  getContestById,
  getContestBySlug,
  updateContest,
  computeContestStatus,
  addMcqQuestion,
  addCodingQuestion,
  linkQuestionToContest,
  getContestQuestions,
  reorderContestQuestions,
  registerContestParticipant,
  getParticipant,
} from "../lib/contest/service";

console.log("▶ Running SmartZero Phase 3 Contest & Admin Foundation Tests...\n");

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
  // ── 1. Passcode Hashing & Security ──
  console.log("── 1. Passcode Hashing & Security ──");
  const rawPasscode = "SECRET_PASS_2026";
  const hash = hashPasscode(rawPasscode);

  testAssert(hash !== rawPasscode, "Passcode is hashed, not plaintext");
  testAssert(hash.length === 64, "Passcode hash is 64-char SHA-256 hex digest");
  testAssert(verifyPasscode(rawPasscode, hash) === true, "verifyPasscode validates correct passcode");
  testAssert(verifyPasscode("WRONG_PASS", hash) === false, "verifyPasscode rejects invalid passcode");
  testAssert(verifyPasscode("", hash) === false, "verifyPasscode rejects empty string");

  const slug = generateContestSlug("Algorithms Championship 2026!");
  testAssert(slug.startsWith("algorithms-championship-2026"), "Slug generated cleanly from title");

  // ── 2. Server-Authoritative Timing Engine ──
  console.log("\n── 2. Server-Authoritative Timing Engine ──");
  const pastStart = new Date(Date.now() - 3600000).toISOString();
  const pastEnd = new Date(Date.now() - 1800000).toISOString();
  const futureStart = new Date(Date.now() + 1800000).toISOString();
  const futureEnd = new Date(Date.now() + 3600000).toISOString();
  const currentStart = new Date(Date.now() - 600000).toISOString();
  const currentEnd = new Date(Date.now() + 600000).toISOString();

  testAssert(
    computeContestStatus({ status: "DRAFT", start_at: currentStart, end_at: currentEnd }) === "DRAFT",
    "DRAFT status remains DRAFT regardless of clock"
  );
  testAssert(
    computeContestStatus({ status: "PUBLISHED", start_at: futureStart, end_at: futureEnd }) === "UPCOMING",
    "Future window computes UPCOMING"
  );
  testAssert(
    computeContestStatus({ status: "PUBLISHED", start_at: currentStart, end_at: currentEnd }) === "LIVE",
    "Current active window computes LIVE"
  );
  testAssert(
    computeContestStatus({ status: "PUBLISHED", start_at: pastStart, end_at: pastEnd }) === "ENDED",
    "Past window computes ENDED"
  );

  // ── 3. Contest Creation & Lifecycle ──
  console.log("\n── 3. Contest Creation & Lifecycle ──");
  const contest = await createContest({
    title: "National DSA Olympiad",
    description: "Official competitive assessment",
    passcode: "OLYMPIAD_PASS",
    start_at: currentStart,
    end_at: currentEnd,
    duration_minutes: 45,
    negative_marking: true,
    default_negative_mark: 0.5,
  });

  testAssert(Boolean(contest.id), "Contest ID assigned");
  testAssert(contest.status === "DRAFT", "Initial contest status is DRAFT");
  testAssert(contest.passcode_hash !== "OLYMPIAD_PASS", "Stored passcode is hashed");

  const fetchedById = await getContestById(contest.id);
  testAssert(fetchedById?.title === "National DSA Olympiad", "Contest retrieved by ID");

  const fetchedBySlug = await getContestBySlug(contest.slug);
  testAssert(fetchedBySlug?.id === contest.id, "Contest retrieved by slug");

  const published = await updateContest(contest.id, { status: "PUBLISHED" });
  testAssert(published?.status === "LIVE", "Published active contest transitions to LIVE via server clock");

  // ── 4. Question Creation & Student Sanitization (Zero Leakage) ──
  console.log("\n── 4. Question Creation & Zero-Leakage Sanitization ──");
  const mcq = await addMcqQuestion({
    question_text: "What is the worst-case time complexity of finding an element in a balanced BST?",
    explanation: "Because height is log(N), search is O(log N).",
    difficulty: "Medium",
    options: [
      { option_text: "O(1)", is_correct: false },
      { option_text: "O(log N)", is_correct: true },
      { option_text: "O(N)", is_correct: false },
      { option_text: "O(N^2)", is_correct: false },
    ],
  });

  const codingQ = await addCodingQuestion({
    title: "Two Sum",
    description: "Find indices that sum to target",
    test_cases: [
      { input: "[2,7,11,15], 9", expected_output: "[0,1]", is_sample: true, is_hidden: false },
      { input: "[3,2,4], 6", expected_output: "[1,2]", is_sample: false, is_hidden: true },
      { input: "[3,3], 6", expected_output: "[0,1]", is_sample: false, is_hidden: true },
    ],
  });

  const cq1 = await linkQuestionToContest({
    contest_id: contest.id,
    question_id: mcq.id,
    question_type: "mcq",
    marks: 2,
    negative_marks: 0.5,
    sort_order: 0,
  });

  const cq2 = await linkQuestionToContest({
    contest_id: contest.id,
    question_id: codingQ.id,
    question_type: "coding",
    marks: 10,
    sort_order: 1,
  });

  // Admin view: must retain full keys
  const adminQuestions = await getContestQuestions(contest.id, "admin");
  testAssert(adminQuestions.length === 2, "Admin receives all linked questions");
  const adminMcq = adminQuestions[0].mcq_details;
  testAssert(
    adminMcq?.options?.some((o) => o.is_correct === true) === true,
    "Admin view retains is_correct flag"
  );
  const adminCode = adminQuestions[1].coding_details;
  testAssert(adminCode?.test_cases?.length === 3, "Admin view retains all 3 test cases");

  // Student view: MUST NEVER LEAK is_correct OR hidden test cases
  const studentQuestions = await getContestQuestions(contest.id, "student");
  testAssert(studentQuestions.length === 2, "Student receives linked questions");
  const studentMcq = studentQuestions[0].mcq_details;
  testAssert(
    studentMcq?.options?.every((o) => o.is_correct === undefined) === true,
    "SECURITY: Student view STRIPS is_correct from all MCQ options"
  );
  testAssert(studentMcq?.explanation === undefined, "SECURITY: Student view STRIPS explanation");

  const studentCode = studentQuestions[1].coding_details;
  testAssert(
    studentCode?.test_cases?.length === 1,
    "SECURITY: Student view STRIPS all hidden test cases (only 1 sample retained)"
  );
  testAssert(studentCode?.test_cases?.[0].is_sample === true, "Retained test case is marked sample");

  // ── 5. Question Reordering ──
  console.log("\n── 5. Question Reordering ──");
  const reordered = await reorderContestQuestions(contest.id, [codingQ.id, mcq.id]);
  testAssert(reordered[0].question_id === codingQ.id, "First question is now codingQ");
  testAssert(reordered[0].sort_order === 0, "codingQ sort order updated to 0");
  testAssert(reordered[1].question_id === mcq.id, "Second question is now mcq");
  testAssert(reordered[1].sort_order === 1, "mcq sort order updated to 1");

  // ── 6. Participant Registration & Duplicate Prevention ──
  console.log("\n── 6. Participant Registration & Duplicate Prevention ──");
  const wrongRes = await registerContestParticipant({
    contest_id: contest.id,
    user_id: "student-user-1",
    passcode: "INCORRECT_PASSCODE",
  });
  testAssert(wrongRes.error !== null, "Wrong passcode rejected with error");
  testAssert(wrongRes.participant === null, "No participant created on wrong passcode");

  const correctRes = await registerContestParticipant({
    contest_id: contest.id,
    user_id: "student-user-1",
    passcode: "OLYMPIAD_PASS",
  });
  testAssert(correctRes.error === null, "Correct passcode accepted");
  testAssert(correctRes.participant?.user_id === "student-user-1", "Participant registered");

  // Duplicate registration must return existing record
  const dupRes = await registerContestParticipant({
    contest_id: contest.id,
    user_id: "student-user-1",
    passcode: "OLYMPIAD_PASS",
  });
  testAssert(dupRes.participant?.id === correctRes.participant?.id, "Duplicate registration returns existing participant");

  const retrievedPart = await getParticipant(contest.id, "student-user-1");
  testAssert(retrievedPart?.id === correctRes.participant?.id, "Participant retrieved by contest_id and user_id");

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  Phase 3 Contest Foundation: ${passed} passed, 0 failed`);
  console.log(`══════════════════════════════════════════════════\n`);
}

run();
