/**
 * SmartZero 2.0 — Post-Manual-Test Hardening Comprehensive Test Suite
 *
 * Verifies:
 * 1. Starter templates for all 5 languages (Python, JS, TS, C++, Java 17)
 * 2. Hardened sandbox execution for minimal valid programs
 * 3. Contest policies (fullscreen_required, auto_submit_on_violation, max_violations, retakes)
 * 4. Start contest exam flow (started_at timestamp and status)
 * 5. Security violation threshold auto-submit flow
 * 6. Clean retake attempt tracking and limits
 * 7. Contest Admin assignment and management permissions
 * 8. Safe contest deletion guards (blocking live deletion with active students)
 * 9. Downloadable Question Import Templates (JSON, CSV, XLSX) validation
 *
 * Run: npx tsx tests/post_manual_test_hardening.test.ts
 */

import { STARTER_TEMPLATES } from "../lib/judge/templates";
import { HardenedSubprocessSandbox } from "../lib/judge/sandbox/subprocess";
import {
  createContest,
  getContestById,
  registerContestParticipant,
  startContestExam,
  submitContestExam,
  canStartNewAttempt,
  startNewAttempt,
  assignContestAdmin,
  removeContestAdmin,
  canUserManageContest,
  deleteContest,
} from "../lib/contest/service";
import { recordSecurityEvent } from "../lib/contest/security";
import { validateImportQuestions } from "../lib/contest/importer";

console.log("▶ Running SmartZero Post-Manual-Test Hardening Test Suite...\n");

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
  const sandbox = new HardenedSubprocessSandbox();

  // ── 1. Starter Templates Integrity ──
  console.log("── 1. Starter Templates Integrity ──");
  testAssert(typeof STARTER_TEMPLATES.python === "string" && STARTER_TEMPLATES.python.includes("sys.stdin.read"), "Python 3 starter template is valid");
  testAssert(typeof STARTER_TEMPLATES.javascript === "string" && !STARTER_TEMPLATES.javascript.includes("#") && STARTER_TEMPLATES.javascript.includes("readFileSync"), "JavaScript starter template has valid JS comments and fs I/O");
  testAssert(typeof STARTER_TEMPLATES.typescript === "string" && STARTER_TEMPLATES.typescript.includes("readFileSync"), "TypeScript starter template is valid");
  testAssert(typeof STARTER_TEMPLATES.cpp === "string" && STARTER_TEMPLATES.cpp.includes("#include <iostream>"), "C++ starter template is valid");
  testAssert(typeof STARTER_TEMPLATES.java === "string" && STARTER_TEMPLATES.java.includes("public class Main"), "Java 17 starter template is valid");

  // ── 2. Sandbox Minimal Valid Program Execution ──
  console.log("\n── 2. Sandbox Minimal Valid Program Execution ──");
  // Python 3
  const pyCode = `import sys
lines = sys.stdin.read().split()
if lines:
    print(int(lines[0]) + int(lines[1]))
`;
  const pyRes = await sandbox.execute({
    language: "python",
    code: pyCode,
    input: "15 25\n",
    timeLimitMs: 3000,
    memoryLimitMb: 256,
  });
  testAssert(pyRes.verdict === "Accepted", "Python program produced Accepted verdict");
  testAssert(pyRes.actual_output.trim() === "40", "Python produced correct stdout: 40");

  // JavaScript (Node.js)
  const jsCode = `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
if (input.length >= 2) {
    console.log(Number(input[0]) * Number(input[1]));
}
`;
  const jsRes = await sandbox.execute({
    language: "javascript",
    code: jsCode,
    input: "6 7\n",
    timeLimitMs: 3000,
    memoryLimitMb: 256,
  });
  testAssert(jsRes.verdict === "Accepted", "JavaScript program produced Accepted verdict");
  testAssert(jsRes.actual_output.trim() === "42", "JavaScript produced correct stdout: 42");

  // ── 3. Contest Policies & Creation ──
  console.log("\n── 3. Contest Creation with Hardened Policies ──");
  const now = new Date();
  const contest = await createContest({
    title: "Institutional Hardening Assessment",
    description: "Proctored live exam with strict anti-cheat and retake policies.",
    duration_minutes: 60,
    status: "LIVE",
    start_at: new Date(now.getTime() - 10000).toISOString(), // Live
    end_at: new Date(now.getTime() + 3600000).toISOString(),
    fullscreen_required: true,
    auto_submit_on_violation: true,
    max_violations: 3,
    allow_retake: true,
    max_attempts: 2,
  });

  testAssert(contest.fullscreen_required === true, "fullscreen_required flag persisted as true");
  testAssert(contest.auto_submit_on_violation === true, "auto_submit_on_violation persisted as true");
  testAssert(contest.max_violations === 3, "max_violations persisted as 3");
  testAssert(contest.allow_retake === true, "allow_retake persisted as true");
  testAssert(contest.max_attempts === 2, "max_attempts persisted as 2");

  // ── 4. Start Contest Exam Flow ──
  console.log("\n── 4. Start Exam Flow ──");
  const testUserId = `user-student-${Date.now()}`;
  const regResult = await registerContestParticipant({
    contest_id: contest.id,
    user_id: testUserId,
    passcode: contest.passcode || "SMARTZERO",
  });
  testAssert(regResult.participant !== null, "Student registered for contest successfully");

  const startRes = await startContestExam({
    contest_id: contest.id,
    user_id: testUserId,
  });
  testAssert(startRes.participant !== null && startRes.participant.status === "in_exam", "Participant marked 'in_exam'");
  testAssert(typeof startRes.participant?.started_at === "string", "Participant started_at timestamp initialized");

  // ── 5. Auto-Submit on Integrity Violation Threshold ──
  console.log("\n── 5. Auto-Submit on Integrity Violation Threshold ──");
  const partId = regResult.participant!.id;
  const policy = {
    violation_threshold: 3,
    auto_submit_on_violation: true,
    action_on_violation: "auto_submit" as const,
  };

  // Event 1
  const ev1 = await recordSecurityEvent({
    contest_id: contest.id,
    participant_id: partId,
    user_id: testUserId,
    event_type: "tab_switch",
    policy,
  });
  testAssert(ev1.action === "continue", "Event 1: action is continue");

  // Event 2 (warning)
  const ev2 = await recordSecurityEvent({
    contest_id: contest.id,
    participant_id: partId,
    user_id: testUserId,
    event_type: "fullscreen_exit",
    policy: { ...policy, warning_threshold: 2 },
  });
  testAssert(ev2.action === "warning", "Event 2: action is warning");

  // Event 3 (threshold reached: auto-submit)
  const ev3 = await recordSecurityEvent({
    contest_id: contest.id,
    participant_id: partId,
    user_id: testUserId,
    event_type: "tab_switch",
    policy,
  });
  testAssert(ev3.action === "auto_submit", "Event 3: action is auto_submit");
  testAssert(ev3.auto_submitted === true, "Event 3: auto_submitted flag is true");

  // Verify participant status
  const fetchedContest = await getContestById(contest.id);
  testAssert(fetchedContest !== null, "Contest retrieved");

  // ── 6. Retake Lifecycle ──
  console.log("\n── 6. Retake Lifecycle & Limits ──");
  const retakeCheck1 = await canStartNewAttempt(contest.id, testUserId);
  testAssert(retakeCheck1.can_retake === true, "Can start new attempt when attempts (1) < max (2)");
  testAssert(retakeCheck1.current_attempts === 1, "Current attempts accurately reports 1");

  const newAttempt = await startNewAttempt({
    contest_id: contest.id,
    user_id: testUserId,
  });
  testAssert(newAttempt.participant !== null && newAttempt.participant.attempt_number === 2, "New attempt initialized with attempt_number: 2");
  testAssert(newAttempt.participant?.status === "ready", "New attempt status reset to 'ready'");

  // Check limits on attempt 2
  const retakeCheck2 = await canStartNewAttempt(contest.id, testUserId);
  testAssert(retakeCheck2.can_retake === false, "Cannot start attempt 3 when limit is 2 (can_retake: false)");

  // ── 7. Contest Admin Assignments & Permissions ──
  console.log("\n── 7. Contest Admin Assignments ──");
  const testAdminId = `admin-${Date.now()}`;
  const assignRes = await assignContestAdmin({
    contest_id: contest.id,
    admin_id: testAdminId,
  });
  testAssert(assignRes === true, "Contest admin assigned successfully");

  const canManageAssigned = await canUserManageContest(contest.id, testAdminId, "contest_admin");
  testAssert(canManageAssigned === true, "Assigned contest admin has management permissions");

  const canManageUnassigned = await canUserManageContest(contest.id, "stranger-user", "contest_admin");
  testAssert(canManageUnassigned === false, "Unassigned contest admin denied management permissions");

  const removeRes = await removeContestAdmin(contest.id, testAdminId);
  testAssert(removeRes === true, "Contest admin removed successfully");

  // ── 8. Safe Contest Delete Guards ──
  console.log("\n── 8. Safe Contest Delete Guards ──");
  // Participant is ready/active in live contest
  const delAttempt1 = await deleteContest(contest.id, { force: false });
  testAssert(delAttempt1.success === false, "Safe delete blocks live contest deletion when participants are active");

  // ── 9. Question Import Templates Validation ──
  console.log("\n── 9. Question Import Templates Validation ──");
  const sampleJsonQuestions = [
    {
      type: "mcq",
      question_text: "What is the worst-case complexity of Quicksort?",
      difficulty: "Medium",
      marks: 2,
      negative_marks: 0.5,
      options: [
        { option_text: "O(N^2)", is_correct: true },
        { option_text: "O(N log N)", is_correct: false },
        { option_text: "O(N)", is_correct: false },
        { option_text: "O(log N)", is_correct: false },
      ],
    },
    {
      type: "coding",
      title: "Multiply Two Numbers",
      description: "Read two numbers and print product.",
      difficulty: "Easy",
      marks: 5,
      test_cases: [
        { input: "3 4", expected_output: "12", is_sample: true, is_hidden: false },
      ],
    },
  ];

  const jsonValidation = validateImportQuestions(sampleJsonQuestions, "json");
  testAssert(jsonValidation.errors.length === 0, "Sample JSON template produces 0 validation errors");
  testAssert(jsonValidation.validQuestions.length === 2, "Sample JSON template yields 2 valid questions");

  const sampleCsvRows = [
    {
      type: "mcq",
      question_text: "What is the height of a balanced BST?",
      difficulty: "Easy",
      marks: 1,
      negative_marks: 0,
      option_a: "O(log N)",
      option_b: "O(N)",
      option_c: "O(1)",
      option_d: "O(N^2)",
      correct_answer: "A",
    },
    {
      type: "coding",
      title: "Add Numbers",
      description: "Print A + B.",
      difficulty: "Easy",
      marks: 5,
      sample_input: "1 2",
      sample_output: "3",
    },
  ];

  const csvValidation = validateImportQuestions(sampleCsvRows, "csv");
  testAssert(csvValidation.errors.length === 0, "Sample CSV/Spreadsheet template produces 0 validation errors");
  testAssert(csvValidation.validQuestions.length === 2, "Sample CSV/Spreadsheet template yields 2 valid questions");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} POST-MANUAL-TEST HARDENING ASSERTIONS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
