/**
 * SmartZero 2.0 — Phase 7 Coding IDE + Isolated Judge Sandbox Test Suite
 *
 * Verifies:
 * 1. Process isolation & sandbox execution for Python and JavaScript
 * 2. Timeout (TLE) enforcement: process termination on infinite loop
 * 3. Runtime error & syntax error capture without host crash
 * 4. Deterministic output normalization (CRLF/LF, whitespace)
 * 5. Partial scoring with weighted test cases
 * 6. SECURITY: Zero-leakage of hidden test case inputs/outputs
 * 7. Submission recording and retrieval
 *
 * Run: npx tsx tests/judge_sandbox.test.ts
 */

import { executeInSandbox } from "../lib/judge/sandbox";
import { runJudge, saveCodingSubmission, getStudentSubmissions } from "../lib/judge/service";
import type { JudgeTestCase } from "../lib/judge/types";

console.log("▶ Running SmartZero Phase 7 Isolated Judge & Sandbox Tests...\n");

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
  // ── 1. Python Execution in Sandbox ──
  console.log("── 1. Python Subprocess Sandbox Execution ──");
  const pyCode = `import sys
input_data = sys.stdin.read().strip()
if input_data:
    a, b = map(int, input_data.split())
    print(a + b)
`;

  const pyRes = await executeInSandbox({
    code: pyCode,
    language: "python",
    input: "12 18\n",
    timeLimitMs: 2500,
  });

  testAssert(pyRes.verdict === "Accepted", "Python code executes successfully");
  testAssert(pyRes.actual_output.trim() === "30", "Python stdout matches expected sum (30)");
  testAssert(pyRes.timed_out === false, "Python execution completed within time limit");

  // ── 2. JavaScript Execution in Sandbox ──
  console.log("\n── 2. JavaScript Subprocess Sandbox Execution ──");
  const jsCode = `const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
  const [a, b] = input.split(' ').map(Number);
  console.log(a * b);
}
`;

  const jsRes = await executeInSandbox({
    code: jsCode,
    language: "javascript",
    input: "6 7\n",
    timeLimitMs: 2000,
  });

  testAssert(jsRes.verdict === "Accepted", "JavaScript code executes successfully");
  testAssert(jsRes.actual_output.trim() === "42", "JavaScript stdout matches expected product (42)");

  // ── 3. Resource Limit: Timeout (TLE) Enforcement ──
  console.log("\n── 3. Execution Timeout (TLE) Enforcement ──");
  const infiniteLoopCode = `while True:\n    pass\n`;

  const tleStart = Date.now();
  const tleRes = await executeInSandbox({
    code: infiniteLoopCode,
    language: "python",
    input: "test",
    timeLimitMs: 800, // strict 800ms limit
  });
  const tleDuration = Date.now() - tleStart;

  testAssert(tleRes.verdict === "TLE", "Infinite loop intercepted as TLE");
  testAssert(tleRes.timed_out === true, "Timed out flag set to true");
  testAssert(tleDuration < 2500, "Process terminated promptly after timeout expiry");

  // ── 4. Error Handling: Runtime & Syntax Errors ──
  console.log("\n── 4. Error Diagnostics & Safe Trapping ──");
  const syntaxErrCode = `def broken_func(:\n    return 0`;
  const syntaxRes = await executeInSandbox({
    code: syntaxErrCode,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(
    syntaxRes.verdict === "Compilation Error" || syntaxRes.verdict === "Runtime Error",
    "Syntax error trapped cleanly without crashing server"
  );

  const runtimeErrCode = `import sys\nprint(1 / 0)`;
  const runtimeRes = await executeInSandbox({
    code: runtimeErrCode,
    language: "python",
    input: "",
    timeLimitMs: 2000,
  });
  testAssert(runtimeRes.verdict === "Runtime Error", "ZeroDivisionError trapped as Runtime Error");

  // ── 5. Partial Scoring & Judge Evaluation ──
  console.log("\n── 5. Judge Partial Scoring & Weighted Evaluation ──");
  const testCases: JudgeTestCase[] = [
    {
      id: "tc-sample-1",
      input: "2 3",
      expected_output: "5",
      weight: 10,
      is_sample: true,
      is_hidden: false,
    },
    {
      id: "tc-hidden-2",
      input: "10 20",
      expected_output: "30",
      weight: 10,
      is_sample: false,
      is_hidden: true,
    },
    {
      id: "tc-hidden-3",
      input: "-5 5",
      expected_output: "0",
      weight: 20,
      is_sample: false,
      is_hidden: true,
    },
  ];

  // Code that passes cases 1 and 2, but fails case 3 (hardcoded condition)
  const partialCode = `import sys
nums = sys.stdin.read().strip().split()
if nums:
    a, b = int(nums[0]), int(nums[1])
    if a < 0:
        print("FAIL")
    else:
        print(a + b)
`;

  const partialSummary = await runJudge({
    code: partialCode,
    language: "python",
    test_cases: testCases,
    time_limit_ms: 2000,
    total_marks: 40,
  });

  testAssert(partialSummary.verdict === "Partial Accepted", "Verdict is Partial Accepted");
  testAssert(partialSummary.test_cases_passed === 2, "2 of 3 test cases passed");
  // Total weight = 40. Passed weight = 10 + 10 = 20. Score = (20/40) * 40 = 20
  testAssert(partialSummary.score === 20, "Partial score is 20 out of 40 marks");

  // ── 6. Zero-Leakage Hidden Test Verification ──
  console.log("\n── 6. Zero-Leakage Hidden Test Verification ──");
  const sampleVerdict = partialSummary.test_case_results.find((r) => r.is_sample);
  const hiddenVerdict = partialSummary.test_case_results.find((r) => !r.is_sample);

  testAssert(sampleVerdict !== undefined, "Sample test case present in results");
  testAssert(sampleVerdict?.input === "2 3", "Sample test case retains input for student feedback");
  testAssert(sampleVerdict?.expected_output === "5", "Sample test case retains expected output");

  testAssert(hiddenVerdict !== undefined, "Hidden test case present in results");
  testAssert(hiddenVerdict?.input === undefined, "SECURITY: Hidden test case input stripped");
  testAssert(hiddenVerdict?.expected_output === undefined, "SECURITY: Hidden test case expected output stripped");
  testAssert(hiddenVerdict?.actual_output === undefined, "SECURITY: Hidden test case actual output stripped");
  testAssert(typeof hiddenVerdict?.verdict === "string", "Hidden test case preserves only verdict and time");

  // ── 7. Submission Persistence & History ──
  console.log("\n── 7. Submission Persistence & History ──");
  const testContestId = "contest-judge-test";
  const testUserId = "student-judge-alice";
  const testQId = "q-code-sum-1";

  const saved = await saveCodingSubmission({
    contest_id: testContestId,
    user_id: testUserId,
    question_id: testQId,
    language: "python",
    code: partialCode,
    summary: partialSummary,
  });

  testAssert(saved.id.startsWith("sub-"), "Submission created with valid ID");
  testAssert(saved.verdict === "Partial Accepted", "Submission preserves verdict");
  testAssert(saved.score === 20, "Submission preserves score");

  const history = await getStudentSubmissions(testContestId, testUserId, testQId);
  testAssert(history.length >= 1, "Submission retrieved from history");
  testAssert(history[0].id === saved.id, "Latest submission is first in history");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 7 JUDGE SANDBOX TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
