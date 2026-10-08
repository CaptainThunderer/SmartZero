export {};
const WORKER_URL = "http://127.0.0.1:8080";
const SECRET = process.env.JUDGE_WORKER_SECRET || process.env.SMARTZERO_TEST_SECRET || "mock-test-judge-secret-not-for-production";

async function execute(source: string) {
  const res = await fetch(`${WORKER_URL}/api/judge/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      job_id: "scoring-" + Date.now(),
      language: "python",
      source_code: source,
      execution_mode: "submit",
      test_cases: [
        { id: "v1", input: "1\n", expected_output: "1", weight: 1, is_sample: true },
        { id: "h1", input: "2\n", expected_output: "2", weight: 2, is_sample: false },
      ],
      total_marks: 30, // weight: 1 + 2 = 3.
    }),
  });
  return res.json();
}

async function run() {
  // 1. All pass: 3/3 * 30 = 30
  const all = await execute("print(input())");
  console.log("All pass:", { score: all.score, max_score: all.max_score, verdict: all.verdict, passed: all.passed_tests });

  // 2. Partial pass: passes v1 (input 1), fails h1 (input 2) -> 1/3 * 30 = 10
  const part = await execute("x = input()\nprint('1' if x == '1' else 'wrong')");
  console.log("Partial pass:", { score: part.score, max_score: part.max_score, verdict: part.verdict, passed: part.passed_tests });

  // 3. Zero pass: 0/3 * 30 = 0
  const zero = await execute("print('wrong')");
  console.log("Zero pass:", { score: zero.score, max_score: zero.max_score, verdict: zero.verdict, passed: zero.passed_tests });
}

run().catch(console.error);
