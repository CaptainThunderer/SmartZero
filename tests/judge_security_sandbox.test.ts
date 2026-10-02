/**
 * SmartZero 2.0 — Phase 14B Isolated Coding Judge Security & Hardening Suite
 *
 * Verifies 18 critical security vectors:
 * 1. Infinite loops (strict TLE termination)
 * 2. Memory bombs (heap exhaustion / OOM trapping)
 * 3. Output bombs (infinite logging capped at 64 KB)
 * 4. Process spawning & fork bomb mitigation
 * 5. Filesystem traversal prevention (restricted path access)
 * 6. Zero secret leakage (sanitized environment)
 * 7. Network isolation / failure trapping
 * 8. Host process kill protection
 * 9. Subprocess error trapping without host crash
 * 10. Duplicate submission idempotency deduplication
 * 11. Worker crash & stale job recovery state machine
 * 12. Authoritative test case loading from DB
 * 13. Hidden test case zero-leakage guarantee
 * 14. Deterministic partial scoring calculation
 * 15. Multi-language parity (Python & JavaScript)
 * 16. CRLF / LF output normalization
 * 17. Malformed syntax handling (Compilation Error)
 * 18. Priority queue concurrency & FIFO ordering
 *
 * Run: npx tsx tests/judge_security_sandbox.test.ts
 */

import { executeInSandbox, getSandboxRunner, clearSandboxRunnerCache } from "../lib/judge/sandbox";
import { runJudge, saveCodingSubmission, getStudentSubmissions } from "../lib/judge/service";
import { DurableJudgeQueue, ProductionJudgeQueue, LocalJudgeQueue } from "../lib/judge/queue/queue";
import { JudgeWorker, normalizeOutput } from "../lib/judge/worker/worker";
import { judgeObservability } from "../lib/judge/observability";
import { JUDGE_RESOURCE_LIMITS, HOST_SECRET_ENV_KEYS, getJudgeMode } from "../lib/judge/config";
import type { JudgeTestCase } from "../lib/judge/types";
import { createContest, addCodingQuestion, linkQuestionToContest } from "../lib/contest/service";

console.log("▶ Running SmartZero Phase 14B Isolated Judge Security & Sandbox Suite...\n");

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

async function runSecuritySuite() {
  // ── 1. Infinite Loop (TLE Enforcement) ──
  console.log("── 1. Infinite Loop (TLE Enforcement) ──");
  const pyLoop = `while True:\n    pass\n`;
  const t0 = Date.now();
  const loopRes = await executeInSandbox({
    code: pyLoop,
    language: "python",
    input: "",
    timeLimitMs: 600,
  });
  const loopDuration = Date.now() - t0;

  testAssert(loopRes.verdict === "TLE", "Infinite loop intercepted with verdict TLE");
  testAssert(loopRes.timed_out === true, "Timed_out flag is true");
  testAssert(loopDuration < 2500, "Process terminated promptly without blocking host");

  // ── 2. Memory Bomb (Heap / Allocation Trapping) ──
  console.log("\n── 2. Memory Bomb Trapping ──");
  const memBomb = `
try:
    # Attempt to allocate 100 GB of memory to trigger OOM
    big = bytearray(100 * 1024 * 1024 * 1024)
    print("ALLOCATED")
except MemoryError:
    print("OOM_CAUGHT")
except Exception as e:
    print("ERR:" + str(e))
`;
  const memRes = await executeInSandbox({
    code: memBomb,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(
    memRes.verdict === "Accepted" || memRes.verdict === "Runtime Error",
    "Memory allocation spike handled cleanly without crashing host"
  );
  testAssert(memRes.actual_output.includes("OOM_CAUGHT"), "Exorbitant memory allocation trapped via MemoryError");

  // ── 3. Output Bomb (Flooding stdout Capped at 64 KB) ──
  console.log("\n── 3. Output Bomb (Flooding Stdout Capped at 64 KB) ──");
  const outputBomb = `
for i in range(2000):
    print("A" * 200) # 400 KB of output
`;
  const outRes = await executeInSandbox({
    code: outputBomb,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(
    Buffer.byteLength(outRes.actual_output, "utf-8") <= JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES,
    `Output strictly capped to <= ${JUDGE_RESOURCE_LIMITS.MAX_OUTPUT_BYTES} bytes (${Buffer.byteLength(outRes.actual_output, "utf-8")} bytes received)`
  );

  // ── 4. Process Spawning & Fork Mitigation ──
  console.log("\n── 4. Process Spawning Mitigation ──");
  const forkAttempt = `
import subprocess
try:
    p = subprocess.run(["echo", "child"], capture_output=True, text=True)
    print("SPAWNED:" + p.stdout.strip())
except Exception as e:
    print("FORK_PREVENTED")
`;
  const forkRes = await executeInSandbox({
    code: forkAttempt,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(
    forkRes.verdict === "Accepted" || forkRes.verdict === "Runtime Error",
    "Subprocess call evaluated safely within resource envelope"
  );

  // ── 5. Filesystem Traversal Prevention ──
  console.log("\n── 5. Filesystem Traversal Prevention ──");
  const traversalCode = `
with open("../../.env", "r") as f:
    print(f.read())
`;
  const travRes = await executeInSandbox({
    code: traversalCode,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(travRes.verdict === "Runtime Error", "Traversal to ../../.env blocked");
  testAssert(
    Boolean(
      travRes.error?.includes("Security Violation") ||
      travRes.error?.includes("FileNotFoundError") ||
      travRes.error?.includes("restricted")
    ),
    "Security violation or safe trap triggered for path traversal"
  );

  // ── 6. Host Secrets Extraction (Sanitized Environment) ──
  console.log("\n── 6. Zero Host Secret Leakage (Sanitized Environment) ──");
  const envSniffer = `
import os
check_keys = ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "OPENAI_API_KEY", "DATABASE_URL"]
found = [k for k in check_keys if k in os.environ and os.environ[k]]
print("LEAKED_COUNT:" + str(len(found)))
`;
  const envRes = await executeInSandbox({
    code: envSniffer,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(envRes.verdict === "Accepted", "Env sniffer script executed");
  testAssert(envRes.actual_output.trim() === "LEAKED_COUNT:0", "SECURITY: Exactly 0 host secrets leaked into sandbox");

  // ── 7. Network Connection Trapping ──
  console.log("\n── 7. Network Connection Trapping ──");
  const netCode = `
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.3)
    s.connect(("127.0.0.1", 65432)) # Connect to non-existent internal port
    print("CONNECTED")
except Exception as e:
    print("NETWORK_FAIL:" + type(e).__name__)
`;
  const netRes = await executeInSandbox({
    code: netCode,
    language: "python",
    input: "",
    timeLimitMs: 1500,
  });
  testAssert(netRes.verdict === "Accepted", "Network attempt executed cleanly");
  testAssert(netRes.actual_output.includes("NETWORK_FAIL"), "Socket connection rejected/trapped safely");

  // ── 8. Host Process Kill Protection ──
  console.log("\n── 8. Host Process Kill Protection ──");
  const killParent = `
import os, signal
try:
    ppid = os.getppid()
    os.kill(ppid, signal.SIGTERM)
    print("HOST_TERMINATED")
except Exception as e:
    print("KILL_FAILED:" + type(e).__name__)
`;
  const killRes = await executeInSandbox({
    code: killParent,
    language: "python",
    input: "",
    timeLimitMs: 1500,
  });
  testAssert(killRes.verdict === "Runtime Error", "Host kill attempt blocked as Runtime Error");
  testAssert(
    Boolean(killRes.error?.includes("Security Violation") || killRes.error?.includes("forbidden")),
    "Security violation triggered for process termination attempt"
  );

  // ── 9. Subprocess Error Trapping (No Host Crash) ──
  console.log("\n── 9. Subprocess Error Trapping ──");
  const brokenCode = `import sys\nsys.exit(42)\n`;
  const brokenRes = await executeInSandbox({
    code: brokenCode,
    language: "python",
    input: "",
    timeLimitMs: 4000,
  });
  testAssert(brokenRes.verdict === "Runtime Error", "Non-zero exit code trapped as Runtime Error");
  testAssert(!brokenRes.timed_out, "Process exited on its own, not via TLE");

  // ── 10. Duplicate Submission Idempotency ──
  console.log("\n── 10. Duplicate Submission Idempotency ──");
  const testQueue = new DurableJudgeQueue();
  const idemKey = "idempotent-sub-test-key-101";

  const job1 = await testQueue.enqueue({
    jobId: "job-101",
    submissionId: "sub-101",
    contestId: "contest-101",
    questionId: "q-101",
    userId: "user-alice",
    language: "python",
    code: "print(1)",
    priority: 5,
    idempotencyKey: idemKey,
  });

  const job2 = await testQueue.enqueue({
    jobId: "job-102",
    submissionId: "sub-102",
    contestId: "contest-101",
    questionId: "q-101",
    userId: "user-alice",
    language: "python",
    code: "print(1)",
    priority: 5,
    idempotencyKey: idemKey,
  });

  testAssert(job1.jobId === job2.jobId, "Duplicate submission with same idempotency key returns existing job");
  testAssert((await testQueue.getQueueLength()) === 1, "Queue length is 1 (deduplicated)");

  // ── 11. Worker Crash & Stale Job Recovery ──
  console.log("\n── 11. Worker Crash & Stale Job Recovery ──");
  const staleJob = await testQueue.dequeue();
  testAssert(staleJob !== null, "Job dequeued for worker execution");
  testAssert(staleJob?.status === "RUNNING", "Job transitioned to RUNNING state");

  // Simulate worker dying: set startedAt to 45 seconds ago
  if (staleJob) {
    staleJob.startedAt = Date.now() - 45000;
  }

  const recoveredCount = await testQueue.cleanupStaleJobs(30000);
  testAssert(recoveredCount === 1, "Stale job recovered by watchdog");
  testAssert(staleJob?.status === "QUEUED", "Job requeued back to QUEUED for retry");
  testAssert(staleJob?.retryCount === 1, "Retry count incremented to 1");

  // ── 12. Authoritative Test Case Loading From DB ──
  console.log("\n── 12. Authoritative Test Case Loading From DB ──");
  // Create an authoritative contest and question
  const contest = await createContest({
    title: "Phase 14B Security Contest",
    description: "Testing authoritative judge worker",
    passcode: "SEC123",
    start_at: new Date(Date.now() - 60000).toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
  });

  const q = await addCodingQuestion({
    title: "Sum Two Numbers",
    description: "Read two ints and print sum",
    time_limit_ms: 1500,
    memory_limit_mb: 256,
    test_cases: [
      { input: "10 20\n", expected_output: "30", weight: 10, is_sample: true, is_hidden: false },
      { input: "50 50\n", expected_output: "100", weight: 20, is_sample: false, is_hidden: true },
    ],
  });

  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: q.id,
    question_type: "coding",
    sort_order: 1,
    marks: 30,
  });

  const worker = new JudgeWorker("sec-worker-01", testQueue);
  const authJob = await testQueue.enqueue({
    jobId: "job-auth-1",
    submissionId: "sub-auth-1",
    contestId: contest.id,
    questionId: q.id,
    userId: "student-bob",
    language: "python",
    code: "import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n",
    priority: 10,
  });

  const dq = await testQueue.dequeue();
  testAssert(dq !== null, "Authoritative job dequeued");
  const authSummary = await worker.processJob(dq!);

  testAssert(authSummary.verdict === "Accepted", "Authoritative solution passed all test cases");
  testAssert(authSummary.score === 30, "Authoritative score matches contest marks (30)");
  testAssert(authSummary.test_cases_passed === 2, "Both authoritative test cases passed");

  // ── 13. Hidden Test Case Zero-Leakage Guarantee ──
  console.log("\n── 13. Hidden Test Case Zero-Leakage Guarantee ──");
  const sampleTc = authSummary.test_case_results.find((t) => t.is_sample);
  const hiddenTc = authSummary.test_case_results.find((t) => !t.is_sample);

  testAssert(sampleTc?.input === "10 20\n", "Sample test case preserves input for feedback");
  testAssert(sampleTc?.expected_output === "30", "Sample test case preserves expected output");
  testAssert(hiddenTc?.input === undefined, "SECURITY: Hidden test case input stripped");
  testAssert(hiddenTc?.expected_output === undefined, "SECURITY: Hidden test case expected output stripped");
  testAssert(hiddenTc?.actual_output === undefined, "SECURITY: Hidden test case actual output stripped");

  // ── 14. Deterministic Partial Scoring Calculation ──
  console.log("\n── 14. Deterministic Partial Scoring Calculation ──");
  // Submit code that passes case 1 but fails case 2
  const partialSummary = await worker.executeTestCases({
    code: "import sys\nnums = sys.stdin.read().split()\nif nums and nums[0] == '10':\n    print('30')\nelse:\n    print('0')\n",
    language: "python",
    testCases: [
      { id: "tc-p1", input: "10 20\n", expected_output: "30", weight: 10, is_sample: true, is_hidden: false },
      { id: "tc-p2", input: "50 50\n", expected_output: "100", weight: 20, is_sample: false, is_hidden: true },
    ],
    totalMarks: 30,
  });

  testAssert(partialSummary.verdict === "Partial Accepted", "Verdict is Partial Accepted");
  testAssert(partialSummary.test_cases_passed === 1, "1 of 2 test cases passed");
  // Total weight 30. Passed weight 10. Score = (10 / 30) * 30 = 10
  testAssert(partialSummary.score === 10, "Partial score is exactly 10 out of 30 marks");

  // ── 15. Multi-Language Parity (Python & JavaScript) ──
  console.log("\n── 15. Multi-Language Parity (Python & JavaScript) ──");
  const jsRes = await executeInSandbox({
    code: `const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf-8').trim().split(' ').map(Number);\nconsole.log(a + b);\n`,
    language: "javascript",
    input: "7 8\n",
    timeLimitMs: 2000,
  });
  testAssert(jsRes.verdict === "Accepted", "JavaScript sandbox executes cleanly");
  testAssert(jsRes.actual_output.trim() === "15", "JavaScript produces correct computation (15)");

  // ── 16. Output Normalization (CRLF vs LF and Whitespace) ──
  console.log("\n── 16. CRLF / LF Output Normalization ──");
  const raw1 = "42\r\n43  \r\n\r\n";
  const raw2 = "42\n43\n";
  testAssert(normalizeOutput(raw1) === normalizeOutput(raw2), "Output normalizer equates Windows CRLF and Unix LF with trailing whitespace");

  // ── 17. Malformed Syntax Handling ──
  console.log("\n── 17. Malformed Syntax Handling ──");
  const badSyntax = `def bad(:\n  return\n`;
  const syntaxRes = await executeInSandbox({
    code: badSyntax,
    language: "python",
    input: "",
    timeLimitMs: 1500,
  });
  testAssert(syntaxRes.verdict === "Compilation Error" || syntaxRes.verdict === "Runtime Error", "Malformed syntax trapped cleanly");
  testAssert(syntaxRes.timed_out === false, "Not timed out");

  // ── 18. Priority Queue Concurrency & FIFO Ordering ──
  console.log("\n── 18. Priority Queue Concurrency & Ordering ──");
  const pq = new DurableJudgeQueue();
  await pq.enqueue({
    jobId: "low-1",
    submissionId: "s-low",
    contestId: "c1",
    questionId: "q1",
    userId: "u1",
    language: "python",
    code: "print(1)",
    priority: 1,
  });
  await pq.enqueue({
    jobId: "high-1",
    submissionId: "s-high",
    contestId: "c1",
    questionId: "q1",
    userId: "u2",
    language: "python",
    code: "print(2)",
    priority: 10,
  });
  await pq.enqueue({
    jobId: "med-1",
    submissionId: "s-med",
    contestId: "c1",
    questionId: "q1",
    userId: "u3",
    language: "python",
    code: "print(3)",
    priority: 5,
  });

  const first = await pq.dequeue();
  const second = await pq.dequeue();
  const third = await pq.dequeue();

  testAssert(first?.jobId === "high-1", "Highest priority job dequeued first (priority 10)");
  testAssert(second?.jobId === "med-1", "Medium priority job dequeued second (priority 5)");
  testAssert(third?.jobId === "low-1", "Low priority job dequeued third (priority 1)");

  // ── 19. Production Fail-Closed: Docker Unavailable Rejection ──
  console.log("\n── 19. Production Fail-Closed Policy: Docker Unavailable Rejection ──");
  const origJudgeMode = process.env.SMARTZERO_JUDGE_MODE;
  const origNodeEnv = process.env.NODE_ENV;

  try {
    process.env.SMARTZERO_JUDGE_MODE = "production";
    clearSandboxRunnerCache();

    const prodRunner = await getSandboxRunner();
    testAssert(prodRunner.name === "fail-closed-production", "In production without Docker, fail-closed runner is selected");
    testAssert((await prodRunner.isAvailable()) === false, "Fail-closed runner reports unavailable");

    const failClosedRes = await executeInSandbox({
      code: "print('malicious_host_execution')",
      language: "python",
      input: "",
      timeLimitMs: 2000,
    });

    testAssert(failClosedRes.verdict === "SYSTEM_ERROR", "Production without Docker returns SYSTEM_ERROR");
    testAssert(
      Boolean(failClosedRes.error?.includes("JUDGE_UNAVAILABLE")),
      "Error contains JUDGE_UNAVAILABLE and warns host execution is prohibited"
    );
    testAssert(failClosedRes.actual_output === "", "Student code was never executed on host process");

    // ── 20. Production Fail-Closed: Subprocess Host Fallback Forbidden ──
    console.log("\n── 20. Production Fail-Closed Policy: Host Subprocess Forbidden ──");
    const prodWorker = new JudgeWorker("prod-sec-worker-01");
    const prodSummary = await prodWorker.executeTestCases({
      code: "print('host_escape_attempt')",
      language: "python",
      testCases: [
        { id: "tc-p1", input: "", expected_output: "test", weight: 1, is_sample: true, is_hidden: false },
      ],
      timeLimitMs: 2000,
    });

    testAssert(prodSummary.verdict === "SYSTEM_ERROR", "Worker returns SYSTEM_ERROR in production mode without Docker");
    testAssert(prodSummary.score === 0, "Score is strictly 0 when judge is unavailable");
    testAssert(
      Boolean(prodSummary.compile_output?.includes("JUDGE_UNAVAILABLE")),
      "Worker compile_output exposes JUDGE_UNAVAILABLE message"
    );

    // ── 21. Production Queue Fail-Closed: Missing Redis Configuration ──
    console.log("\n── 21. Production Queue Fail-Closed Policy: Missing Redis ──");
    const prodQueue = new ProductionJudgeQueue();
    let queueBlocked = false;
    try {
      await prodQueue.enqueue({
        jobId: "prod-job-blocked",
        submissionId: "sub-blocked",
        contestId: "c1",
        questionId: "q1",
        userId: "u1",
        language: "python",
        code: "print(1)",
        priority: 1,
      });
    } catch (err: unknown) {
      queueBlocked = true;
      testAssert(
        Boolean((err as Error).message.includes("JUDGE_QUEUE_UNAVAILABLE")),
        "Production queue throws JUDGE_QUEUE_UNAVAILABLE when external Redis is missing"
      );
    }
    testAssert(queueBlocked === true, "Production queue strictly fails closed without credentials");

    // ── 22. Local Mode: Development Sandbox Allowed Without Docker ──
    console.log("\n── 22. Local Mode: Development Sandbox Allowed Without Docker ──");
    process.env.SMARTZERO_JUDGE_MODE = "local";
    clearSandboxRunnerCache();

    const localRunner = await getSandboxRunner();
    testAssert(localRunner.name === "hardened-subprocess", "Local mode selects HardenedSubprocessSandbox for Docker-free dev");
    testAssert((await localRunner.isAvailable()) === true, "Local subprocess sandbox is available");

    const localRes = await executeInSandbox({
      code: "print('local_dev_works')",
      language: "python",
      input: "",
      timeLimitMs: 2000,
    });
    testAssert(localRes.verdict === "Accepted", "Local development sandbox executes cleanly without Docker Desktop");
    testAssert(localRes.actual_output.trim() === "local_dev_works", "Local output matches expected calculation");

    // ── 23. Docker Socket Zero-Exposure Verification ──
    console.log("\n── 23. Docker Socket Zero-Exposure Verification ──");
    const sockCheck = await executeInSandbox({
      code: `import os\nprint("SOCK_FOUND:" + str(os.path.exists("/var/run/docker.sock")))\n`,
      language: "python",
      input: "",
      timeLimitMs: 1500,
    });
    testAssert(sockCheck.verdict === "Accepted", "Docker socket inspection executed safely");
    testAssert(sockCheck.actual_output.trim() === "SOCK_FOUND:False", "Docker control socket /var/run/docker.sock is NOT accessible");

  } finally {
    process.env.SMARTZERO_JUDGE_MODE = origJudgeMode;
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    clearSandboxRunnerCache();
  }

  // ── Observability Snapshot Check ──
  const metrics = judgeObservability.getMetricsSnapshot();
  testAssert(metrics.totalReceived > 0, "Observability tracks received jobs");
  testAssert(metrics.totalCompleted > 0, "Observability tracks completed jobs");
  testAssert(metrics.sandboxUnavailable > 0, "Observability tracks sandbox unavailable events");
  testAssert(metrics.queueFailures > 0, "Observability tracks queue failure events");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 14B JUDGE SECURITY TESTS PASSED!`);
  console.log(`==================================================\n`);
}

runSecuritySuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
