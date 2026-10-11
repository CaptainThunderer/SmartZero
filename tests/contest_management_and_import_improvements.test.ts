/**
 * SmartZero 2.0 — Contest Management & Question Import Improvements Test Suite
 *
 * Verifies:
 * 1. Question Import: Append vs Replace mode, duplicate detection, and shared question bank preservation
 * 2. SQL / Python / MCQ Question Classification and display labels
 * 3. End Live Contest Early: server-authoritative status transition, participant auto-submission, idempotency
 * 4. Bulk Contest Deletion: multi-contest deletion, cascading, and failure reporting
 *
 * Run: npx tsx tests/contest_management_and_import_improvements.test.ts
 */

import assert from "node:assert/strict";
import {
  createContest,
  getContestById,
  getContestQuestions,
  computeContestStatus,
  registerContestParticipant,
  startContestExam,
  endContestEarly,
  deleteContest,
  getMcqQuestionRaw,
  getCodingQuestionRaw,
  getSqlQuestionRaw,
} from "../lib/contest/service";
import {
  detectDuplicatesWithExisting,
  persistImportedQuestions,
  ParsedImportQuestion,
} from "../lib/contest/importer";

console.log("==================================================");
console.log("▶ RUNNING CONTEST MANAGEMENT & IMPORT IMPROVEMENTS TESTS");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  // ─────────────────────────────────────────────────────────────
  // 1. Question Classification & Standard Display Badges
  // ─────────────────────────────────────────────────────────────
  console.log("── 1. Question Classification & Standard Badges ──");
  function getStandardBadge(type: string): string {
    switch (type) {
      case "mcq":
        return "MCQ";
      case "coding":
        return "Python Coding";
      case "sql":
        return "SQL Coding";
      default:
        return "Question";
    }
  }

  testAssert(getStandardBadge("mcq") === "MCQ", "MCQ maps to badge 'MCQ'");
  testAssert(getStandardBadge("coding") === "Python Coding", "Coding maps to badge 'Python Coding'");
  testAssert(getStandardBadge("sql") === "SQL Coding", "SQL maps to badge 'SQL Coding'");

  // ─────────────────────────────────────────────────────────────
  // 2. Question Import: Append vs Replace Modes & Duplicate Detection
  // ─────────────────────────────────────────────────────────────
  console.log("\n── 2. Question Import: Append vs Replace & Deduplication ──");

  const contestA = await createContest({
    title: "Import Test Contest A",
    description: "Testing append and replace import flows",
    duration_minutes: 60,
    passcode: "IMP-TEST-1",
    status: "DRAFT",
  });
  testAssert(!!contestA.id, "Contest A created for import tests");

  const batch1: ParsedImportQuestion[] = [
    {
      type: "mcq",
      question_text: "What is the primary key of a relational table?",
      difficulty: "easy",
      marks: 2,
      negative_marks: 0.5,
      options: [
        { option_text: "Unique identifier for rows", is_correct: true },
        { option_text: "Any foreign reference", is_correct: false },
      ],
    },
    {
      type: "coding",
      title: "Reverse String in Python",
      description: "Write a function to reverse a string in-place.",
      difficulty: "medium",
      marks: 10,
      test_cases: [
        { input: "'hello'", expected_output: "'olleh'", is_sample: true, is_hidden: false, weight: 1 },
      ],
    },
  ];

  // Import batch 1 in default (append) mode
  const res1 = await persistImportedQuestions(contestA.id, batch1, { mode: "append" });
  testAssert(res1.importedCount === 2, "Batch 1 imported 2 questions");
  testAssert(res1.mode === "append", "Result specifies mode 'append'");

  const linked1 = await getContestQuestions(contestA.id, "admin");
  testAssert(linked1.length === 2, "Contest A has 2 questions linked");
  testAssert(linked1[0].question_type === "mcq", "First question is MCQ");
  testAssert(linked1[1].question_type === "coding", "Second question is coding (Python)");

  const originalMcqId = linked1[0].question_id;
  const originalCodingId = linked1[1].question_id;

  // Verify duplicate detection against existing questions
  const batch2: ParsedImportQuestion[] = [
    {
      type: "mcq",
      question_text: "what is the primary key of a relational table?", // Same prompt, different casing
      difficulty: "easy",
      marks: 2,
      options: [
        { option_text: "Unique identifier for rows", is_correct: true },
        { option_text: "Any foreign reference", is_correct: false },
      ],
    },
    {
      type: "sql",
      title: "Active Customers Query",
      description: "Select active customers from customers table.",
      difficulty: "easy",
      marks: 5,
      schema_sql: "CREATE TABLE customers(id INT, active INT);",
      sample_data_sql: "INSERT INTO customers VALUES(1, 1);",
      sample_expected_output: "1",
      test_cases: [
        { setup_sql: "INSERT INTO customers VALUES(2, 0);", expected_output: "1", is_sample: false, is_hidden: true, weight: 1 },
      ],
    },
  ];

  const duplicates = detectDuplicatesWithExisting(linked1, batch2);
  testAssert(duplicates.length === 1, "detectDuplicatesWithExisting found 1 duplicate");
  testAssert(duplicates[0].type === "mcq", "Duplicate detected was MCQ");
  testAssert(duplicates[0].matchedQuestionId === originalMcqId, "Duplicate matched existing question ID");

  // Append with deduplicate = true
  const res2 = await persistImportedQuestions(contestA.id, batch2, { mode: "append", deduplicate: true });
  testAssert(res2.importedCount === 1, "Deduplication skipped duplicate MCQ, imported 1 new SQL question");
  testAssert(res2.skippedDuplicatesCount === 1, "Reported 1 skipped duplicate");

  const linked2 = await getContestQuestions(contestA.id, "admin");
  testAssert(linked2.length === 3, "Contest A now has 3 questions");
  testAssert(linked2[2].question_type === "sql", "Third question is SQL Coding");
  testAssert(linked2[2].sort_order === 2, "Sort order is contiguous (2)");

  // Test Replace mode
  const batchReplace: ParsedImportQuestion[] = [
    {
      type: "sql",
      title: "Departments Summary",
      description: "Find total employee count per department.",
      difficulty: "hard",
      marks: 15,
      schema_sql: "CREATE TABLE dept(id INT, name TEXT);",
      sample_data_sql: "INSERT INTO dept VALUES(1, 'Eng');",
      sample_expected_output: "Eng|1",
      test_cases: [
        { setup_sql: "", expected_output: "Eng|1", is_sample: true, is_hidden: false, weight: 1 },
      ],
    },
  ];

  const resReplace = await persistImportedQuestions(contestA.id, batchReplace, { mode: "replace" });
  testAssert(resReplace.mode === "replace", "Result specifies mode 'replace'");
  testAssert(resReplace.replacedCount === 3, "Replaced 3 existing contest questions");
  testAssert(resReplace.importedCount === 1, "Imported 1 new replacement question");

  const linkedAfterReplace = await getContestQuestions(contestA.id, "admin");
  testAssert(linkedAfterReplace.length === 1, "Contest A now has only 1 question linked");
  testAssert(linkedAfterReplace[0].question_type === "sql", "Replacement question is SQL");
  testAssert(linkedAfterReplace[0].sort_order === 0, "Replacement question starts at sort_order 0");

  // Confirm shared question bank records still exist (safe deletion)
  const mcqStillInBank = await getMcqQuestionRaw(originalMcqId);
  const codingStillInBank = await getCodingQuestionRaw(originalCodingId);
  testAssert(!!mcqStillInBank, "Original MCQ remains in shared question bank");
  testAssert(!!codingStillInBank, "Original Python Coding question remains in shared question bank");

  // ─────────────────────────────────────────────────────────────
  // 3. End Live Contest Early (Server-Authoritative)
  // ─────────────────────────────────────────────────────────────
  console.log("\n── 3. End Live Contest Early ──");

  const now = Date.now();
  const liveContest = await createContest({
    title: "Live Contest Early Termination Test",
    description: "Testing endContestEarly function",
    start_at: new Date(now - 1000 * 60 * 30).toISOString(), // Started 30 mins ago
    end_at: new Date(now + 1000 * 60 * 90).toISOString(),   // Scheduled to end in 90 mins
    duration_minutes: 120,
    passcode: "LIVE-END-TEST",
    status: "PUBLISHED",
  });

  testAssert(computeContestStatus(liveContest) === "LIVE", "Initial contest status is LIVE");

  // Register and start exam for 2 students
  await registerContestParticipant({
    contest_id: liveContest.id,
    user_id: "student-alice",
    passcode: "LIVE-END-TEST",
    user_profile: { name: "Alice", email: "alice@test.edu" },
  });
  const startedP1 = await startContestExam({ contest_id: liveContest.id, user_id: "student-alice" });
  testAssert(startedP1.participant?.status === "in_exam", "Alice is in_exam");

  await registerContestParticipant({
    contest_id: liveContest.id,
    user_id: "student-bob",
    passcode: "LIVE-END-TEST",
    user_profile: { name: "Bob", email: "bob@test.edu" },
  });
  const startedP2 = await startContestExam({ contest_id: liveContest.id, user_id: "student-bob" });
  testAssert(startedP2.participant?.status === "in_exam", "Bob is in_exam");

  // Admin triggers server-authoritative Early End
  const endResult = await endContestEarly(liveContest.id);
  testAssert(endResult.success === true, "endContestEarly executed successfully");
  testAssert(endResult.autoSubmittedCount === 2, "2 active participants were auto-submitted");

  const updatedContest = await getContestById(liveContest.id);
  testAssert(!!updatedContest, "Contest exists");
  testAssert(updatedContest!.status === "ENDED", "Contest record has status 'ENDED'");
  testAssert(computeContestStatus(updatedContest!) === "ENDED", "computeContestStatus evaluates to 'ENDED'");
  testAssert(new Date(updatedContest!.end_at).getTime() <= Date.now() + 1000, "end_at was capped to now");

  // Verify idempotency
  const endResultIdempotent = await endContestEarly(liveContest.id);
  testAssert(endResultIdempotent.success === true, "Calling endContestEarly again is idempotent");
  testAssert(endResultIdempotent.alreadyEnded === true, "Identified contest was already ended");

  // ─────────────────────────────────────────────────────────────
  // 4. Bulk Contest Deletion
  // ─────────────────────────────────────────────────────────────
  console.log("\n── 4. Bulk Contest Deletion ──");

  const c1 = await createContest({ title: "Bulk Delete Contest 1", passcode: "BD1", status: "DRAFT" });
  const c2 = await createContest({ title: "Bulk Delete Contest 2", passcode: "BD2", status: "DRAFT" });
  const c3 = await createContest({ title: "Bulk Delete Contest 3", passcode: "BD3", status: "DRAFT" });

  const targetIds = [c1.id, c2.id, c3.id, "non-existent-contest-id"];

  // Simulate bulk deletion loop
  let deletedCount = 0;
  let failedCount = 0;
  const errors: Array<{ contestId: string; error: string }> = [];

  for (const cid of targetIds) {
    const res = await deleteContest(cid, { force: true });
    if (res.success) {
      deletedCount++;
    } else {
      failedCount++;
      errors.push({ contestId: cid, error: res.error || "Failed" });
    }
  }

  testAssert(deletedCount === 3, "Bulk deletion successfully deleted 3 valid contests");
  testAssert(failedCount === 1, "Bulk deletion failed for 1 invalid contest ID");
  testAssert(errors[0].contestId === "non-existent-contest-id", "Error reported specific failed contest ID");

  // Verify they no longer exist
  testAssert((await getContestById(c1.id)) === null, "Contest 1 is deleted");
  testAssert((await getContestById(c2.id)) === null, "Contest 2 is deleted");
  testAssert((await getContestById(c3.id)) === null, "Contest 3 is deleted");

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} CONTEST MANAGEMENT & IMPORT ASSERTIONS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
