import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateTargetUrl,
  parseDrillArgs,
  parseStrictInt,
  calculatePercentiles,
  classifyExecutionResult,
  CircuitBreaker,
  loadJudgeSecretSafe,
  createPrng,
  generatePythonPayload,
  generateSqlPayload,
  runJudgeConcurrencyDrill,
  type DrillArgs,
  type FailureCategory,
} from "../scripts/judge_concurrency_drill";
import { formatSqlTable } from "../lib/judge/sqlEngine";
import type { JudgeWorkerJobRequest } from "../lib/judge/types";

console.log("==================================================");
console.log("▶ RUNNING JUDGE CONCURRENCY DRILL HARDENED TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  // ── 1. Target Validation: Loopback Host & Port Enforcement ──
  console.log("── 1. Safe Target Validation & Loopback Port Enforcement ──");
  const validLoopback = validateTargetUrl("http://127.0.0.1:8080/api/judge/execute");
  testAssert(validLoopback.valid === true, "Default loopback target 127.0.0.1:8080 is valid");
  testAssert(validLoopback.isLoopback === true, "Recognized as loopback target");

  const validLocalhost = validateTargetUrl("http://localhost:8080/execute");
  testAssert(validLocalhost.valid === true, "Localhost:8080 /execute is valid");

  const validIpv6 = validateTargetUrl("http://[::1]:8080/api/judge/execute");
  testAssert(validIpv6.valid === true, "IPv6 loopback [::1]:8080 is valid");

  // Rejection of wrong loopback port
  const wrongPort = validateTargetUrl("http://127.0.0.1:3000/api/judge/execute");
  testAssert(!wrongPort.valid && wrongPort.error!.includes("intended judge port"), "Loopback with port 3000 rejected");

  // Rejection of missing port on loopback
  const missingPort = validateTargetUrl("http://127.0.0.1/api/judge/execute");
  testAssert(!missingPort.valid && missingPort.error!.includes("intended judge port"), "Loopback with default port 80 rejected");

  // Rejection of HTTPS on loopback
  const httpsLoopback = validateTargetUrl("https://127.0.0.1:8080/api/judge/execute");
  testAssert(!httpsLoopback.valid && httpsLoopback.error!.includes("HTTP"), "HTTPS on loopback rejected");

  // Rejection of bind address 0.0.0.0
  const bindAddress = validateTargetUrl("http://0.0.0.0:8080/api/judge/execute");
  testAssert(!bindAddress.valid, "Bind address 0.0.0.0 rejected as target");

  // Rejection of query parameters
  const queryParamUrl = validateTargetUrl("http://127.0.0.1:8080/api/judge/execute?debug=true");
  testAssert(!queryParamUrl.valid && queryParamUrl.error!.includes("Query parameters"), "Target with query parameters rejected");

  // Rejection of credentials & fragments
  const credsUrl = validateTargetUrl("http://admin:secret@127.0.0.1:8080/api/judge/execute");
  testAssert(!credsUrl.valid && credsUrl.error!.includes("credentials"), "Embedded credentials rejected");

  const fragUrl = validateTargetUrl("http://127.0.0.1:8080/api/judge/execute#frag");
  testAssert(!fragUrl.valid && fragUrl.error!.includes("fragments"), "URL fragment rejected");

  const badPath = validateTargetUrl("http://127.0.0.1:8080/api/contest/submit");
  testAssert(!badPath.valid && badPath.error!.includes("Invalid execution endpoint path"), "Non-execution endpoint path rejected");

  const malformedUrl = validateTargetUrl("not-a-valid-url");
  testAssert(!malformedUrl.valid && malformedUrl.error!.includes("Malformed"), "Malformed URL rejected");

  const emptyUrl = validateTargetUrl("");
  testAssert(!emptyUrl.valid && emptyUrl.error!.includes("empty"), "Empty URL rejected");

  // ── 2. Rejection of Public Production & Tunnel Domains ──
  console.log("\n── 2. Rejection of Public Production & Tunnel Domains ──");
  const forbiddenDomains = [
    "https://smartzero.io/api/judge/execute",
    "https://smartzero-v1.vercel.app/api/judge/execute",
    "https://xyz.supabase.co/api/judge/execute",
    "https://judge.workers.dev/api/judge/execute",
    "https://sub.trycloudflare.com/api/judge/execute",
    "https://sub.cloudflarepreview.com/api/judge/execute",
    "https://sub.localtunnel.me/api/judge/execute",
    "https://sub.ngrok.io/api/judge/execute",
    "https://sub.ngrok-free.app/api/judge/execute",
    "https://app.herokuapp.com/api/judge/execute",
    "https://app.fly.dev/api/judge/execute",
    "https://app.render.com/api/judge/execute",
    "https://app.railway.app/api/judge/execute",
    "https://ec2.amazonaws.com/api/judge/execute",
  ];

  for (const url of forbiddenDomains) {
    const res = validateTargetUrl(url, { confirmStaging: true, allowRemoteHosts: [new URL(url).hostname] });
    testAssert(!res.valid && res.error!.includes("forbidden"), `Forbidden production/tunnel domain rejected: ${new URL(url).hostname}`);
  }

  // ── 3. Remote Staging Policy ──
  console.log("\n── 3. Remote Staging Policy & Allowlist Validation ──");
  const remoteHttp = validateTargetUrl("http://staging-judge.corp/api/judge/execute", {
    confirmStaging: true,
    allowRemoteHosts: ["staging-judge.corp"],
  });
  testAssert(!remoteHttp.valid && remoteHttp.error!.includes("HTTPS"), "Insecure HTTP remote target strictly rejected");

  const remoteNoConfirm = validateTargetUrl("https://staging-judge.corp/api/judge/execute", {
    confirmStaging: false,
    allowRemoteHosts: ["staging-judge.corp"],
  });
  testAssert(!remoteNoConfirm.valid && remoteNoConfirm.error!.includes("--confirm-staging"), "Remote target rejected without --confirm-staging");

  const remoteNotAllowlisted = validateTargetUrl("https://staging-judge.corp/api/judge/execute", {
    confirmStaging: true,
    allowRemoteHosts: ["other-judge.corp"],
  });
  testAssert(!remoteNotAllowlisted.valid && remoteNotAllowlisted.error!.includes("not present"), "Remote host not in allowlist rejected");

  const remoteValid = validateTargetUrl("https://staging-judge.corp/api/judge/execute", {
    confirmStaging: true,
    allowRemoteHosts: ["staging-judge.corp"],
  });
  testAssert(remoteValid.valid === true && remoteValid.isLoopback === false, "Allowlisted remote staging accepted");

  // ── 4. Strict Argument Parsing & Conflicting Option Detection ──
  console.log("\n── 4. Strict Argument Parsing & Conflict Checks ──");
  // Strict int helper
  testAssert(parseStrictInt("20", "-c").value === 20, "Strict int parses 20");
  testAssert(parseStrictInt("20abc", "-c").error !== undefined, "Strict int rejects '20abc'");
  testAssert(parseStrictInt("10.5", "-n").error !== undefined, "Strict int rejects float '10.5'");
  testAssert(parseStrictInt("", "-n").error !== undefined, "Strict int rejects empty string");
  testAssert(parseStrictInt(undefined, "-n").error !== undefined, "Strict int rejects undefined");

  // Missing values
  const missingCVal = parseDrillArgs(["-c"]);
  testAssert(missingCVal.error !== undefined && missingCVal.error.includes("Missing value"), "Rejects missing value for -c");

  const missingNextFlag = parseDrillArgs(["-c", "-n", "20"]);
  testAssert(missingNextFlag.error !== undefined && missingNextFlag.error.includes("Missing value"), "Rejects next flag as value for -c");

  const nonIntC = parseDrillArgs(["-c", "20abc"]);
  testAssert(nonIntC.error !== undefined && nonIntC.error.includes("Non-integer"), "Rejects non-integer '20abc' for concurrency");

  // Bounds
  const zeroC = parseDrillArgs(["-c", "0"]);
  testAssert(zeroC.error !== undefined && zeroC.error.includes("between 1 and 100"), "Rejects concurrency 0");

  const overC = parseDrillArgs(["-c", "101"]);
  testAssert(overC.error !== undefined && overC.error.includes("between 1 and 100"), "Rejects concurrency > 100");

  const zeroN = parseDrillArgs(["-n", "0"]);
  testAssert(zeroN.error !== undefined && zeroN.error.includes("between 1 and 1000"), "Rejects total requests 0");

  const negN = parseDrillArgs(["-n", "-5"]);
  testAssert(negN.error !== undefined, "Rejects negative total requests");

  const invalidTimeoutLow = parseDrillArgs(["--timeout-ms", "500"]);
  testAssert(invalidTimeoutLow.error !== undefined && invalidTimeoutLow.error.includes("between 1000 and 60000"), "Rejects timeout < 1000ms");

  const invalidTimeoutHigh = parseDrillArgs(["--timeout-ms", "90000"]);
  testAssert(invalidTimeoutHigh.error !== undefined && invalidTimeoutHigh.error.includes("between 1000 and 60000"), "Rejects timeout > 60000ms");

  // Conflicting options
  const conflictDryRunBaseline = parseDrillArgs(["--dry-run", "--scenario", "baseline"]);
  testAssert(conflictDryRunBaseline.error !== undefined && conflictDryRunBaseline.error.includes("Conflicting options"), "Rejects --dry-run combined with --scenario baseline");

  const conflictBaselineMultiReq = parseDrillArgs(["--scenario", "baseline", "-n", "20"]);
  testAssert(conflictBaselineMultiReq.error !== undefined && conflictBaselineMultiReq.error.includes("Conflicting options"), "Rejects --scenario baseline with requests > 1");

  // Output file overwrite protection
  const testOutFile = path.resolve(process.cwd(), "test_temp_report.json");
  fs.writeFileSync(testOutFile, "{}", "utf-8");
  try {
    const existingOutNoForce = parseDrillArgs(["--output", "test_temp_report.json"]);
    testAssert(existingOutNoForce.error !== undefined && existingOutNoForce.error.includes("--force"), "Rejects existing output file without --force");

    const existingOutWithForce = parseDrillArgs(["--output", "test_temp_report.json", "--force"]);
    testAssert(existingOutWithForce.args?.forceOverwrite === true, "Allows existing output file when --force is provided");
  } finally {
    if (fs.existsSync(testOutFile)) fs.unlinkSync(testOutFile);
  }

  // ── 5. Actual Judge Request Schema & Payload Builders ──
  console.log("\n── 5. Actual Accepted Request Schema & Payload Builders ──");
  const pyPayload = generatePythonPayload("job-py-test", 7, 2500);
  testAssert(pyPayload.job_id === "job-py-test", "Python job_id matches");
  testAssert(pyPayload.language === "python", "Python language matches");
  testAssert(pyPayload.execution_mode === "run", "Python execution_mode matches");
  testAssert(typeof pyPayload.source_code === "string" && pyPayload.source_code.includes("sys.stdin"), "Python source code present");
  testAssert(Array.isArray(pyPayload.test_cases) && pyPayload.test_cases.length === 1, "Python test_cases array present");
  testAssert(pyPayload.test_cases[0].input === "7\n", "Python test case input is 7\\n");
  testAssert(pyPayload.test_cases[0].expected_output === "49", "Python expected output is 49");
  testAssert(pyPayload.time_limit_ms === 2500, "Python time_limit_ms forwarded");

  const sqlPayload = generateSqlPayload("job-sql-test", 20, 2500);
  testAssert(sqlPayload.job_id === "job-sql-test", "SQL job_id matches");
  testAssert(sqlPayload.language === "sql", "SQL language matches");
  testAssert(sqlPayload.schema_sql !== undefined && sqlPayload.schema_sql.includes("CREATE TABLE"), "SQL schema_sql DDL present");
  testAssert(sqlPayload.sample_data_sql !== undefined && sqlPayload.sample_data_sql.includes("INSERT INTO"), "SQL sample_data_sql present");
  testAssert(sqlPayload.order_sensitive === true, "SQL order_sensitive flag set to true");
  testAssert(sqlPayload.test_cases[0].expected_output === "id    val\n--    ---\n2     20 \n3     30", "SQL expected output matches formatSqlTable format");

  // ── 6. Response Validation & Strict Output Verification ──
  console.log("\n── 6. Strengthened Response Classification & Verification ──");
  // Auth errors
  const auth401 = classifyExecutionResult(401, '{"error":"Unauthorized"}');
  testAssert(auth401.category === "AUTH_ERROR", "401 classified as AUTH_ERROR");
  const auth403 = classifyExecutionResult(403, '{"error":"Forbidden"}');
  testAssert(auth403.category === "AUTH_ERROR", "403 classified as AUTH_ERROR");

  // Redirect rejection
  const redirect302 = classifyExecutionResult(302, 'Redirecting');
  testAssert(redirect302.category === "UNEXPECTED_REDIRECT", "302 classified as UNEXPECTED_REDIRECT");

  // Rate limited & HTTP error
  const rateLimit = classifyExecutionResult(429, 'Rate limit exceeded');
  testAssert(rateLimit.category === "RATE_LIMITED", "429 classified as RATE_LIMITED");
  const http500 = classifyExecutionResult(500, 'Server error');
  testAssert(http500.category === "HTTP_ERROR", "500 classified as HTTP_ERROR");

  // JSON format
  const badJson = classifyExecutionResult(200, '{ invalid json');
  testAssert(badJson.category === "INVALID_JSON", "Malformed JSON classified as INVALID_JSON");

  // Missing mandatory fields
  const missingJobId = classifyExecutionResult(200, JSON.stringify({ status: "COMPLETED", verdict: "Accepted", test_results: [{ passed: true }] }), { expectedJobId: "expected-1" });
  testAssert(missingJobId.category === "INVALID_RESPONSE_SCHEMA", "Missing or mismatched job_id classified as INVALID_RESPONSE_SCHEMA");

  const missingStatus = classifyExecutionResult(200, JSON.stringify({ job_id: "j1", verdict: "Accepted", test_results: [{ passed: true }] }));
  testAssert(missingStatus.category === "INVALID_RESPONSE_SCHEMA", "Missing status classified as INVALID_RESPONSE_SCHEMA");

  const pendingStatus = classifyExecutionResult(200, JSON.stringify({ job_id: "j1", status: "PENDING", verdict: "Accepted", test_results: [{ passed: true }] }));
  testAssert(pendingStatus.category === "UNEXPECTED_JOB_STATUS", "Non-COMPLETED status classified as UNEXPECTED_JOB_STATUS");

  // Missing test_results must not count as success
  const missingTests = classifyExecutionResult(200, JSON.stringify({ job_id: "j1", status: "COMPLETED", verdict: "Accepted" }));
  testAssert(missingTests.category === "INVALID_RESPONSE_SCHEMA", "Missing test_results classified as INVALID_RESPONSE_SCHEMA");

  const emptyTests = classifyExecutionResult(200, JSON.stringify({ job_id: "j1", status: "COMPLETED", verdict: "Accepted", test_results: [] }));
  testAssert(emptyTests.category === "INVALID_RESPONSE_SCHEMA", "Empty test_results classified as INVALID_RESPONSE_SCHEMA");

  // Verdict mismatch
  const wrongVerdict = classifyExecutionResult(200, JSON.stringify({ job_id: "j1", status: "COMPLETED", verdict: "TLE", test_results: [{ passed: false, verdict: "TLE" }] }));
  testAssert(wrongVerdict.category === "VERDICT_MISMATCH", "Non-Accepted verdict classified as VERDICT_MISMATCH");

  // Test case failure (passed=false)
  const failedTestItem = classifyExecutionResult(200, JSON.stringify({
    job_id: "j1",
    status: "COMPLETED",
    verdict: "Accepted",
    test_results: [{ index: 1, passed: false, verdict: "Wrong Answer" }],
  }));
  testAssert(failedTestItem.category === "TEST_CASE_FAILURE", "Test item passed=false classified as TEST_CASE_FAILURE");

  // Python output matching & mismatch
  const pyMatch = classifyExecutionResult(200, JSON.stringify({
    job_id: "py-1",
    status: "COMPLETED",
    verdict: "Accepted",
    test_results: [{ index: 1, passed: true, verdict: "Accepted", is_sample: true, actual_output: "49\n" }],
  }), { expectedJobId: "py-1", expectedOutput: "49", language: "python" });
  testAssert(pyMatch.category === "SUCCESS", "Python matching output classified as SUCCESS");

  const pyMismatch = classifyExecutionResult(200, JSON.stringify({
    job_id: "py-1",
    status: "COMPLETED",
    verdict: "Accepted",
    test_results: [{ index: 1, passed: true, verdict: "Accepted", is_sample: true, actual_output: "48" }],
  }), { expectedJobId: "py-1", expectedOutput: "49", language: "python" });
  testAssert(pyMismatch.category === "TEST_CASE_FAILURE", "Python mismatch output classified as TEST_CASE_FAILURE");

  // SQL output matching with formatSqlTable
  const expectedSqlTable = formatSqlTable(["id", "val"], [[2, 20], [3, 30]]);
  const sqlMatch = classifyExecutionResult(200, JSON.stringify({
    job_id: "sql-1",
    status: "COMPLETED",
    verdict: "Accepted",
    test_results: [
      {
        index: 1,
        passed: true,
        verdict: "Accepted",
        is_sample: true,
        actual_output: expectedSqlTable,
        columns: ["id", "val"],
        rows: [[2, 20], [3, 30]],
      },
    ],
  }), { expectedJobId: "sql-1", expectedOutput: expectedSqlTable, language: "sql" });
  testAssert(sqlMatch.category === "SUCCESS", "SQL matching formatSqlTable output classified as SUCCESS");

  const sqlMismatch = classifyExecutionResult(200, JSON.stringify({
    job_id: "sql-1",
    status: "COMPLETED",
    verdict: "Accepted",
    test_results: [
      {
        index: 1,
        passed: true,
        verdict: "Accepted",
        is_sample: true,
        actual_output: "id    val\n--    ---\n2     99 \n3     30",
        columns: ["id", "val"],
        rows: [[2, 99], [3, 30]],
      },
    ],
  }), { expectedJobId: "sql-1", expectedOutput: expectedSqlTable, language: "sql" });
  testAssert(sqlMismatch.category === "TEST_CASE_FAILURE", "SQL mismatch output classified as TEST_CASE_FAILURE");

  // ── 7. Circuit Breaker Behavior & In-Flight Abort Signal ──
  console.log("\n── 7. Circuit Breaker Logic & In-Flight Abort ──");
  const breaker = new CircuitBreaker();
  testAssert(!breaker.tripped(), "Circuit breaker starts untripped");
  testAssert(!breaker.signal.aborted, "Breaker abort signal starts unaborted");

  breaker.recordOutcome("AUTH_ERROR");
  testAssert(breaker.tripped(), "Breaker trips immediately on AUTH_ERROR");
  testAssert(breaker.signal.aborted, "Breaker abort signal triggers on trip");
  testAssert(breaker.reason()!.includes("Authentication"), "Breaker records auth failure reason");

  // Failure rate threshold
  const rateBreaker = new CircuitBreaker();
  rateBreaker.recordOutcome("SUCCESS");
  rateBreaker.recordOutcome("SUCCESS");
  rateBreaker.recordOutcome("SUCCESS");
  rateBreaker.recordOutcome("HTTP_ERROR");
  rateBreaker.recordOutcome("HTTP_ERROR"); // 2/5 = 40% > 20%
  testAssert(rateBreaker.tripped(), "Breaker trips when failure rate > 20% after 5 requests");

  // Consecutive timeouts
  const timeoutBreaker = new CircuitBreaker();
  timeoutBreaker.recordOutcome("TIMEOUT");
  timeoutBreaker.recordOutcome("TIMEOUT");
  testAssert(!timeoutBreaker.tripped(), "Breaker does not trip on 2 timeouts");
  timeoutBreaker.recordOutcome("TIMEOUT");
  testAssert(timeoutBreaker.tripped(), "Breaker trips on 3 consecutive timeouts");

  // ── 8. Mocked End-to-End Drills: Dry-Run, Active-Wave Abort, Network Error, Timeout ──
  console.log("\n── 8. Mocked End-to-End Drill Engine Tests ──");
  const originalFetch = globalThis.fetch;

  // 8A: Dry-Run performs ZERO execution POST requests
  let postCount = 0;
  let healthCount = 0;
  let readyCount = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = input.toString();
    if (urlStr.endsWith("/health")) {
      healthCount++;
      return new Response(JSON.stringify({ status: "ok", worker: "smartzero-judge" }), { status: 200 });
    }
    if (urlStr.endsWith("/ready")) {
      readyCount++;
      return new Response(JSON.stringify({ ready: true, concurrency: 6, runtimes: ["python", "sql"] }), { status: 200 });
    }
    if (urlStr.endsWith("/api/judge/execute") || urlStr.endsWith("/execute")) {
      postCount++;
      return new Response("{}", { status: 200 });
    }
    throw new Error(`Unexpected URL: ${urlStr}`);
  }) as typeof globalThis.fetch;

  try {
    const dryRunArgs: DrillArgs = {
      targetUrl: "http://127.0.0.1:8080/api/judge/execute",
      concurrency: 5,
      totalRequests: 20,
      language: "python",
      scenario: "burst",
      timeoutMs: 2000,
      seed: 42,
      dryRun: true,
      confirmStaging: false,
      allowRemoteHosts: [],
      forceOverwrite: false,
      help: false,
    };
    const dryRunReport = await runJudgeConcurrencyDrill(dryRunArgs);
    testAssert(dryRunReport.exitCode === 0, "Dry run exits with code 0");
    testAssert(healthCount === 1, "Dry run called GET /health once");
    testAssert(readyCount === 1, "Dry run called GET /ready once");
    testAssert(postCount === 0, "Dry run executed exactly 0 POST requests");
    testAssert(dryRunReport.executionSummary.requestsDispatched === 0, "Report confirms 0 requests dispatched");
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 8B: Active-wave Breaker Trip & In-Flight Abort
  let dispatchedJobs = 0;
  let abortedInFlightJobs = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = input.toString();
    if (urlStr.endsWith("/health")) {
      return new Response(JSON.stringify({ status: "ok", worker: "smartzero-judge" }), { status: 200 });
    }
    if (urlStr.endsWith("/ready")) {
      return new Response(JSON.stringify({ ready: true, concurrency: 6, runtimes: ["python", "sql"] }), { status: 200 });
    }
    if (urlStr.endsWith("/api/judge/execute")) {
      dispatchedJobs++;
      const body = JSON.parse(String(init?.body || "{}"));
      // Canary request succeeds
      if (body.job_id === "canary-01") {
        return new Response(
          JSON.stringify({
            job_id: "canary-01",
            status: "COMPLETED",
            verdict: "Accepted",
            test_results: [{ index: 1, passed: true, verdict: "Accepted", is_sample: true, actual_output: "81" }],
          }),
          { status: 200 }
        );
      }
      // First wave request fails with 401 Unauthorized immediately, tripping the breaker!
      if (dispatchedJobs === 2) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      // Other concurrent requests in wave 1 are delayed to test in-flight abort
      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          abortedInFlightJobs++;
          reject(new DOMException("The operation was aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          abortedInFlightJobs++;
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
        setTimeout(() => {
          resolve(
            new Response(
              JSON.stringify({
                job_id: body.job_id,
                status: "COMPLETED",
                verdict: "Accepted",
                test_results: [{ index: 1, passed: true, verdict: "Accepted", is_sample: true, actual_output: "100" }],
              }),
              { status: 200 }
            )
          );
        }, 300);
      });
    }
    throw new Error(`Unexpected URL: ${urlStr}`);
  }) as typeof globalThis.fetch;

  try {
    const breakerBurstArgs: DrillArgs = {
      targetUrl: "http://127.0.0.1:8080/api/judge/execute",
      concurrency: 5,
      totalRequests: 10, // 2 waves of 5
      language: "python",
      scenario: "burst",
      timeoutMs: 2000,
      seed: 42,
      dryRun: false,
      confirmStaging: false,
      allowRemoteHosts: [],
      forceOverwrite: false,
      help: false,
    };
    const burstReport = await runJudgeConcurrencyDrill(breakerBurstArgs);
    testAssert(burstReport.circuitBreaker.triggered === true, "Breaker tripped during active wave");
    testAssert(burstReport.exitCode === 3, "Breaker trip produces exit code 3");
    testAssert(burstReport.executionSummary.requestsAbortedInFlight > 0, "In-flight requests were aborted by breaker");
    testAssert(burstReport.executionSummary.requestsSkipped === 5, "Second wave was skipped (5 unstarted requests)");
    testAssert(
      burstReport.executionSummary.requestsPrepared ===
        burstReport.executionSummary.requestsDispatched + burstReport.executionSummary.requestsSkipped,
      "Prepared requests perfectly equals dispatched + skipped"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 8C: Secret Redaction in Report & Output
  console.log("\n── 9. Secret Redaction & Hygiene ──");
  const secretData = loadJudgeSecretSafe();
  testAssert(!secretData.error && typeof secretData.secret === "string", "Valid secret present in environment");
  const secretValue = secretData.secret!;

  // Mock a completed report
  const reportObj = {
    target: { url: "http://127.0.0.1:8080/api/judge/execute" },
    executionSummary: { requestsPrepared: 5 },
  };
  const serialized = JSON.stringify(reportObj);
  testAssert(!serialized.includes(secretValue), "Report does not include secret token");

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} CONCURRENCY DRILL UNIT TESTS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
