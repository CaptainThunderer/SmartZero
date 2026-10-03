import assert from "node:assert/strict";
import {
  createContest,
  addCodingQuestion,
  linkQuestionToContest,
  registerContestParticipant,
  startContestExam,
  getContestQuestions,
  calculateStudentCodingScore,
} from "../lib/contest/service";
import {
  judgeWorkerClient,
  JudgeUnavailableError,
  saveCodingDraft,
  saveCodingSubmission,
  getStudentSubmissions,
} from "../lib/judge/service";
import { HardenedSubprocessSandbox } from "../lib/judge/sandbox/subprocess";
import { defaultJudgeWorker, normalizeOutput } from "../lib/judge/worker/worker";
import { updateUserRoleAndStatus, provisionStaffAuthAccount } from "../lib/auth/roleService";
import { createStudentSessionToken } from "../lib/auth/studentSession";
import { POST as runCodeRoute } from "../app/api/contest/[slug]/coding/run/route";
import { POST as submitCodeRoute } from "../app/api/contest/[slug]/coding/submit/route";
import { PATCH as adminUsersPatchRoute } from "../app/api/admin/users/route";
import type { JudgeWorkerJobRequest, JudgeWorkerJobResponse, JudgeTestCase } from "../lib/judge/types";
import type { UserRole } from "../types/auth";

console.log("==================================================");
console.log("▶ RUNNING CODING IDE & STAFF PROVISIONING TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  const originalJudgeMode = process.env.SMARTZERO_JUDGE_MODE;

  try {
    // ════════════════════════════════════════════════════════════════
    // PART A1 — LOCAL MULTI-LANGUAGE JUDGE EXECUTION
    // ════════════════════════════════════════════════════════════════
    console.log("── 1. Local Judge Execution (Python, JS, TS) ──");
    process.env.SMARTZERO_JUDGE_MODE = "local";
    const sandbox = new HardenedSubprocessSandbox();

    // 1A. Python Run Code
    const pyRes = await sandbox.execute({
      language: "python",
      code: "a = int(input())\nb = int(input())\nprint(a + b)",
      input: "12\n34\n",
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });
    testAssert(pyRes.verdict === "Accepted", "Local Python execution succeeded");
    testAssert(normalizeOutput(pyRes.actual_output) === "46", "Python computed correct output (12 + 34 = 46)");

    // 1B. JavaScript (Node.js) Run Code
    const jsRes = await sandbox.execute({
      language: "javascript",
      code: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');
console.log(Number(input[0]) * Number(input[1]));`,
      input: "6\n7\n",
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });
    testAssert(jsRes.verdict === "Accepted", "Local JavaScript execution succeeded");
    testAssert(normalizeOutput(jsRes.actual_output) === "42", "JavaScript computed correct output (6 * 7 = 42)");

    // 1C. TypeScript Run Code
    const tsRes = await sandbox.execute({
      language: "typescript",
      code: `const fs = require('fs');
const input: string = fs.readFileSync(0, 'utf-8').trim();
console.log("HELLO_" + input.toUpperCase());`,
      input: "smartzero",
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    });
    testAssert(tsRes.verdict === "Accepted", "Local TypeScript execution succeeded");
    testAssert(normalizeOutput(tsRes.actual_output) === "HELLO_SMARTZERO", "TypeScript computed correct output");

    // 1D. Compilation Error Detection
    const pyCompileErr = await sandbox.execute({
      language: "python",
      code: "def broken(\n  return 1",
      input: "",
      timeLimitMs: 1000,
      memoryLimitMb: 128,
    });
    testAssert(
      pyCompileErr.verdict === "Compilation Error" || pyCompileErr.verdict === "Runtime Error",
      "Syntax error properly flagged as Compilation/Runtime Error"
    );

    // 1E. Runtime Error Detection
    const pyRuntimeErr = await sandbox.execute({
      language: "python",
      code: "x = 10 / 0\nprint(x)",
      input: "",
      timeLimitMs: 1000,
      memoryLimitMb: 128,
    });
    testAssert(pyRuntimeErr.verdict === "Runtime Error", "ZeroDivisionError flagged as Runtime Error");

    // 1F. Time Limit Exceeded (TLE)
    const pyTle = await sandbox.execute({
      language: "python",
      code: "import time\ntime.sleep(5)",
      input: "",
      timeLimitMs: 300,
      memoryLimitMb: 128,
    });
    testAssert(pyTle.verdict === "TLE", "Infinite sleep flagged as TLE");

    // ════════════════════════════════════════════════════════════════
    // PART A2 & A3 — PRODUCTION JUDGE FAIL-CLOSED & WORKER CONTRACT
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 2. Production Judge Fail-Closed & Worker Contract ──");
    process.env.SMARTZERO_JUDGE_MODE = "production";

    // 2A. Production mode refuses host execution without worker
    delete process.env.JUDGE_WORKER_URL;
    delete process.env.SMARTZERO_JUDGE_WORKER_URL;
    judgeWorkerClient.setCustomTransport(null);

    let prodUnavailableThrown = false;
    try {
      await judgeWorkerClient.executeJob({
        job_id: "test-prod-job-1",
        submission_id: "test-sub-1",
        contest_id: "contest-1",
        question_id: "q-1",
        language: "python",
        source_code: "print('malicious_host_probe')",
        execution_mode: "submit",
        test_cases: [
          {
            id: "tc-1",
            input: "test",
            expected_output: "test",
            weight: 1,
            is_sample: true,
            is_hidden: false,
          },
        ],
        time_limit_ms: 1000,
        memory_limit_mb: 256,
      });
    } catch (err: unknown) {
      if (err instanceof JudgeUnavailableError || (err as any)?.code === "JUDGE_UNAVAILABLE") {
        prodUnavailableThrown = true;
      }
    }
    testAssert(prodUnavailableThrown, "Production mode without worker strictly fails closed (JUDGE_UNAVAILABLE)");

    // 2B. Production mode communicates with dedicated judge worker via contract
    let capturedWorkerRequest: JudgeWorkerJobRequest | null = null;
    judgeWorkerClient.setCustomTransport(async (req) => {
      capturedWorkerRequest = req;
      return {
        job_id: req.job_id,
        submission_id: req.submission_id,
        status: "COMPLETED",
        verdict: "Accepted",
        passed_tests: 2,
        total_tests: 2,
        score: req.total_marks ?? 20,
        max_score: req.total_marks ?? 20,
        execution_time_ms: 45,
        memory_used_mb: 18,
        compile_output: "",
        test_results: [
          {
            index: 1,
            passed: true,
            verdict: "Accepted",
            execution_time_ms: 20,
            memory_kb: 4096,
            is_sample: true,
            input: "2 3",
            expected_output: "5",
            actual_output: "5",
          },
          {
            index: 2,
            passed: true,
            verdict: "Accepted",
            execution_time_ms: 25,
            memory_kb: 4096,
            is_sample: false, // HIDDEN TEST CASE
            input: "TOP_SECRET_INPUT_DO_NOT_LEAK",
            expected_output: "TOP_SECRET_EXPECTED",
            actual_output: "TOP_SECRET_ACTUAL",
          },
        ],
      };
    });

    const mockJobResp = await judgeWorkerClient.executeJob({
      job_id: "job-contract-verify",
      submission_id: "sub-contract-verify",
      contest_id: "contest-mock-1",
      question_id: "q-mock-1",
      language: "python",
      source_code: "a, b = map(int, input().split())\nprint(a + b)",
      execution_mode: "submit",
      test_cases: [
        { id: "tc-1", input: "2 3", expected_output: "5", weight: 1, is_sample: true, is_hidden: false },
        { id: "tc-2", input: "10 20", expected_output: "30", weight: 2, is_sample: false, is_hidden: true },
      ],
      time_limit_ms: 1000,
      memory_limit_mb: 256,
      total_marks: 30,
    });

    testAssert(capturedWorkerRequest !== null, "Dedicated worker received request via contract");
    testAssert(capturedWorkerRequest!.job_id === "job-contract-verify", "Worker request contains correct job_id");
    testAssert(mockJobResp.verdict === "Accepted", "Worker returned Accepted verdict");
    testAssert(mockJobResp.score === 30, "Worker returned score 30");

    // 2C. Hidden test cases sanitization protection (Zero Leakage)
    const hiddenResult = mockJobResp.test_results.find((tr) => !tr.is_sample);
    testAssert(hiddenResult !== undefined, "Hidden test result present in response");
    testAssert(hiddenResult!.input === undefined, "Hidden test input is strictly undefined (zero leakage)");
    testAssert(hiddenResult!.expected_output === undefined, "Hidden test expected_output is strictly undefined");
    testAssert(hiddenResult!.actual_output === undefined, "Hidden test actual_output is strictly undefined");
    testAssert(hiddenResult!.passed === true, "Hidden test pass status preserved");

    // ════════════════════════════════════════════════════════════════
    // PART A4, A5 & A10 — RUN CODE VS SUBMIT SCORING & PERSISTENCE
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 3. Run Code vs Submit Scoring & Persistence ──");
    process.env.SMARTZERO_JUDGE_MODE = "local";

    const testContest = await createContest({
      title: "Coding Evaluation Contest",
      description: "Testing Run Code vs Submit",
      start_at: new Date(Date.now() - 60000).toISOString(),
      end_at: new Date(Date.now() + 3600000).toISOString(),
      duration_minutes: 60,
      passcode: "EVAL_PASS",
      status: "PUBLISHED",
    });

    const testCodingQ = await addCodingQuestion({
      title: "Multiply by Two",
      description: "Return N * 2",
      difficulty: "Easy",
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      test_cases: [
        { id: "tc-sample-1", input: "5\n", expected_output: "10", weight: 1, is_sample: true, is_hidden: false },
        { id: "tc-hidden-1", input: "12\n", expected_output: "24", weight: 3, is_sample: false, is_hidden: true },
      ],
    });

    await linkQuestionToContest({
      contest_id: testContest.id,
      question_id: testCodingQ.id,
      question_type: "coding",
      marks: 10,
      negative_marks: 0,
      sort_order: 0,
    });

    const studentUserId = "student-eval-test-01";
    await registerContestParticipant({
      contest_id: testContest.id,
      user_id: studentUserId,
      passcode: "EVAL_PASS",
    });
    await startContestExam({ contest_id: testContest.id, user_id: studentUserId });

    // 3A. Run Code evaluates sample only, does not score
    const studentToken = createStudentSessionToken({
      sub: studentUserId,
      email: "eval_student@test.edu",
    });

    const runReq = new Request(`http://localhost/api/contest/${testContest.slug}/coding/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        question_id: testCodingQ.id,
        code: "n = int(input())\nprint(n * 2)",
        language: "python",
      }),
    });

    const runRes = await runCodeRoute(runReq, { params: Promise.resolve({ slug: testContest.slug }) });
    testAssert(runRes.status === 200, "Run Code returned 200 OK");
    const runData = await runRes.json();
    testAssert(runData.summary.verdict === "Accepted", "Run Code sample passed");
    testAssert(runData.summary.score === 0, "Run Code awarded 0 contest score");

    // Verify Run Code created NO submission record
    const postRunSubmissions = await getStudentSubmissions(testContest.id, studentUserId);
    testAssert(postRunSubmissions.length === 0, "Run Code created 0 persistent contest submissions");

    // 3B. Submit executes all tests and scores deterministically
    const submitReq = new Request(`http://localhost/api/contest/${testContest.slug}/coding/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        question_id: testCodingQ.id,
        code: "n = int(input())\nprint(n * 2)",
        language: "python",
      }),
    });

    const submitRes = await submitCodeRoute(submitReq, { params: Promise.resolve({ slug: testContest.slug }) });
    testAssert(submitRes.status === 200, "Submit returned 200 OK");
    const submitData = await submitRes.json();
    testAssert(submitData.submission.verdict === "Accepted", "Submit received Accepted verdict");
    testAssert(submitData.submission.score === 10, "Submit scored full marks (10/10)");

    // Verify submission record was persisted
    const postSubmitList = await getStudentSubmissions(testContest.id, studentUserId);
    testAssert(postSubmitList.length === 1, "Submit persisted exactly 1 official submission");
    testAssert(postSubmitList[0].score === 10, "Persisted submission has authoritative score of 10");

    // 3C. Coding Draft Autosave
    await saveCodingDraft({
      contest_id: testContest.id,
      user_id: studentUserId,
      question_id: testCodingQ.id,
      language: "python",
      code: "# In-progress student draft\nx = 10",
    });

    const draftsAndSubs = await getStudentSubmissions(testContest.id, studentUserId);
    const draftItem = draftsAndSubs.find((s) => s.verdict === "DRAFT");
    testAssert(draftItem !== undefined, "Draft saved in submissions store with verdict DRAFT");
    testAssert(draftItem!.score === 0, "Draft has strictly 0 score impact");

    // Calculate score ignores draft
    const totalCodingScore = await calculateStudentCodingScore(testContest.id, studentUserId);
    testAssert(totalCodingScore.totalScore === 10, "Authoritative score calculation evaluates only official submission (10 pts)");

    // ════════════════════════════════════════════════════════════════
    // PART B — STAFF PROVISIONING & AUTHENTICATION
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 4. Staff Account Provisioning (Super Admin) ──");

    const superAdminUserId = "super-admin-001";
    const targetStudentUserId = "test-student-prov-uuid-001";
    const targetStudentEmail = "provision_test_student@smartzero.edu";

    // 4A. Super Admin promotes student → admin
    const promoteAdminResult = await updateUserRoleAndStatus({
      callerUserId: superAdminUserId,
      callerRole: "super_admin",
      targetUserId: targetStudentUserId,
      newRole: "admin",
    });

    testAssert(promoteAdminResult.success, "Super Admin successfully promoted student to admin");
    testAssert(promoteAdminResult.user!.role === "admin", "User role updated to admin");
    testAssert(promoteAdminResult.provisioned === true, "Staff account provisioned flag returned true");
    testAssert(promoteAdminResult.temporary_password === "123456", "Initial temporary password is '123456'");

    // 4B. Direct unit test for provisionStaffAuthAccount
    const directProv = await provisionStaffAuthAccount({
      userId: targetStudentUserId,
      email: targetStudentEmail,
      fullName: "Staff Test Candidate",
      role: "admin",
    });
    testAssert(directProv.success === true, "provisionStaffAuthAccount returned success");
    testAssert(directProv.temporaryPassword === "123456", "provisionStaffAuthAccount set password '123456'");

    // 4C. Super Admin promotes student → contest_admin with contest assignments
    const promoteContestAdminResult = await updateUserRoleAndStatus({
      callerUserId: superAdminUserId,
      callerRole: "super_admin",
      targetUserId: targetStudentUserId,
      newRole: "contest_admin",
      contestIds: [testContest.id],
    });

    testAssert(promoteContestAdminResult.success, "Super Admin promoted user to contest_admin");
    testAssert(promoteContestAdminResult.user!.role === "contest_admin", "Role updated to contest_admin");
    testAssert(promoteContestAdminResult.provisioned === true, "Staff account provisioned for contest_admin");
    testAssert(
      promoteContestAdminResult.user!.assigned_contests?.includes(testContest.id) === true,
      "Contest assignment created for contest_admin"
    );

    // 4D. Demotion: contest_admin → student
    const demoteResult = await updateUserRoleAndStatus({
      callerUserId: superAdminUserId,
      callerRole: "super_admin",
      targetUserId: targetStudentUserId,
      newRole: "student",
    });

    testAssert(demoteResult.success, "User successfully demoted back to student");
    testAssert(demoteResult.user!.role === "student", "Role reverted to student");
    testAssert(
      (demoteResult.user!.assigned_contests || []).length === 0,
      "Contest assignments completely cleared on demotion"
    );

    // 4E. Security Guards: Admin cannot promote to admin or super_admin
    const rogueAdminResult = await updateUserRoleAndStatus({
      callerUserId: "rogue-admin-002",
      callerRole: "admin",
      targetUserId: targetStudentUserId,
      newRole: "admin",
    });
    testAssert(!rogueAdminResult.success, "Normal Admin cannot promote user to admin (403 Forbidden)");
    testAssert(rogueAdminResult.status === 403, "Returned HTTP 403 Forbidden");

    const rogueSuperAdminResult = await updateUserRoleAndStatus({
      callerUserId: "rogue-admin-002",
      callerRole: "admin",
      targetUserId: targetStudentUserId,
      newRole: "super_admin",
    });
    testAssert(!rogueSuperAdminResult.success, "Normal Admin cannot promote user to super_admin (403 Forbidden)");

    // 4F. Security Guards: Student cannot call provisioning API
    const studentProvReq = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        target_user_id: targetStudentUserId,
        role: "admin",
      }),
    });
    const studentProvRes = await adminUsersPatchRoute(studentProvReq);
    testAssert(studentProvRes.status === 403, "Student calling admin provisioning route rejected with 403 Forbidden");

    // 4G. Security Guards: Anonymous cannot call provisioning API
    const anonProvReq = new Request("http://localhost/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_user_id: targetStudentUserId,
        role: "admin",
      }),
    });
    const anonProvRes = await adminUsersPatchRoute(anonProvReq);
    testAssert(anonProvRes.status === 401, "Anonymous calling admin provisioning route rejected with 401 Unauthorized");

    console.log(`\n==================================================`);
    console.log(`🎉 ALL ${passed} CODING IDE & STAFF PROVISIONING TESTS PASSED!`);
    console.log(`==================================================`);
  } finally {
    process.env.SMARTZERO_JUDGE_MODE = originalJudgeMode;
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
