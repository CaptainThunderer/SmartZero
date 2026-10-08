import assert from "node:assert/strict";
import http from "node:http";
import { judgeWorkerClient, JudgeUnavailableError } from "../lib/judge/service";
import { priorityJudgeQueue } from "../lib/judge/queue/priorityQueue";
import { server as workerServer } from "../deploy/judge-worker/server";
import type { JudgeWorkerJobRequest, JudgeWorkerJobResponse } from "../lib/judge/types";

console.log("==================================================");
console.log("▶ RUNNING PRODUCTION JUDGE INFRASTRUCTURE & REMOTE CONNECTIVITY TEST");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

const TEST_PORT = 8099;
const TEST_SECRET = process.env.JUDGE_WORKER_SECRET || "mock-test-judge-secret-not-for-production";
const WORKER_URL = process.env.JUDGE_WORKER_URL || `http://127.0.0.1:${TEST_PORT}`;

async function runTests() {
  const originalMode = process.env.SMARTZERO_JUDGE_MODE;
  const originalWorkerUrl = process.env.JUDGE_WORKER_URL;
  const originalSecret = process.env.JUDGE_WORKER_SECRET;

  process.env.JUDGE_WORKER_SECRET = TEST_SECRET;
  process.env.JUDGE_WORKER_URL = WORKER_URL;

  // Start test instance of standalone worker server only if no external worker URL is provided
  let testServer: http.Server | null = null;
  if (!originalWorkerUrl) {
    testServer = http.createServer(workerServer.listeners("request")[0] as any);
    await new Promise<void>((resolve) => testServer!.listen(TEST_PORT, "127.0.0.1", resolve));
  }

  try {
    // ════════════════════════════════════════════════════════════════
    // 1. HEALTH PROBE VERIFICATION (GET /health)
    // ════════════════════════════════════════════════════════════════
    console.log("── 1. Remote Worker Health Probing (GET /health) ──");
    const healthResult = await judgeWorkerClient.pingWorkerHealth(WORKER_URL);
    testAssert(healthResult.ok === true, "Worker health probe returned OK");
    testAssert(healthResult.status === "ok", "Worker status is 'ok'");
    testAssert(healthResult.latencyMs < 500, `Health check latency is low (${healthResult.latencyMs}ms)`);

    // ════════════════════════════════════════════════════════════════
    // 2. READINESS PROBE VERIFICATION (GET /ready)
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 2. Remote Worker Readiness Probing (GET /ready) ──");
    const readyResult = await judgeWorkerClient.pingWorkerReady(WORKER_URL);
    testAssert(readyResult.ok === true, "Worker readiness probe returned OK");
    testAssert(readyResult.ready === true, "Worker state is ready: true");
    testAssert(Array.isArray(readyResult.runtimes), "Worker exposes supported runtimes array");
    testAssert(readyResult.runtimes?.includes("python") === true, "Python runtime reported ready");
    testAssert(readyResult.runtimes?.includes("javascript") === true, "JavaScript runtime reported ready");
    testAssert(readyResult.runtimes?.includes("typescript") === true, "TypeScript runtime reported ready");
    testAssert(readyResult.concurrency !== undefined && readyResult.concurrency <= 4, "Worker concurrency is bounded for 512MB RAM");

    // ════════════════════════════════════════════════════════════════
    // 3. SECURITY & AUTHENTICATION ENFORCEMENT
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 3. Worker Security & Bearer Authentication ──");

    // A. Missing Authorization Header -> 401
    const unauthRes = await fetch(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: "sec-1", language: "python", source_code: "1" }),
    });
    testAssert(unauthRes.status === 401, "Missing Bearer token strictly rejected with HTTP 401 Unauthorized");

    // B. Wrong Bearer Secret -> 401
    const wrongAuthRes = await fetch(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer WRONG_ATTACKER_SECRET",
      },
      body: JSON.stringify({ job_id: "sec-2", language: "python", source_code: "1" }),
    });
    testAssert(wrongAuthRes.status === 401, "Invalid Bearer secret strictly rejected with HTTP 401 Unauthorized");

    // C. Malformed Request Payload -> 400
    const malformedRes = await fetch(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TEST_SECRET}`,
      },
      body: JSON.stringify({ job_id: "sec-3" }), // missing language and source_code
    });
    testAssert(malformedRes.status === 400, "Malformed job payload rejected with HTTP 400 Bad Request");

    // D. Oversized Source Code (> 64KB) -> 400
    const hugeCode = "x = 1\n" + "# comment\n".repeat(7000); // 70,006 bytes > 65,536 (64 KB)
    const hugeRes = await fetch(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TEST_SECRET}`,
      },
      body: JSON.stringify({
        job_id: "sec-4",
        language: "python",
        source_code: hugeCode,
        test_cases: [{ id: "1", input: "1", expected_output: "1", weight: 1, is_sample: true, is_hidden: false }],
      }),
    });
    testAssert(hugeRes.status === 400, "Source code exceeding 64KB rejected with HTTP 400 Bad Request");

    // ════════════════════════════════════════════════════════════════
    // 4. REMOTE PRODUCTION EXECUTION VIA JUDGEWORKERCLIENT
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 4. Remote Production Execution Via JudgeWorkerClient ──");
    process.env.SMARTZERO_JUDGE_MODE = "production";

    // 4A. Python 3 Execution over Remote HTTP Worker
    const pyResp = await judgeWorkerClient.executeJob({
      job_id: "remote-py-01",
      submission_id: "sub-py-01",
      contest_id: "c-prod-1",
      question_id: "q-py-1",
      language: "python",
      source_code: "a = int(input())\nb = int(input())\nprint(a + b)",
      execution_mode: "submit",
      test_cases: [
        { id: "tc-1", input: "12\n34\n", expected_output: "46", weight: 1, is_sample: true, is_hidden: false },
        { id: "tc-2", input: "100\n200\n", expected_output: "300", weight: 2, is_sample: false, is_hidden: true },
      ],
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      total_marks: 30,
    });

    testAssert(pyResp.verdict === "Accepted", "Remote worker returned Accepted for Python 3");
    testAssert(pyResp.passed_tests === 2, "Remote worker passed 2/2 tests");
    testAssert(pyResp.score === 30, "Remote worker awarded full score (30/30)");

    // 4B. JavaScript (Node.js) Execution over Remote HTTP Worker
    const jsResp = await judgeWorkerClient.executeJob({
      job_id: "remote-js-01",
      submission_id: "sub-js-01",
      contest_id: "c-prod-1",
      question_id: "q-js-1",
      language: "javascript",
      source_code: `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
const [a, b] = input.split(' ').map(Number);
console.log(a * b);`,
      execution_mode: "run",
      test_cases: [
        { id: "tc-1", input: "7 8", expected_output: "56", weight: 1, is_sample: true, is_hidden: false },
      ],
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      total_marks: 0,
    });

    testAssert(jsResp.verdict === "Accepted", "Remote worker returned Accepted for JavaScript (Node.js)");
    testAssert(jsResp.score === 0, "Interactive Run awarded 0 score as per contract");

    // 4C. TypeScript Execution over Remote HTTP Worker
    const tsResp = await judgeWorkerClient.executeJob({
      job_id: "remote-ts-01",
      submission_id: "sub-ts-01",
      contest_id: "c-prod-1",
      question_id: "q-ts-1",
      language: "typescript",
      source_code: `const fs = require('fs');
const raw: string = fs.readFileSync(0, 'utf-8').trim();
const num: number = parseInt(raw, 10);
console.log(num * 3);`,
      execution_mode: "submit",
      test_cases: [
        { id: "tc-1", input: "9", expected_output: "27", weight: 1, is_sample: true, is_hidden: false },
      ],
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      total_marks: 10,
    });

    testAssert(tsResp.verdict === "Accepted", "Remote worker returned Accepted for TypeScript");
    testAssert(tsResp.score === 10, "TypeScript submission awarded 10 marks");

    // ════════════════════════════════════════════════════════════════
    // 5. RESOURCE LIMIT & ERROR HANDLING OVER REMOTE WORKER
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 5. Resource Limits & Error Handling over Remote Worker ──");

    // 5A. Time Limit Exceeded (TLE)
    const tleResp = await judgeWorkerClient.executeJob({
      job_id: "remote-tle-01",
      submission_id: "sub-tle-01",
      contest_id: "c-prod-1",
      question_id: "q-tle-1",
      language: "python",
      source_code: "import time\nwhile True:\n    time.sleep(1)",
      execution_mode: "submit",
      test_cases: [
        { id: "tc-1", input: "1", expected_output: "1", weight: 1, is_sample: true, is_hidden: false },
      ],
      time_limit_ms: 500, // short 500ms limit
      memory_limit_mb: 256,
      total_marks: 10,
    });
    testAssert(tleResp.verdict === "TLE", "Infinite loop correctly flagged as TLE over remote worker");
    testAssert(tleResp.score === 0, "TLE awarded 0 marks");

    // 5B. Runtime Error (Division by Zero)
    const rteResp = await judgeWorkerClient.executeJob({
      job_id: "remote-rte-01",
      submission_id: "sub-rte-01",
      contest_id: "c-prod-1",
      question_id: "q-rte-1",
      language: "python",
      source_code: "x = 1 / 0",
      execution_mode: "submit",
      test_cases: [
        { id: "tc-1", input: "1", expected_output: "1", weight: 1, is_sample: true, is_hidden: false },
      ],
      time_limit_ms: 1000,
      memory_limit_mb: 256,
      total_marks: 10,
    });
    testAssert(rteResp.verdict === "Runtime Error", "Zero division correctly flagged as Runtime Error");

    // ════════════════════════════════════════════════════════════════
    // 6. ZERO HIDDEN-TEST-CASE LEAKAGE AUDIT OVER REMOTE NETWORK
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 6. Zero Hidden-Test Leakage Audit over Remote Worker ──");

    const leakCheckResp = await judgeWorkerClient.executeJob({
      job_id: "remote-leak-check",
      submission_id: "sub-leak-check",
      contest_id: "c-prod-1",
      question_id: "q-leak-1",
      language: "python",
      source_code: "print(input())",
      execution_mode: "submit",
      test_cases: [
        { id: "tc-sample", input: "HELLO_SAMPLE", expected_output: "HELLO_SAMPLE", weight: 1, is_sample: true, is_hidden: false },
        { id: "tc-hidden", input: "SUPER_SECRET_INPUT_DO_NOT_LEAK", expected_output: "SUPER_SECRET_INPUT_DO_NOT_LEAK", weight: 2, is_sample: false, is_hidden: true },
      ],
      time_limit_ms: 1000,
      memory_limit_mb: 256,
      total_marks: 15,
    });

    const sampleRes = leakCheckResp.test_results.find((tr) => tr.is_sample);
    const hiddenRes = leakCheckResp.test_results.find((tr) => !tr.is_sample);

    testAssert(sampleRes !== undefined, "Sample test result present");
    testAssert(sampleRes!.input === "HELLO_SAMPLE", "Sample test input is visible");
    testAssert(sampleRes!.expected_output === "HELLO_SAMPLE", "Sample expected output is visible");

    testAssert(hiddenRes !== undefined, "Hidden test result present");
    testAssert(hiddenRes!.input === undefined, "Hidden test input is strictly undefined (Zero Leakage)");
    testAssert(hiddenRes!.expected_output === undefined, "Hidden test expected_output is strictly undefined");
    testAssert(hiddenRes!.actual_output === undefined, "Hidden test actual_output is strictly undefined");
    testAssert(hiddenRes!.passed === true, "Hidden test passed status preserved");

    // ════════════════════════════════════════════════════════════════
    // 7. PRODUCTION FAIL-CLOSED GUARD (WORKER OFFLINE)
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 7. Production Fail-Closed Guard (Worker Offline) ──");
    process.env.JUDGE_WORKER_URL = "http://127.0.0.1:59999"; // Non-existent offline worker

    let threwUnavailable = false;
    try {
      await judgeWorkerClient.executeJob({
        job_id: "fail-closed-test",
        submission_id: "sub-fail-closed",
        contest_id: "c-prod-1",
        question_id: "q-fc-1",
        language: "python",
        source_code: "print(1)",
        execution_mode: "submit",
        test_cases: [
          { id: "tc-1", input: "1", expected_output: "1", weight: 1, is_sample: true, is_hidden: false },
        ],
        time_limit_ms: 1000,
        memory_limit_mb: 256,
      });
    } catch (err: unknown) {
      if (err instanceof JudgeUnavailableError || (err as any)?.code === "JUDGE_UNAVAILABLE") {
        threwUnavailable = true;
      }
    }

    testAssert(threwUnavailable, "Offline worker strictly triggers JudgeUnavailableError (HTTP 503 fail-closed)");

    // Restore real worker URL for burst test
    process.env.JUDGE_WORKER_URL = WORKER_URL;

    // ════════════════════════════════════════════════════════════════
    // 8. 70-STUDENT BURST SIMULATION THROUGH REMOTE WORKER
    // ════════════════════════════════════════════════════════════════
    console.log("\n── 8. Simulated 70-Student Burst through Remote HTTP Worker ──");

    priorityJudgeQueue.reset();
    priorityJudgeQueue.setConcurrency(3); // 3 worker concurrency

    const burstRequests = Array.from({ length: 30 }).map((_, idx) =>
      judgeWorkerClient.executeJob({
        job_id: `burst-http-job-${idx + 1}`,
        submission_id: `burst-sub-${idx + 1}`,
        contest_id: "c-prod-burst",
        question_id: "q-burst-1",
        language: "python",
        source_code: "a, b = map(int, input().split())\nprint(a + b)",
        execution_mode: "submit",
        test_cases: [
          { id: "tc-1", input: "4 5\n", expected_output: "9", weight: 1, is_sample: true, is_hidden: false },
        ],
        time_limit_ms: 1000,
        memory_limit_mb: 256,
        total_marks: 10,
      })
    );

    const burstResponses = await Promise.all(burstRequests);

    testAssert(
      burstResponses.every((r) => r.verdict === "Accepted" && r.score === 10),
      "All 30 burst submissions through remote HTTP worker completed with 100% Accepted verdicts"
    );

    const burstMetrics = priorityJudgeQueue.getMetrics();
    testAssert(burstMetrics.totalFailed === 0, "Zero failures during remote worker burst");

    console.log(`\n==================================================`);
    console.log(`🎉 ALL ${passed} PRODUCTION JUDGE INFRASTRUCTURE ASSERTIONS PASSED!`);
    console.log(`==================================================`);
    process.exit(0);
  } finally {
    process.env.SMARTZERO_JUDGE_MODE = originalMode;
    process.env.JUDGE_WORKER_URL = originalWorkerUrl;
    process.env.JUDGE_WORKER_SECRET = originalSecret;
    if (testServer) {
      await new Promise<void>((resolve) => testServer!.close(() => resolve()));
    }
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
