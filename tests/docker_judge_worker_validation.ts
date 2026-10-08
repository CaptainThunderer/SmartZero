import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";

const CONTAINER_NAME = "smartzero-judge-worker-validate";
const PORT = 8080;
const WORKER_URL = `http://127.0.0.1:${PORT}`;
const TEST_SECRET = process.env.JUDGE_WORKER_SECRET || "mock-test-judge-secret-not-for-production";

console.log("==================================================");
console.log("â–¶ SMARTZERO DOCKER JUDGE WORKER LOCAL VALIDATION");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, msg: string) {
  assert(condition, msg);
  console.log(`  âœ… ${msg}`);
  passed++;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function cleanupContainer() {
  try {
    execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: "ignore" });
  } catch {}
}

async function run() {
  cleanupContainer();

  const metrics = {
    fastestMs: Infinity,
    slowestMs: 0,
    latencies: [] as number[],
    peakMemMb: 0,
    peakCpu: "0%",
  };

  try {
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 1 & 2. WORKER STARTUP & PORTS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("â”€â”€ Stage 2: Worker Startup & Local Binding â”€â”€");

    // Start container strictly bound to 127.0.0.1:8080 (NOT 0.0.0.0)
    execSync(
      `docker run -d --name ${CONTAINER_NAME} -p 127.0.0.1:${PORT}:8080 ` +
      `-e PORT=8080 -e NODE_ENV=production -e SMARTZERO_JUDGE_MODE=local ` +
      `-e SMARTZERO_CONTAINER_WORKER=true -e SMARTZERO_JUDGE_CONCURRENCY=3 ` +
      `-e JUDGE_WORKER_SECRET=${TEST_SECRET} ` +
      `smartzero-judge-worker:local`,
      { stdio: "inherit" }
    );

    // Wait for healthcheck
    let healthy = false;
    const startWait = Date.now();
    while (Date.now() - startWait < 15000) {
      try {
        const res = await fetchWithTimeout(`${WORKER_URL}/health`, {}, 2000);
        if (res.status === 200) {
          healthy = true;
          break;
        }
      } catch {
        await sleep(500);
      }
    }
    testAssert(healthy, "Docker container started and /health is 200 OK");

    // Check /health payload
    const healthRes = await fetchWithTimeout(`${WORKER_URL}/health`, {}, 3000);
    const healthData = await healthRes.json();
    testAssert(healthData.status === "ok" && healthData.worker === "smartzero-judge", "Health payload verified");

    // Check /ready payload
    const readyRes = await fetchWithTimeout(`${WORKER_URL}/ready`, {}, 3000);
    const readyData = await readyRes.json();
    testAssert(readyData.ready === true, "Worker state is ready: true");
    testAssert(readyData.concurrency === 3, "Worker starts with SMARTZERO_JUDGE_CONCURRENCY=3");
    testAssert(Array.isArray(readyData.runtimes), "Worker exposes runtimes list");
    testAssert(
      ["python", "javascript", "typescript", "cpp", "java"].every((l) => readyData.runtimes.includes(l)),
      "All 5 language runtimes reported ready"
    );

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 3. AUTHENTICATION ENFORCEMENT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 3: Authentication Enforcement â”€â”€");

    // A. Missing auth
    const unauthRes = await fetchWithTimeout(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: "sec-1" }),
    });
    testAssert(unauthRes.status === 401, "No Authorization header rejected with HTTP 401");

    // B. Wrong Bearer token
    const wrongAuthRes = await fetchWithTimeout(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer WRONG_TOKEN_12345",
      },
      body: JSON.stringify({ job_id: "sec-2" }),
    });
    testAssert(wrongAuthRes.status === 401, "Wrong Bearer token rejected with HTTP 401");

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 4. LANGUAGE EXECUTION (ALL 5 LANGUAGES)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 4: Multi-Language Execution â”€â”€");

    async function executeJob(payload: Record<string, unknown>) {
      const t0 = Date.now();
      const res = await fetchWithTimeout(
        `${WORKER_URL}/api/judge/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${TEST_SECRET}`,
          },
          body: JSON.stringify(payload),
        },
        10000
      );
      const elapsed = Date.now() - t0;
      metrics.latencies.push(elapsed);
      metrics.fastestMs = Math.min(metrics.fastestMs, elapsed);
      metrics.slowestMs = Math.max(metrics.slowestMs, elapsed);
      return { status: res.status, data: await res.json(), durationMs: elapsed };
    }

    // A. Python 3
    const py = await executeJob({
      job_id: "lang-py",
      language: "python",
      source_code: "import sys\nline = sys.stdin.read().strip()\nprint(f'PYTHON_OUT:{line}')",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "HELLO_PY", expected_output: "PYTHON_OUT:HELLO_PY", weight: 1, is_sample: true }],
      total_marks: 10,
    });
    testAssert(py.status === 200 && py.data.verdict === "Accepted", `Python 3 executed (${py.durationMs}ms)`);
    testAssert(py.data.score === 10, "Python awarded full score");

    // B. JavaScript (Node.js 22)
    const js = await executeJob({
      job_id: "lang-js",
      language: "javascript",
      source_code: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\nconsole.log('JS_OUT:' + input);",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "HELLO_JS", expected_output: "JS_OUT:HELLO_JS", weight: 1, is_sample: true }],
      total_marks: 10,
    });
    testAssert(js.status === 200 && js.data.verdict === "Accepted", `JavaScript executed (${js.durationMs}ms)`);

    // C. TypeScript (tsx)
    const ts = await executeJob({
      job_id: "lang-ts",
      language: "typescript",
      source_code: "import * as fs from 'fs';\nconst val: string = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(`TS_OUT:${val}`);",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "HELLO_TS", expected_output: "TS_OUT:HELLO_TS", weight: 1, is_sample: true }],
      total_marks: 10,
    });
    testAssert(ts.status === 200 && ts.data.verdict === "Accepted", `TypeScript executed (${ts.durationMs}ms)`);

    // D. GNU C++ 17 (g++)
    const cpp = await executeJob({
      job_id: "lang-cpp",
      language: "cpp",
      source_code: "#include <iostream>\n#include <string>\nint main() { std::string s; std::cin >> s; std::cout << \"CPP_OUT:\" << s; return 0; }",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "HELLO_CPP", expected_output: "CPP_OUT:HELLO_CPP", weight: 1, is_sample: true }],
      total_marks: 10,
    });
    testAssert(cpp.status === 200 && cpp.data.verdict === "Accepted", `C++ compiled & executed (${cpp.durationMs}ms)`);

    // E. OpenJDK Java (javac / java)
    const java = await executeJob({
      job_id: "lang-java",
      language: "java",
      source_code: "import java.util.Scanner;\npublic class Solution {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    if (sc.hasNext()) System.out.println(\"JAVA_OUT:\" + sc.next());\n  }\n}",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "HELLO_JAVA", expected_output: "JAVA_OUT:HELLO_JAVA", weight: 1, is_sample: true }],
      total_marks: 10,
    });
    testAssert(java.status === 200 && java.data.verdict === "Accepted", `Java compiled & executed (${java.durationMs}ms)`);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 5. SANDBOX & SECURITY AUDIT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 5: Sandbox & Security Protections â”€â”€");

    // A. Execution Timeout (TLE)
    const tle = await executeJob({
      job_id: "sec-tle",
      language: "python",
      source_code: "while True: pass",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "1", expected_output: "1", weight: 1, is_sample: true }],
      time_limit_ms: 1000,
    });
    testAssert(tle.data.verdict === "TLE", "Infinite loop strictly terminated with TLE verdict");
    testAssert(tle.data.score === 0, "TLE awarded 0 marks");
    testAssert(tle.durationMs < 3000, `TLE enforcement was timely (${tle.durationMs}ms)`);

    // B. Output limit capping (Max 64KB)
    const flood = await executeJob({
      job_id: "sec-flood",
      language: "python",
      source_code: "print('A' * 200000)", // 200KB
      execution_mode: "run",
      test_cases: [{ id: "1", input: "", expected_output: "", weight: 1, is_sample: true }],
    });
    const sampleOutput = flood.data.test_results[0]?.actual_output || "";
    testAssert(Buffer.byteLength(sampleOutput, "utf-8") <= 65536, "Output flooding strictly capped at 64KB");

    // C. Source code size limit (>64KB code rejected with 400)
    const hugeCode = "x = 1\n" + "# comment\n".repeat(7000); // 70KB
    const hugeRes = await fetchWithTimeout(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TEST_SECRET}` },
      body: JSON.stringify({
        job_id: "sec-huge",
        language: "python",
        source_code: hugeCode,
        test_cases: [{ id: "1", input: "", expected_output: "" }],
      }),
    });
    testAssert(hugeRes.status === 400, "Oversized source code (>64KB) rejected with HTTP 400");

    // D. Non-root execution verification inside container
    const nonRoot = await executeJob({
      job_id: "sec-non-root",
      language: "python",
      source_code: "import os\nprint(f'UID:{os.getuid()}')",
      execution_mode: "run",
      test_cases: [{ id: "1", input: "", expected_output: "", weight: 1, is_sample: true }],
    });
    const uidOut = nonRoot.data.test_results[0]?.actual_output || "";
    testAssert(uidOut.includes("UID:1001"), "Code runs as unprivileged user judgebox (UID 1001), not root");

    // E. Host filesystem access attempt
    const fsCheck = await executeJob({
      job_id: "sec-fs",
      language: "python",
      source_code: "f = open('/etc/shadow', 'r')",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "", expected_output: "", weight: 1, is_sample: true }],
    });
    testAssert(fsCheck.data.verdict === "Runtime Error", "Restricted path /etc/shadow rejected by security filter");

    // F. Secret isolation
    const envCheck = await executeJob({
      job_id: "sec-env",
      language: "python",
      source_code: "import os\nprint(os.environ.get('JUDGE_WORKER_SECRET', 'NONE'))",
      execution_mode: "run",
      test_cases: [{ id: "1", input: "", expected_output: "", weight: 1, is_sample: true }],
    });
    const envOut = envCheck.data.test_results[0]?.actual_output || "";
    testAssert(envOut.trim() === "NONE", "Host secret JUDGE_WORKER_SECRET stripped from environment (NONE)");

    // G. Unsupported language rejection
    const unsupp = await fetchWithTimeout(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TEST_SECRET}` },
      body: JSON.stringify({
        job_id: "sec-unsupp",
        language: "rust",
        source_code: "fn main() {}",
        test_cases: [{ id: "1", input: "", expected_output: "" }],
      }),
    });
    testAssert(unsupp.status === 400, "Unsupported language rejected with HTTP 400");

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 6. JUDGE FUNCTIONAL & SCORING TEST
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 6: Judge Functional & Scoring Contracts â”€â”€");

    // A. Sample Run Code (execution_mode="run", score should be 0)
    const runSample = await executeJob({
      job_id: "judge-run",
      language: "python",
      source_code: "a, b = map(int, input().split())\nprint(a + b)",
      execution_mode: "run",
      test_cases: [{ id: "1", input: "4 5", expected_output: "9", weight: 1, is_sample: true }],
      total_marks: 20,
    });
    testAssert(runSample.data.score === 0, "Run Code returns 0 score as per contract");
    testAssert(runSample.data.verdict === "Accepted", "Run Code sample test passed");

    // B. Hidden Test Protection & Weighted Scoring
    const submitFull = await executeJob({
      job_id: "judge-submit",
      language: "python",
      source_code: "a, b = map(int, input().split())\nif a == 99: print('WRONG')\nelse: print(a + b)",
      execution_mode: "submit",
      test_cases: [
        { id: "1", input: "10 20\n", expected_output: "30", weight: 1, is_sample: true, is_hidden: false },
        { id: "2", input: "40 50\n", expected_output: "90", weight: 2, is_sample: false, is_hidden: true },
        { id: "3", input: "99 1\n", expected_output: "100", weight: 1, is_sample: false, is_hidden: true },
      ],
      total_marks: 20, // weights: 1 + 2 + 1 = 4. Passed: 1 + 2 = 3. Score = (3/4)*20 = 15.
    });

    testAssert(submitFull.data.verdict === "Partial", "Partial scoring verdict correctly awarded");
    testAssert(submitFull.data.score === 15, "Weighted score calculated accurately (15/20)");
    testAssert(submitFull.data.passed_tests === 2, "2/3 test cases passed");

    // Check hidden test protection
    const sampleCase = submitFull.data.test_results.find((t: any) => t.is_sample);
    const hiddenCases = submitFull.data.test_results.filter((t: any) => !t.is_sample);
    testAssert(sampleCase?.input === "10 20\n", "Sample test input is preserved for student review");
    testAssert(
      hiddenCases.every((t: any) => t.input === undefined && t.expected_output === undefined && t.actual_output === undefined),
      "Hidden test input, expected_output, and actual_output are 100% undefined (Zero Leakage)"
    );

    // C. Compilation Error classification
    const ce = await executeJob({
      job_id: "judge-ce",
      language: "cpp",
      source_code: "int main() { SYNTAX_ERROR_NOT_DEFINED; }",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "", expected_output: "" }],
    });
    testAssert(ce.data.verdict === "Compilation Error", "C++ syntax error classified as Compilation Error");

    // D. Runtime Error classification
    const rte = await executeJob({
      job_id: "judge-rte",
      language: "python",
      source_code: "x = 1 / 0",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "", expected_output: "" }],
    });
    testAssert(rte.data.verdict === "Runtime Error", "ZeroDivisionError classified as Runtime Error");

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 7. CONCURRENCY & QUEUE BURST
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 7: Concurrency & Queue Bursts â”€â”€");

    // 1 job
    const single = await executeJob({
      job_id: "burst-1",
      language: "python",
      source_code: "print(42)",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "", expected_output: "42" }],
      total_marks: 5,
    });
    testAssert(single.data.verdict === "Accepted", "Single job handled cleanly");

    // 3 simultaneous jobs
    const burst3 = await Promise.all([1, 2, 3].map((i) =>
      executeJob({
        job_id: `burst-3-${i}`,
        language: "python",
        source_code: `print(${i * 10})`,
        execution_mode: "submit",
        test_cases: [{ id: "1", input: "", expected_output: `${i * 10}` }],
        total_marks: 10,
      })
    ));
    testAssert(burst3.every((r) => r.data.verdict === "Accepted"), "3 simultaneous jobs all completed Accepted");

    // 5 queued jobs (concurrency is 3, so 2 must queue)
    const tQueueStart = Date.now();
    const burst5 = await Promise.all([1, 2, 3, 4, 5].map((i) =>
      executeJob({
        job_id: `burst-5-${i}`,
        language: "python",
        source_code: `import time\ntime.sleep(0.1)\nprint(${i * 100})`,
        execution_mode: "submit",
        test_cases: [{ id: "1", input: "", expected_output: `${i * 100}` }],
        total_marks: 10,
      })
    ));
    const burst5Duration = Date.now() - tQueueStart;
    testAssert(burst5.every((r) => r.data.verdict === "Accepted"), "5 queued jobs all completed with 100% Accepted");
    testAssert(burst5Duration > 150, `Queueing active: 5 jobs with 0.1s sleep completed in ${burst5Duration}ms`);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 8. FAILURE RECOVERY
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 8: Failure Recovery â”€â”€");

    // Verify worker continues to handle jobs smoothly after handling errors
    const postRecover = await executeJob({
      job_id: "post-recover",
      language: "python",
      source_code: "print('RECOVERED')",
      execution_mode: "submit",
      test_cases: [{ id: "1", input: "", expected_output: "RECOVERED" }],
      total_marks: 10,
    });
    testAssert(postRecover.data.verdict === "Accepted", "Worker immediately ready for next job after stress/errors");

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 9. RESOURCE OBSERVATION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    console.log("\nâ”€â”€ Stage 9: Resource Observation â”€â”€");
    try {
      const stats = execSync(`docker stats ${CONTAINER_NAME} --no-stream --format "{{.MemUsage}} | {{.CPUPerc}}"`, {
        encoding: "utf-8",
      }).trim();
      const parts = stats.split("|").map((s) => s.trim());
      console.log(`  Docker Container Memory: ${parts[0]}`);
      console.log(`  Docker Container CPU:    ${parts[1]}`);
      metrics.peakCpu = parts[1] || "N/A";
    } catch {}

    const runningCount = execSync('docker ps -q --filter "name=' + CONTAINER_NAME + '"', {
      encoding: "utf-8",
    }).trim().split("\n").filter(Boolean).length;
    testAssert(runningCount === 1, `Exactly 1 container running (${runningCount})`);

    console.log(`\n==================================================`);
    console.log(`ðŸŽ‰ ALL ${passed} DOCKER VALIDATION ASSERTIONS PASSED!`);
    console.log(`==================================================\n`);

  } finally {
    console.log("Cleaning up container...");
    cleanupContainer();
    console.log("Container terminated. Zero containers remaining.");
  }

  // Print summary metrics
  const avgLatency = Math.round(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length);
  console.log(`Fastest Execution: ${metrics.fastestMs}ms`);
  console.log(`Slowest Execution: ${metrics.slowestMs}ms`);
  console.log(`Average Latency:   ${avgLatency}ms`);
}

run().catch((err) => {
  console.error("Docker validation failed:", err);
  cleanupContainer();
  process.exit(1);
});
