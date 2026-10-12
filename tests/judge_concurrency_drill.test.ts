import assert from "node:assert/strict";
import {
  validateTargetUrl,
  parseDrillArgs,
  calculatePercentiles,
  classifyExecutionResult,
  CircuitBreaker,
  loadJudgeSecretSafe,
  createPrng,
  generatePythonPayload,
  generateSqlPayload,
} from "../scripts/judge_concurrency_drill";

console.log("==================================================");
console.log("▶ RUNNING JUDGE CONCURRENCY DRILL UNIT TESTS");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  // ── 1. Safe default target validation ──
  console.log("── 1. Safe Target Validation ──");
  const defaultTarget = validateTargetUrl("http://127.0.0.1:8080/api/judge/execute");
  testAssert(defaultTarget.valid === true, "Default loopback target 127.0.0.1 is valid");
  testAssert(defaultTarget.isLoopback === true, "Default target recognized as loopback");

  const localhostTarget = validateTargetUrl("http://localhost:8080/execute");
  testAssert(localhostTarget.valid === true, "Localhost /execute is valid");

  const ipv6Target = validateTargetUrl("http://[::1]:8080/api/judge/execute");
  testAssert(ipv6Target.valid === true, "IPv6 loopback [::1] is valid");

  // ── 2. Rejection of public production and tunnel targets ──
  console.log("\n── 2. Rejection of Public Production & Tunnel Targets ──");
  const vercelProd = validateTargetUrl("https://smartzero-v1.vercel.app/api/judge/execute", { confirmStaging: true });
  testAssert(!vercelProd.valid && vercelProd.error!.includes("forbidden"), "Vercel production target rejected");

  const cfTunnel = validateTargetUrl("https://random-sub.trycloudflare.com/api/judge/execute", { confirmStaging: true });
  testAssert(!cfTunnel.valid && cfTunnel.error!.includes("forbidden"), "Cloudflare Quick Tunnel target rejected");

  const ngrokTunnel = validateTargetUrl("https://test.ngrok.io/api/judge/execute", { confirmStaging: true });
  testAssert(!ngrokTunnel.valid && ngrokTunnel.error!.includes("forbidden"), "Ngrok tunnel target rejected");

  const supabaseUrl = validateTargetUrl("https://xyz.supabase.co/api/judge/execute", { confirmStaging: true });
  testAssert(!supabaseUrl.valid && supabaseUrl.error!.includes("forbidden"), "Supabase target rejected");

  // ── 3. Remote HTTPS Staging Allowlist Validation ──
  console.log("\n── 3. Remote HTTPS Staging Allowlist Validation ──");
  const unconfirmedRemote = validateTargetUrl("https://staging-judge.internal/api/judge/execute");
  testAssert(!unconfirmedRemote.valid && unconfirmedRemote.error!.includes("--confirm-staging"), "Remote target rejected without --confirm-staging");

  const httpRemote = validateTargetUrl("http://staging-judge.internal/api/judge/execute", { confirmStaging: true, allowRemoteHosts: ["staging-judge.internal"] });
  testAssert(!httpRemote.valid && httpRemote.error!.includes("HTTPS"), "Insecure HTTP remote target strictly rejected");

  const allowedRemote = validateTargetUrl("https://staging-judge.internal/api/judge/execute", {
    confirmStaging: true,
    allowRemoteHosts: ["staging-judge.internal"],
  });
  testAssert(allowedRemote.valid === true && allowedRemote.isLoopback === false, "Allowlisted HTTPS remote staging accepted");

  const unlistedRemote = validateTargetUrl("https://other-judge.internal/api/judge/execute", {
    confirmStaging: true,
    allowRemoteHosts: ["staging-judge.internal"],
  });
  testAssert(!unlistedRemote.valid && unlistedRemote.error!.includes("not present in the allowed remote hosts"), "Non-allowlisted remote host rejected");

  // Rejection of URL credentials, fragments, and bad paths
  const credsUrl = validateTargetUrl("http://admin:secret@127.0.0.1:8080/api/judge/execute");
  testAssert(!credsUrl.valid && credsUrl.error!.includes("Embedded URL credentials"), "URL credentials rejected");

  const fragmentUrl = validateTargetUrl("http://127.0.0.1:8080/api/judge/execute#anchor");
  testAssert(!fragmentUrl.valid && fragmentUrl.error!.includes("fragments"), "URL fragment rejected");

  const badPath = validateTargetUrl("http://127.0.0.1:8080/api/other/path");
  testAssert(!badPath.valid && badPath.error!.includes("Invalid execution endpoint path"), "Unexpected endpoint path rejected");

  // ── 4. Argument Parsing & Rejection of Invalid Concurrency ──
  console.log("\n── 4. Argument Validation & Bounds ──");
  const validArgs = parseDrillArgs(["-c", "10", "-n", "50", "-l", "python"]);
  testAssert(validArgs.args?.concurrency === 10, "Parsed concurrency 10");
  testAssert(validArgs.args?.totalRequests === 50, "Parsed requests 50");
  testAssert(validArgs.args?.language === "python", "Parsed language python");

  const highConcurrency = parseDrillArgs(["-c", "101"]);
  testAssert(highConcurrency.error !== undefined && highConcurrency.error.includes("between 1 and 100"), "Concurrency > 100 rejected");

  const zeroConcurrency = parseDrillArgs(["-c", "0"]);
  testAssert(zeroConcurrency.error !== undefined && zeroConcurrency.error.includes("between 1 and 100"), "Concurrency 0 rejected");

  const negativeRequests = parseDrillArgs(["-n", "-5"]);
  testAssert(negativeRequests.error !== undefined, "Negative request count rejected");

  const invalidLang = parseDrillArgs(["-l", "rust"]);
  testAssert(invalidLang.error !== undefined && invalidLang.error.includes("Supported"), "Unsupported language rejected");

  // ── 5. Percentile Calculation Accuracy ──
  console.log("\n── 5. Percentile Calculation on Small & Large Samples ──");
  const emptyStats = calculatePercentiles([]);
  testAssert(emptyStats.p50 === 0 && emptyStats.p95 === 0, "Empty list percentiles return 0");

  const singleStats = calculatePercentiles([42]);
  testAssert(singleStats.min === 42 && singleStats.p50 === 42 && singleStats.max === 42, "Single item percentile is exact");

  // 100 numbers: 1 to 100
  const hundredNums = Array.from({ length: 100 }, (_, i) => i + 1);
  const hundredStats = calculatePercentiles(hundredNums);
  testAssert(hundredStats.min === 1, "Min is 1");
  testAssert(hundredStats.p50 === 50, "p50 is 50");
  testAssert(hundredStats.p95 === 95, "p95 is 95");
  testAssert(hundredStats.p99 === 99, "p99 is 99");
  testAssert(hundredStats.max === 100, "Max is 100");
  testAssert(hundredStats.mean === 50.5, "Mean is 50.5");

  // Small odd sample: [10, 20, 30]
  const smallOdd = calculatePercentiles([30, 10, 20]);
  testAssert(smallOdd.p50 === 20, "Small odd sample p50 is 20");
  testAssert(smallOdd.max === 30, "Small odd sample max is 30");

  // ── 6. Failure Classification ──
  console.log("\n── 6. Failure & Verdict Classification ──");
  const authClass = classifyExecutionResult(401, '{"error":"Unauthorized"}', "42");
  testAssert(authClass.category === "AUTH_ERROR", "HTTP 401 classified as AUTH_ERROR");

  const rateClass = classifyExecutionResult(429, 'Too many requests', "42");
  testAssert(rateClass.category === "RATE_LIMITED", "HTTP 429 classified as RATE_LIMITED");

  const httpErrClass = classifyExecutionResult(500, 'Internal Server Error', "42");
  testAssert(httpErrClass.category === "HTTP_ERROR", "HTTP 500 classified as HTTP_ERROR");

  const malformedJson = classifyExecutionResult(200, '{ invalid json', "42");
  testAssert(malformedJson.category === "INVALID_JSON", "Malformed JSON classified as INVALID_JSON");

  const wrongStatus = classifyExecutionResult(200, JSON.stringify({ status: "PENDING", verdict: "Accepted" }), "42");
  testAssert(wrongStatus.category === "UNEXPECTED_JOB_STATUS", "Non-terminal status classified as UNEXPECTED_JOB_STATUS");

  const wrongVerdict = classifyExecutionResult(200, JSON.stringify({ status: "COMPLETED", verdict: "TLE" }), "42");
  testAssert(wrongVerdict.category === "VERDICT_MISMATCH", "Non-accepted verdict classified as VERDICT_MISMATCH");

  const outputMismatch = classifyExecutionResult(
    200,
    JSON.stringify({
      status: "COMPLETED",
      verdict: "Accepted",
      test_results: [{ is_sample: true, actual_output: "99" }],
    }),
    "42"
  );
  testAssert(outputMismatch.category === "TEST_CASE_FAILURE", "Wrong output classified as TEST_CASE_FAILURE");

  const validSuccess = classifyExecutionResult(
    200,
    JSON.stringify({
      status: "COMPLETED",
      verdict: "Accepted",
      test_results: [{ is_sample: true, actual_output: "42" }],
    }),
    "42"
  );
  testAssert(validSuccess.category === "SUCCESS", "Valid response classified as SUCCESS");

  // ── 7. Circuit Breaker Behavior ──
  console.log("\n── 7. Circuit Breaker Logic ──");
  // 7A: 20% failure rate after >= 5 requests
  const breaker1 = new CircuitBreaker();
  breaker1.recordOutcome("SUCCESS");
  breaker1.recordOutcome("SUCCESS");
  breaker1.recordOutcome("SUCCESS");
  breaker1.recordOutcome("HTTP_ERROR");
  testAssert(!breaker1.tripped(), "Breaker not tripped before 5 requests");

  breaker1.recordOutcome("HTTP_ERROR"); // 2 failures out of 5 = 40% > 20%
  testAssert(breaker1.tripped(), "Breaker tripped when failure rate exceeds 20%");
  testAssert(breaker1.reason()!.includes("20%"), "Breaker reason mentions 20%");

  // 7B: 3 consecutive timeouts
  const breaker2 = new CircuitBreaker();
  breaker2.recordOutcome("SUCCESS");
  breaker2.recordOutcome("TIMEOUT");
  breaker2.recordOutcome("TIMEOUT");
  testAssert(!breaker2.tripped(), "Breaker not tripped after 2 timeouts");
  breaker2.recordOutcome("TIMEOUT");
  testAssert(breaker2.tripped(), "Breaker tripped on 3 consecutive timeouts");
  testAssert(breaker2.reason()!.includes("consecutive"), "Breaker reason mentions consecutive timeouts");

  // 7C: Reset consecutive timeouts on success
  const breaker3 = new CircuitBreaker();
  breaker3.recordOutcome("TIMEOUT");
  breaker3.recordOutcome("TIMEOUT");
  breaker3.recordOutcome("SUCCESS"); // Resets consecutive counter
  breaker3.recordOutcome("TIMEOUT");
  testAssert(!breaker3.tripped(), "Timeout reset prevents tripping on non-consecutive timeouts");

  // 7D: Immediate trip on AUTH_ERROR
  const breaker4 = new CircuitBreaker();
  breaker4.recordOutcome("AUTH_ERROR");
  testAssert(breaker4.tripped(), "Breaker trips immediately on AUTH_ERROR");

  // ── 8. Deterministic PRNG & Mixed Workload Generation ──
  console.log("\n── 8. Deterministic Workload Selection with Seed ──");
  const prngA = createPrng(42);
  const prngB = createPrng(42);

  const seqA = Array.from({ length: 10 }, () => prngA());
  const seqB = Array.from({ length: 10 }, () => prngB());
  testAssert(JSON.stringify(seqA) === JSON.stringify(seqB), "PRNG produces identical sequence for same seed");

  const prngC = createPrng(99);
  const seqC = Array.from({ length: 10 }, () => prngC());
  testAssert(JSON.stringify(seqA) !== JSON.stringify(seqC), "Different seeds produce different sequences");

  const pyPayload = generatePythonPayload("job-py-1", 7);
  testAssert(pyPayload.language === "python", "Python payload generated");
  testAssert(pyPayload.test_cases[0].expected_output === "49", "Python payload expected output is 49");

  const sqlPayload = generateSqlPayload("job-sql-1", 20);
  testAssert(sqlPayload.language === "sql", "SQL payload generated");
  testAssert(sqlPayload.schema_sql !== undefined, "SQL payload includes schema DDL");

  // ── 9. Safe Secret Loading ──
  console.log("\n── 9. Safe Secret Loading ──");
  const secretInfo = loadJudgeSecretSafe();
  testAssert(!secretInfo.error, "Secret loaded without parsing error");
  testAssert(typeof secretInfo.secret === "string" && secretInfo.secret.length > 0, "Secret is non-empty string");

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} CONCURRENCY DRILL UNIT TESTS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
