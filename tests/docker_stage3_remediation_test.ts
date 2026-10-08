import assert from "node:assert/strict";

const WORKER_URL = "http://127.0.0.1:8080";
const SECRET = process.env.JUDGE_WORKER_SECRET || process.env.SMARTZERO_TEST_SECRET || "mock-test-judge-secret-not-for-production";

console.log("==================================================");
console.log("▶ PHASE 15F — STAGE 3 REMEDIATION REGRESSION TEST");
console.log("==================================================\n");

async function executeJob(payload: Record<string, unknown>, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(`${WORKER_URL}/api/judge/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    return { status: res.status, data, elapsedMs: Date.now() - t0 };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, data: null, error: (err as Error).message, elapsedMs: Date.now() - t0 };
  }
}

async function run() {
  let passed = 0;
  function check(name: string, ok: boolean, detail = "") {
    assert(ok, `FAILED: ${name} - ${detail}`);
    console.log(`  ✅ ${name}: PASS ${detail ? `(${detail})` : ""}`);
    passed++;
  }

  // 1. Multi-language
  console.log("── Multi-Language Execution ──");
  const py = await executeJob({
    job_id: "reg-py",
    language: "python",
    source_code: 'print("SMARTZERO_PYTHON_OK")',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "SMARTZERO_PYTHON_OK", is_sample: true }],
  });
  check("Python", py.data?.verdict === "Accepted", `${py.elapsedMs}ms`);

  const js = await executeJob({
    job_id: "reg-js",
    language: "javascript",
    source_code: 'console.log("SMARTZERO_NODE_OK");',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "SMARTZERO_NODE_OK", is_sample: true }],
  });
  check("JavaScript", js.data?.verdict === "Accepted", `${js.elapsedMs}ms`);

  const ts = await executeJob({
    job_id: "reg-ts",
    language: "typescript",
    source_code: 'console.log("SMARTZERO_TS_OK");',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "SMARTZERO_TS_OK", is_sample: true }],
  });
  check("TypeScript", ts.data?.verdict === "Accepted", `${ts.elapsedMs}ms`);

  const cpp = await executeJob({
    job_id: "reg-cpp",
    language: "cpp",
    source_code: '#include <iostream>\nint main(){ std::cout << "SMARTZERO_CPP_OK"; }',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "SMARTZERO_CPP_OK", is_sample: true }],
  });
  check("C++", cpp.data?.verdict === "Accepted", `${cpp.elapsedMs}ms`);

  const java = await executeJob({
    job_id: "reg-java",
    language: "java",
    source_code: 'public class Main { public static void main(String[] args) { System.out.print("SMARTZERO_JAVA_OK"); } }',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "SMARTZERO_JAVA_OK", is_sample: true }],
  });
  check("Java", java.data?.verdict === "Accepted", `${java.elapsedMs}ms`);

  // 2. Compilation Errors
  console.log("\n── Compilation Errors ──");
  const ceCpp = await executeJob({
    job_id: "reg-ce-cpp",
    language: "cpp",
    source_code: "int main(){ BROKEN }",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "" }],
  });
  check("C++ Compilation Error", ceCpp.data?.verdict === "Compilation Error");

  const ceJava = await executeJob({
    job_id: "reg-ce-java",
    language: "java",
    source_code: "public class Main { BROKEN }",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "" }],
  });
  check("Java Compilation Error", ceJava.data?.verdict === "Compilation Error");

  // 3. Runtime Error
  console.log("\n── Runtime Error ──");
  const rte = await executeJob({
    job_id: "reg-rte",
    language: "python",
    source_code: "1 / 0",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "" }],
  });
  check("Runtime Error", rte.data?.verdict === "Runtime Error");

  // 4. Time Limit
  console.log("\n── Time Limit (TLE) ──");
  const tle = await executeJob({
    job_id: "reg-tle",
    language: "python",
    source_code: "while True: pass",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "" }],
    time_limit_ms: 1000,
  });
  check("TLE", tle.data?.verdict === "TLE" && tle.elapsedMs < 3000, `${tle.elapsedMs}ms`);

  // 5. Output Limit
  console.log("\n── Output Limit (64KB) ──");
  const out = await executeJob({
    job_id: "reg-out",
    language: "python",
    source_code: "print('Z' * 200000)",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
  });
  const actualLen = (out.data?.test_results?.[0]?.actual_output || "").length;
  check("Output Cap 64KB", actualLen <= 65536 && actualLen > 0, `${actualLen} bytes`);

  // 6. Non-Root
  console.log("\n── Non-Root UID 1001 ──");
  const uid = await executeJob({
    job_id: "reg-uid",
    language: "python",
    source_code: "import os\nprint(f'UID:{os.getuid()}')",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
  });
  check("Non-Root", (uid.data?.test_results?.[0]?.actual_output || "").includes("UID:1001"));

  // 7. Secrets Isolation
  console.log("\n── Secrets Isolation ──");
  const env = await executeJob({
    job_id: "reg-env",
    language: "python",
    source_code: "import os\nfor k in sorted(os.environ.keys()): print(k)",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
  });
  const envOut = env.data?.test_results?.[0]?.actual_output || "";
  check("Secrets Stripped", !envOut.includes("SECRET") && !envOut.includes("SUPABASE"));

  // 8. Hidden Tests Protection
  console.log("\n── Hidden Test Protection ──");
  const hidden = await executeJob({
    job_id: "reg-hidden",
    language: "python",
    source_code: "print(int(input()) * 2)",
    execution_mode: "submit",
    test_cases: [
      { id: "v1", input: "5\n", expected_output: "10", is_sample: true },
      { id: "h1", input: "100\n", expected_output: "200", is_sample: false },
    ],
    total_marks: 20,
  });
  const hResults = hidden.data?.test_results || [];
  const visCase = hResults.find((t: any) => t.is_sample);
  const hidCase = hResults.find((t: any) => !t.is_sample);
  check("Hidden Input Masked", hidCase && hidCase.input === undefined);
  check("Hidden Output Masked", hidCase && hidCase.expected_output === undefined);
  check("Sample Input Retained", visCase && visCase.input === "5\n");

  // 9. Weighted Scoring
  console.log("\n── Weighted Scoring ──");
  const scoring = await executeJob({
    job_id: "reg-score",
    language: "python",
    source_code: "a = input()\nprint('1' if a == '1' else 'wrong')",
    execution_mode: "submit",
    test_cases: [
      { id: "1", input: "1\n", expected_output: "1", weight: 1, is_sample: true },
      { id: "2", input: "2\n", expected_output: "2", weight: 2, is_sample: false },
    ],
    total_marks: 30,
  });
  check("Weighted Score", scoring.data?.score === 10, "10/30 marks (weight 1 passed)");
  check("Partial Verdict", scoring.data?.verdict === "Partial Accepted");

  // 10. Authentication
  console.log("\n── Authentication ──");
  const noAuth = await fetch(`${WORKER_URL}/api/judge/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: "auth-none" }),
  });
  check("No Auth 401", noAuth.status === 401);

  const wrongAuth = await fetch(`${WORKER_URL}/api/judge/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer WRONG_KEY" },
    body: JSON.stringify({ job_id: "auth-wrong" }),
  });
  check("Wrong Auth 401", wrongAuth.status === 401);

  // 11. Network Isolation
  console.log("\n── Network Isolation ──");
  const netPy = await executeJob({
    job_id: "reg-net-py",
    language: "python",
    source_code: "import socket\ns = socket.socket()\ns.settimeout(2)\ntry:\n  s.connect(('8.8.8.8', 53))\n  print('NET_OPEN')\nexcept Exception as e:\n  print(f'NET_BLOCKED:{type(e).__name__}')",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
  });
  const netPyOut = netPy.data?.test_results?.[0]?.actual_output || "";
  check("Python Outbound Network Blocked", netPyOut.includes("NET_BLOCKED"), netPyOut.trim());

  const netNode = await executeJob({
    job_id: "reg-net-node",
    language: "javascript",
    source_code: "const net = require('net'); const c = net.createConnection({host:'8.8.8.8', port:53, timeout:2000}); c.on('connect', ()=>console.log('NET_OPEN')); c.on('error', e=>console.log('NET_BLOCKED:'+e.code));",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
  });
  const netNodeOut = netNode.data?.test_results?.[0]?.actual_output || "";
  check("Node Outbound Network Blocked", netNodeOut.includes("NET_BLOCKED"), netNodeOut.trim());

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} REMEDIATION REGRESSION TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
