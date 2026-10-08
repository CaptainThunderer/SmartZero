import assert from "node:assert/strict";

const WORKER_URL = "http://127.0.0.1:8080";
const SECRET = process.env.JUDGE_WORKER_SECRET || process.env.SMARTZERO_TEST_SECRET || "mock-test-judge-secret-not-for-production";

console.log("==================================================");
console.log("▶ PHASE 15F — CLEAN IMAGE AUTOMATED VERIFICATION");
console.log("==================================================\n");

async function executeJob(payload: Record<string, unknown>, timeoutMs = 8000) {
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
  function testAssert(cond: boolean, name: string, detail = "") {
    assert(cond, `FAILED: ${name}`);
    console.log(`  ✅ ${name}: PASS ${detail ? `(${detail})` : ""}`);
    passed++;
  }

  // 1. Python Execution
  const py = await executeJob({
    job_id: "clean-py",
    language: "python",
    source_code: "print('CLEAN_PY_SUCCESS')",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "CLEAN_PY_SUCCESS", is_sample: true }],
  });
  testAssert(py.data?.verdict === "Accepted" && py.data?.score === 20, "Python execution", `${py.elapsedMs}ms`);

  // 2. C++ Execution
  const cpp = await executeJob({
    job_id: "clean-cpp",
    language: "cpp",
    source_code: '#include <iostream>\nint main(){ std::cout << "CLEAN_CPP_SUCCESS"; }',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "CLEAN_CPP_SUCCESS", is_sample: true }],
  });
  testAssert(cpp.data?.verdict === "Accepted" && cpp.data?.score === 20, "C++ execution", `${cpp.elapsedMs}ms`);

  // 3. Java Execution
  const java = await executeJob({
    job_id: "clean-java",
    language: "java",
    source_code: 'public class Main { public static void main(String[] args) { System.out.print("CLEAN_JAVA_SUCCESS"); } }',
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "CLEAN_JAVA_SUCCESS", is_sample: true }],
  });
  testAssert(java.data?.verdict === "Accepted" && java.data?.score === 20, "Java execution", `${java.elapsedMs}ms`);

  // 4. Outbound Network from student code
  const net = await executeJob({
    job_id: "clean-net-block",
    language: "python",
    source_code: "import socket\ns = socket.socket()\ns.settimeout(2)\ntry:\n  s.connect(('8.8.8.8', 53))\n  print('NET_UNPROTECTED')\nexcept Exception as e:\n  print(f'NET_BLOCKED:{type(e).__name__}')",
    execution_mode: "submit",
    test_cases: [{ id: "1", input: "", expected_output: "", is_sample: true }],
  });
  const netOut = net.data?.test_results?.[0]?.actual_output || "";
  testAssert(netOut.includes("NET_BLOCKED"), "Outbound network blocked", netOut.trim());

  // 5. Hidden Tests Masked
  const hidden = await executeJob({
    job_id: "clean-hidden",
    language: "python",
    source_code: "print(int(input()) + 1)",
    execution_mode: "submit",
    test_cases: [
      { id: "v1", input: "10\n", expected_output: "11", is_sample: true },
      { id: "h1", input: "99\n", expected_output: "100", is_sample: false },
    ],
    total_marks: 20,
  });
  const hRes = hidden.data?.test_results || [];
  const vis = hRes.find((t: any) => t.is_sample);
  const hid = hRes.find((t: any) => !t.is_sample);
  testAssert(
    vis?.input === "10\n" && hid?.input === undefined && hid?.expected_output === undefined,
    "Hidden tests masked",
    "Zero leakage"
  );

  // 6. Worker remains healthy
  const healthRes = await fetch(`${WORKER_URL}/health`);
  const health = await healthRes.json();
  testAssert(health.status === "ok", "Worker remains healthy");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} CLEAN IMAGE VALIDATION CHECKS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Clean image validation failed:", err);
  process.exit(1);
});
