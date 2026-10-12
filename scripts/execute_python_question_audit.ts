import fs from "node:fs";
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}
import { createClient } from "@supabase/supabase-js";
import { executeInSandbox } from "../lib/judge/sandbox";
import { compareOutputs, normalizeOutput } from "../lib/judge/worker/worker";

const REFERENCE_SOLUTIONS: Record<string, string> = {
  "maximum subarray sum": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
nums = [int(x) for x in lines[1:n+1]]
max_so_far = nums[0]
curr_max = nums[0]
for x in nums[1:]:
    curr_max = max(x, curr_max + x)
    max_so_far = max(max_so_far, curr_max)
print(max_so_far)
`.trim(),

  "valid parentheses": `
import sys
s = sys.stdin.read().strip()
mapping = {')': '(', '}': '{', ']': '['}
stack = []
valid = True
for char in s:
    if char in '({[':
        stack.append(char)
    elif char in ')}]':
        if not stack or stack[-1] != mapping[char]:
            valid = False
            break
        stack.pop()
if valid and not stack:
    print("YES")
else:
    print("NO")
`.trim(),

  "two sum": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
target = int(lines[1])
nums = [int(x) for x in lines[2:n+2]]
found = None
for i in range(len(nums)):
    for j in range(i + 1, len(nums)):
        if nums[i] + nums[j] == target:
            found = (i, j)
            break
    if found:
        break
if found:
    print(f"{found[0]} {found[1]}")
`.trim(),

  "count distinct elements": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
nums = [int(x) for x in lines[1:n+1]]
print(len(set(nums)))
`.trim(),

  "student performance analyzer": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
marks = [int(x) for x in lines[1:n+1]]
high = max(marks)
low = min(marks)
avg = sum(marks) / n
above = sum(1 for x in marks if x > avg)
print(f"Highest: {high}")
print(f"Lowest: {low}")
print(f"Average: {avg:.1f}")
print(f"Above Average: {above}")
`.trim(),

  "bank transaction analyzer": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
txs = [int(x) for x in lines[1:n+1]]
balance = sum(txs)
deposits = sum(x for x in txs if x > 0)
withdrawals = sum(-x for x in txs if x < 0)
print(f"Final Balance: {balance}")
print(f"Total Deposits: {deposits}")
print(f"Total Withdrawals: {withdrawals}")
`.trim(),

  "inventory stock checker": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
stocks = [int(x) for x in lines[1:n+1]]
threshold = int(lines[n+1])
lowest = min(stocks)
below = sum(1 for x in stocks if x < threshold)
print(f"Lowest Stock: {lowest}")
print(f"Products Below Threshold: {below}")
`.trim(),

  "employee salary analyzer": `
import sys
lines = sys.stdin.read().split()
if not lines:
    sys.exit(0)
n = int(lines[0])
salaries = [int(x) for x in lines[1:n+1]]
avg = sum(salaries) / n
above = sum(1 for s in salaries if s > avg)
print(f"Average Salary: {avg:.1f}")
print(f"Employees Above Average: {above}")
`.trim(),

  "message analyzer": `
import sys
msg = sys.stdin.read().rstrip('\\r\\n')
vowels = "aeiouAEIOU"
v_count = 0
c_count = 0
d_count = 0
s_count = 0
for ch in msg:
    if ch in vowels:
        v_count += 1
    elif ch.isalpha():
        c_count += 1
    elif ch.isdigit():
        d_count += 1
    elif ch == ' ':
        s_count += 1
print(f"Vowels: {v_count}")
print(f"Consonants: {c_count}")
print(f"Digits: {d_count}")
print(f"Spaces: {s_count}")
`.trim(),
};

interface AuditItem {
  id: string;
  title: string;
  contests: string[];
  tcCount: number;
  status: "PASS" | "FAIL" | "BLOCKED" | "NEEDS REVIEW";
  details: string;
  failedTestCases: Array<{
    tcId: string;
    isSample: boolean;
    input: string;
    expected: string;
    actual: string;
    reason: string;
  }>;
}

async function runAudit() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("================================================================================");
  console.log("SMARTZERO 2.0 — FULL EXECUTION-BASED PYTHON CONTEST QUESTION AUDIT");
  console.log("================================================================================\n");

  const { data: contests } = await sb.from("contests").select("id, title, slug");
  const { data: links } = await sb.from("contest_questions").select("*");
  const { data: qs } = await sb
    .from("coding_questions")
    .select("*, test_cases:coding_test_cases(*)");

  const cMap = new Map((contests || []).map((c) => [c.id, c.title]));
  const codingLinks = (links || []).filter((l) => l.question_type === "coding");

  // Collect unique questions
  const qContestsMap = new Map<string, string[]>();
  for (const l of codingLinks) {
    if (!qContestsMap.has(l.question_id)) {
      qContestsMap.set(l.question_id, []);
    }
    const cTitle = cMap.get(l.contest_id) || l.contest_id;
    if (!qContestsMap.get(l.question_id)!.includes(cTitle)) {
      qContestsMap.get(l.question_id)!.push(cTitle);
    }
  }

  const results: AuditItem[] = [];

  for (const [qId, contestNames] of qContestsMap.entries()) {
    const q = qs?.find((x) => x.id === qId);
    if (!q) {
      results.push({
        id: qId,
        title: "UNKNOWN QUESTION",
        contests: contestNames,
        tcCount: 0,
        status: "BLOCKED",
        details: "Question record missing in coding_questions table",
        failedTestCases: [],
      });
      continue;
    }

    const testCases = q.test_cases || [];
    if (testCases.length === 0) {
      results.push({
        id: qId,
        title: q.title,
        contests: contestNames,
        tcCount: 0,
        status: "BLOCKED",
        details: "No test cases configured in coding_test_cases",
        failedTestCases: [],
      });
      continue;
    }

    // Match reference solution
    const key = q.title.trim().toLowerCase();
    const refCode = REFERENCE_SOLUTIONS[key];

    if (!refCode) {
      results.push({
        id: qId,
        title: q.title,
        contests: contestNames,
        tcCount: testCases.length,
        status: "NEEDS REVIEW",
        details: `No reference solution mapped for title: "${q.title}"`,
        failedTestCases: [],
      });
      continue;
    }

    // Execute directly in sandbox
    process.stdout.write(`[Executing] "${q.title}" (ID: ${q.id.slice(0, 8)}) [${contestNames.join(", ")}] — ${testCases.length} TCs... `);
    const failedTCs: AuditItem["failedTestCases"] = [];

    for (const tc of testCases) {
      const execRes = await executeInSandbox({
        code: refCode,
        language: "python",
        input: tc.input,
        timeLimitMs: Math.max(q.time_limit_ms || 2000, 4000), // generous limit for Windows python spawn
        memoryLimitMb: q.memory_limit_mb || 256,
      });

      if (execRes.verdict !== "Accepted") {
        failedTCs.push({
          tcId: tc.id,
          isSample: !!tc.is_sample,
          input: tc.input,
          expected: tc.expected_output,
          actual: execRes.actual_output || execRes.error || "",
          reason: `Execution failure: ${execRes.verdict} (${execRes.error || "No error detail"})`,
        });
      } else {
        // Compare output
        const matches = compareOutputs(execRes.actual_output, tc.expected_output);
        if (!matches) {
          failedTCs.push({
            tcId: tc.id,
            isSample: !!tc.is_sample,
            input: tc.input,
            expected: tc.expected_output,
            actual: execRes.actual_output || "",
            reason: `Output mismatch. Expected: ${JSON.stringify(normalizeOutput(tc.expected_output))}, Got: ${JSON.stringify(normalizeOutput(execRes.actual_output))}`,
          });
        }
      }
    }

    let status: "PASS" | "FAIL" | "BLOCKED" | "NEEDS REVIEW" = "PASS";
    let details = `Passed all ${testCases.length} test cases with AC.`;

    if (failedTCs.length > 0) {
      status = "FAIL";
      details = `${failedTCs.length}/${testCases.length} test cases failed.`;
      console.log(`❌ FAIL (${failedTCs.length}/${testCases.length} failed)`);
    } else {
      console.log(`✅ PASS`);
    }

    results.push({
      id: qId,
      title: q.title,
      contests: contestNames,
      tcCount: testCases.length,
      status,
      details,
      failedTestCases: failedTCs,
    });
  }

  // Print summary report
  console.log("\n================================================================================");
  console.log("FINAL AUDIT SUMMARY REPORT — ALL 28 LINKED PYTHON QUESTIONS");
  console.log("================================================================================\n");

  const passed = results.filter((r) => r.status === "PASS");
  const failed = results.filter((r) => r.status === "FAIL");
  const blocked = results.filter((r) => r.status === "BLOCKED");
  const review = results.filter((r) => r.status === "NEEDS REVIEW");

  console.log(`TOTAL QUESTIONS AUDITED : ${results.length}`);
  console.log(`  ✅ PASS               : ${passed.length}`);
  console.log(`  ❌ FAIL               : ${failed.length}`);
  console.log(`  🚫 BLOCKED            : ${blocked.length}`);
  console.log(`  ⚠️  NEEDS REVIEW       : ${review.length}\n`);

  console.log("DETAILED QUESTION CLASSIFICATIONS:\n");
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const badge = r.status === "PASS" ? "✅ PASS" : r.status === "FAIL" ? "❌ FAIL" : "⚠️ " + r.status;
    console.log(`${(i + 1).toString().padStart(2, " ")}. [${badge}] "${r.title}" (ID: ${r.id})`);
    console.log(`    Contest(s) : ${r.contests.join(", ")}`);
    console.log(`    Test Cases : ${r.tcCount}`);
    console.log(`    Outcome    : ${r.details}`);
    if (r.failedTestCases.length > 0) {
      console.log(`    Defect details:`);
      for (const f of r.failedTestCases) {
        console.log(`      - TC ${f.tcId} [Sample: ${f.isSample}]: ${f.reason}`);
        console.log(`        Input   : ${JSON.stringify(f.input)}`);
        console.log(`        Expected: ${JSON.stringify(f.expected)}`);
        console.log(`        Actual  : ${JSON.stringify(f.actual)}`);
      }
    }
  }

  return { total: results.length, passed: passed.length, failed: failed.length, results };
}

runAudit().catch(console.error);
