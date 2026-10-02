/**
 * SmartZero 2.0 — Phase 12 Code Similarity / Plagiarism Foundation Test Suite
 *
 * Verifies:
 * 1. Comment stripping and whitespace normalization
 * 2. Tokenization and identifier normalization (resilient against variable renaming)
 * 3. High similarity detection for code with renamed variables or shuffled whitespace
 * 4. Low similarity detection for genuinely distinct algorithms
 * 5. Neutral terminology enforcement (never labels student 'plagiarist')
 * 6. Contest-wide pairwise comparison report generation
 *
 * Run: npx tsx tests/code_similarity.test.ts
 */

import {
  stripComments,
  normalizeWhitespace,
  tokenizeAndNormalize,
  computeTokenSimilarity,
  compareSubmissions,
  analyzeContestCodeSimilarity,
} from "../lib/judge/similarity";
import {
  createContest,
  addCodingQuestion,
  linkQuestionToContest,
  registerContestParticipant,
} from "../lib/contest/service";
import { saveCodingSubmission } from "../lib/judge/service";

console.log("▶ Running SmartZero Phase 12 Code Similarity Tests...\n");

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
  // ── 1. Comment Stripping & Whitespace Normalization ──
  console.log("── 1. Comment Stripping & Whitespace Normalization ──");
  const pyCodeWithComments = `
# Calculate sum of elements
def solve():
    """Docstring explaining logic"""
    x = 10  # inline comment
    return x
`;

  const strippedPy = stripComments(pyCodeWithComments, "python");
  testAssert(!strippedPy.includes("Calculate sum"), "Python line comment stripped");
  testAssert(!strippedPy.includes("Docstring explaining"), "Python docstring stripped");
  testAssert(strippedPy.includes("def solve():"), "Code structure preserved");

  const jsCodeWithComments = `
// Fast I/O solution
/* Block comment explaining
   time complexity O(N) */
function main() {
    return 42; // Answer
}
`;
  const strippedJs = stripComments(jsCodeWithComments, "javascript");
  testAssert(!strippedJs.includes("Fast I/O"), "JS single-line comment stripped");
  testAssert(!strippedJs.includes("Block comment"), "JS block comment stripped");
  testAssert(strippedJs.includes("function main()"), "JS code structure preserved");

  // ── 2. Identifier Normalization ──
  console.log("\n── 2. Identifier Normalization (Renamed Variables) ──");
  const codeA = `
def find_maximum(numbers_list):
    best_value = 0
    for current_num in numbers_list:
        if current_num > best_value:
            best_value = current_num
    return best_value
`;

  const codeB = `
def get_max(arr):
    ans = 0
    for x in arr:
        if x > ans:
            ans = x
    return ans
`;

  const tokensA = tokenizeAndNormalize(codeA, "python");
  const tokensB = tokenizeAndNormalize(codeB, "python");

  // Both should have identical structure: def V_0(V_1): V_2 = 0 for V_3 in V_1: if V_3 > V_2: V_2 = V_3 return V_2
  testAssert(tokensA.length === tokensB.length, "Normalized token stream lengths match");
  testAssert(tokensA.join(" ") === tokensB.join(" "), "Normalized token streams are structurally identical");

  // ── 3. Pairwise Similarity Calculation ──
  console.log("\n── 3. Pairwise Similarity Computation ──");
  const compSame = compareSubmissions(
    { id: "sub-1", user_id: "u1", display_name: "Alice", submitted_at: new Date().toISOString(), code: codeA },
    { id: "sub-2", user_id: "u2", display_name: "Bob", submitted_at: new Date().toISOString(), code: codeB },
    "q-max",
    "python",
    "Find Maximum"
  );

  testAssert(compSame.similarity_score >= 95, "Renamed variables yield >= 95% similarity");
  testAssert(compSame.status === "Requires review", "Status is 'Requires review' (neutral phrasing)");

  // Compare with a completely distinct algorithm (Binary Search vs Max Element)
  const distinctCode = `
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
`;

  const compDiff = compareSubmissions(
    { id: "sub-1", user_id: "u1", display_name: "Alice", submitted_at: new Date().toISOString(), code: codeA },
    { id: "sub-3", user_id: "u3", display_name: "Charlie", submitted_at: new Date().toISOString(), code: distinctCode },
    "q-search",
    "python",
    "Search"
  );

  testAssert(compDiff.similarity_score < 40, "Distinct algorithms yield low similarity (< 40%)");
  testAssert(compDiff.status === "Low similarity", "Status is 'Low similarity'");

  // ── 4. Neutral Terminology Enforcement ──
  console.log("\n── 4. Neutral Terminology Enforcement ──");
  testAssert(!JSON.stringify(compSame).toLowerCase().includes("plagiarist"), "Never calls contestant 'plagiarist'");
  testAssert(!JSON.stringify(compSame).toLowerCase().includes("cheater"), "Never calls contestant 'cheater'");

  // ── 5. Contest-Wide Similarity Report ──
  console.log("\n── 5. Contest-Wide Analysis Report ──");
  const contest = await createContest({
    title: "Plagiarism Audit Contest",
    slug: "plag-audit",
    passcode: "PLAG_PASS",
    start_at: new Date(Date.now() - 3600000).toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
    status: "PUBLISHED",
  });

  const codeQ = await addCodingQuestion({
    title: "Array Max",
    description: "Max",
    test_cases: [{ input: "1 2", expected_output: "2", is_sample: true, is_hidden: false, weight: 10 }],
  });
  await linkQuestionToContest({
    contest_id: contest.id,
    question_id: codeQ.id,
    question_type: "coding",
    sort_order: 0,
    marks: 10,
  });

  await registerContestParticipant({ contest_id: contest.id, user_id: "alice-p", passcode: "PLAG_PASS" });
  await registerContestParticipant({ contest_id: contest.id, user_id: "bob-p", passcode: "PLAG_PASS" });

  await saveCodingSubmission({
    contest_id: contest.id,
    user_id: "alice-p",
    question_id: codeQ.id,
    language: "python",
    code: codeA,
    summary: { verdict: "Accepted", score: 10, test_cases_passed: 1, total_test_cases: 1, execution_time_ms: 50, memory_kb: 500, test_case_results: [] },
  });

  await saveCodingSubmission({
    contest_id: contest.id,
    user_id: "bob-p",
    question_id: codeQ.id,
    language: "python",
    code: codeB,
    summary: { verdict: "Accepted", score: 10, test_cases_passed: 1, total_test_cases: 1, execution_time_ms: 60, memory_kb: 500, test_case_results: [] },
  });

  const report = await analyzeContestCodeSimilarity(contest.id);
  testAssert(report.total_comparisons === 1, "1 pairwise comparison generated for 2 students");
  testAssert(report.comparisons[0].similarity_score >= 95, "Report flags pair with high similarity");
  testAssert(report.comparisons[0].status === "Requires review", "Pair marked as 'Requires review'");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 12 CODE SIMILARITY TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
