/**
 * Production Fallback Guard Test (Phase 14A)
 *
 * Verifies:
 * 1. In production mode (NODE_ENV=production) with Supabase unavailable,
 *    operations FAIL SAFELY and do NOT silently create memoryStore state.
 * 2. In dev/test mode (NODE_ENV=test), memoryStore fallback operates normally.
 *
 * Run: npx tsx tests/production_fallback_guard.test.ts
 */
import assert from "node:assert";
import {
  createContest,
  registerContestParticipant,
  recordMcqAnswer,
  submitContestExam,
} from "../lib/contest/service";
import { saveCodingSubmission } from "../lib/judge/service";
import { getSandboxRunner, executeInSandbox, clearSandboxRunnerCache } from "../lib/judge/sandbox";

console.log("==================================================");
console.log("▶ RUNNING PRODUCTION FALLBACK GUARD VERIFICATION");
console.log("==================================================\n");

async function runTests() {
  const originalEnv = process.env.NODE_ENV;
  const originalForce = process.env.SMARTZERO_FORCE_MEMORY_FALLBACK;

  try {
    // ── Test 1: createContest throws in production when database unavailable ──
    console.log("── 1. Production Mode: createContest Guard ──");
    (process.env as any).NODE_ENV = "production";
    delete process.env.SMARTZERO_FORCE_MEMORY_FALLBACK;

    let createError: any = null;
    try {
      await createContest({
        title: "Production Failure Test Contest",
        passcode: "PROD_SECRET_123",
        start_at: new Date(Date.now() + 3600000).toISOString(),
        end_at: new Date(Date.now() + 7200000).toISOString(),
        duration_minutes: 60,
      });
    } catch (err) {
      createError = err;
    }

    assert(createError !== null, "createContest must throw error in production when DB unavailable");
    assert(
      /Production database unavailable|Database error/i.test(createError.message),
      `Expected controlled error message, received: ${createError.message}`
    );
    console.log("  ✅ [PASS] createContest strictly throws in production when DB unavailable");

    // ── Test 2: registerContestParticipant fails safely in production ──
    console.log("\n── 2. Production Mode: registerParticipant Guard ──");
    const regResult = await registerContestParticipant({
      contest_id: "non-existent-contest-id",
      user_id: "user-123",
      passcode: "ANY_PASSCODE",
    });

    assert.strictEqual(regResult.participant, null, "Participant must be null on failure");
    assert(regResult.error !== null, "Error must be returned on failure");
    console.log("  ✅ [PASS] registerContestParticipant fails safely with controlled error");

    // ── Test 3: recordMcqAnswer fails safely in production ──
    console.log("\n── 3. Production Mode: recordMcqAnswer Guard ──");
    const ansResult = await recordMcqAnswer({
      contest_id: "non-existent-contest-id",
      user_id: "user-123",
      question_id: "q-123",
      selected_option_id: "opt-1",
    });

    assert.strictEqual(ansResult.answer, null, "Answer must be null on failure");
    assert(ansResult.error !== null, "Error must be returned on failure");
    console.log("  ✅ [PASS] recordMcqAnswer fails safely with controlled error");

    // ── Test 4: submitContestExam fails safely in production ──
    console.log("\n── 4. Production Mode: submitContestExam Guard ──");
    const subResult = await submitContestExam({
      contest_id: "non-existent-contest-id",
      user_id: "user-123",
    });

    assert.strictEqual(subResult.success, false, "submitContestExam must return success=false on failure");
    assert(subResult.error !== null, "Error must be returned on failure");
    console.log("  ✅ [PASS] submitContestExam fails safely with controlled error");

    // ── Test 5: saveCodingSubmission throws in production ──
    console.log("\n── 5. Production Mode: saveCodingSubmission Guard ──");
    let saveError: any = null;
    try {
      await saveCodingSubmission({
        contest_id: "contest-123",
        user_id: "user-123",
        question_id: "q-123",
        language: "python",
        code: "print(1)",
        summary: {
          verdict: "Accepted",
          score: 100,
          test_cases_passed: 1,
          total_test_cases: 1,
          execution_time_ms: 10,
          memory_kb: 1024,
          compile_output: "",
          test_case_results: [],
        },
      });
    } catch (err) {
      saveError = err;
    }

    assert(saveError !== null, "saveCodingSubmission must throw in production when DB unavailable");
    assert(
      /Production database unavailable|Database error/i.test(saveError.message),
      `Expected controlled error message, received: ${saveError.message}`
    );
    console.log("  ✅ [PASS] saveCodingSubmission strictly throws in production when DB unavailable");

    // ── Test 6: Resilient local fallback in dev/test mode ──
    console.log("\n── 6. Test/Dev Mode: Memory Fallback Resiliency ──");
    (process.env as any).NODE_ENV = "test";

    const devContest = await createContest({
      title: "Dev Mode Test Contest",
      passcode: "DEV_SECRET_123",
      start_at: new Date(Date.now() + 3600000).toISOString(),
      end_at: new Date(Date.now() + 7200000).toISOString(),
      duration_minutes: 60,
    });

    assert(devContest !== null, "Contest should be created in dev/test mode via fallback");
    assert(devContest.id.startsWith("contest-"), "Contest should have valid memoryStore ID");
    console.log("  ✅ [PASS] Local in-memory fallback continues to operate safely in dev/test mode");

    // ── Test 7: Production Judge Fail-Closed Guard (No Subprocess Fallback) ──
    console.log("\n── 7. Production Mode: Judge Fail-Closed Guard ──");
    (process.env as any).NODE_ENV = "production";
    process.env.SMARTZERO_JUDGE_MODE = "production";
    process.env.SMARTZERO_DOCKER_AVAILABLE = "false";
    clearSandboxRunnerCache();

    const prodRunner = await getSandboxRunner();
    assert.strictEqual(
      prodRunner.name,
      "fail-closed-production",
      "Production judge without Docker MUST select fail-closed runner"
    );

    const execRes = await executeInSandbox({
      code: "print('malicious_host_execution')",
      language: "python",
      input: "",
      timeLimitMs: 2000,
    });

    assert.strictEqual(execRes.verdict, "SYSTEM_ERROR", "Production execution without container must return SYSTEM_ERROR");
    assert(
      execRes.error?.includes("JUDGE_UNAVAILABLE"),
      "Error must explicitly state JUDGE_UNAVAILABLE"
    );
    assert.strictEqual(execRes.actual_output, "", "Student code must NEVER be executed on host process");
    console.log("  ✅ [PASS] Production judge strictly fails closed with zero host subprocess fallback");

    console.log("\n==================================================");
    console.log("🎉 ALL PRODUCTION FALLBACK GUARD CHECKS PASSED!");
    console.log("==================================================");
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
    process.env.SMARTZERO_FORCE_MEMORY_FALLBACK = originalForce;
    delete process.env.SMARTZERO_JUDGE_MODE;
    delete process.env.SMARTZERO_DOCKER_AVAILABLE;
    clearSandboxRunnerCache();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
