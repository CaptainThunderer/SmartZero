import { interpretDSAQuery } from "../agent/nlu";
import { verifyJavaScript, verifyPython } from "../agent/verifier";
import { parseProblemStatement, solveDSAProblem, formatProblemSolutionTeaching, buildProblemSolvingLesson } from "../agent/problemSolver";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n── 1. Testing Greater Average Canonical User Query ──");
  const query = "Greater Average. You are given 3 numbers A, B, and C. Determine whether the average of A and B is strictly greater than C or not. Average of A and B is (A + B)/2.";

  const parsed = parseProblemStatement(query);
  assert(parsed !== null, "Problem statement parsed successfully");
  assert(parsed?.problemType === "greater-average", "Identified problemType as 'greater-average'");
  assert(parsed?.variables?.A === 10, "Default A = 10");
  assert(parsed?.variables?.B === 20, "Default B = 20");
  assert(parsed?.variables?.C === 12, "Default C = 12");

  const task = interpretDSAQuery(query);
  assert(task.intent === "problem_solving", "Query routed to intent 'problem_solving'");
  assert(task.lessonId !== "graph-bfs", "NEVER force-matched to 'graph-bfs'");
  assert(task.lessonId !== null && task.lessonId.startsWith("custom-problem-"), "Assigned custom problem lesson ID");
  assert(task.problemPlan !== undefined, "ProblemSolutionPlan attached to task");
  assert(task.problemPlan?.category === "arithmetic", "Problem category is 'arithmetic'");
  assert(task.problemPlan?.finalAnswer === "YES", "Final answer for 10, 20, 12 is 'YES'");

  // Verify visual steps safety: NO fake array, NO fake pointers
  const visualSteps = task.customLesson?.steps || [];
  assert(visualSteps.length >= 3, `Has at least 3 visual steps (actual: ${visualSteps.length})`);
  const hasFakeArray = visualSteps.some((s) => s.actions.some((a) => a.action === "create_array"));
  const hasFakePointer = visualSteps.some((s) => s.actions.some((a) => a.action === "create_pointer"));
  assert(!hasFakeArray, "Canvas Safety: Whiteboard does NOT contain dummy array");
  assert(!hasFakePointer, "Canvas Safety: Whiteboard does NOT contain dummy pointers");

  const hasScalarVars = visualSteps.some((s) => s.actions.some((a) => a.action === "create_variable" && (a.name === "A" || a.name === "B" || a.name === "C")));
  assert(hasScalarVars, "Whiteboard initializes scalar variables A, B, and C");

  const hasComparisonCard = visualSteps.some((s) => s.actions.some((a) => a.action === "compare"));
  assert(hasComparisonCard, "Whiteboard renders comparison card for condition check");

  const hasInsightCard = visualSteps.some((s) => s.actions.some((a) => a.action === "show_insight_card"));
  assert(hasInsightCard, "Whiteboard renders final insight card with YES/NO verdict");

  // Verify 12-Section Teaching Plan
  const explanation = task.explanation || "";
  assert(explanation.includes("### 1. UNDERSTAND THE PROBLEM"), "Includes Section 1: Understand the Problem");
  assert(explanation.includes("### 2. KEY OBSERVATION & MATHEMATICAL INSIGHT"), "Includes Section 2: Key Observation");
  assert(explanation.includes("### 3. APPROACH & CANDIDATE ALGORITHMS"), "Includes Section 3: Approach & Candidates");
  assert(explanation.includes("### 4. WHY IT WORKS (CORRECTNESS & PROOF)"), "Includes Section 4: Why It Works");
  assert(explanation.includes("### 5. DRY RUN & STEP-BY-STEP TRACE"), "Includes Section 5: Dry Run");
  assert(explanation.includes("### 6. VISUAL WALKTHROUGH & WHITEBOARD MAPPING"), "Includes Section 6: Visual Walkthrough");
  assert(explanation.includes("### 7. EDGE CASES & COMMON PITFALLS"), "Includes Section 7: Edge Cases");
  assert(explanation.includes("### 8. COMPLETE RUNNABLE CODE"), "Includes Section 8: Complete Runnable Code");
  assert(explanation.includes("### 9. COMPLEXITY ANALYSIS"), "Includes Section 9: Complexity Analysis");
  assert(explanation.includes("### 10. VERIFICATION & TEST RESULTS"), "Includes Section 10: Verification & Tests");
  assert(explanation.includes("### 11. WHAT'S NEXT & PRACTICE PROBLEMS"), "Includes Section 11: What's Next");
  assert(explanation.includes("### 12. FINAL ANSWER & SUMMARY"), "Includes Section 12: Final Answer");

  // Verify Code Execution
  const jsCode = task.codeSnippets?.javascript || "";
  const jsRun = verifyJavaScript(jsCode);
  assert(jsRun.success, `JavaScript execution succeeded without runtime errors`);
  assert(jsRun.output.includes("YES"), `JavaScript output contains 'YES' (output: ${jsRun.output})`);

  const pyCode = task.codeSnippets?.python || "";
  const pyRun = verifyPython(pyCode);
  if (pyRun.executed) {
    assert(pyRun.success, `Python execution succeeded without runtime errors`);
    assert(pyRun.output.includes("YES"), `Python output contains 'YES' (output: ${pyRun.output})`);
  } else {
    console.log("  ⚠️ Python runtime not available in PATH; execution check skipped.");
  }

  console.log("\n── 2. Testing Greater Average Boundary Case (A=5, B=9, C=7 -> NO) ──");
  const boundaryQuery = "Greater Average with A = 5, B = 9, C = 7";
  const boundaryTask = interpretDSAQuery(boundaryQuery);
  assert(boundaryTask.problemPlan?.finalAnswer === "NO", "Average of 5 and 9 is 7, strictly greater than 7 is NO");
  const boundaryJsRun = verifyJavaScript(boundaryTask.codeSnippets?.javascript || "");
  assert(boundaryJsRun.success && boundaryJsRun.output.includes("NO"), "JavaScript boundary execution prints 'NO'");

  console.log("\n── 3. Testing Prime Number Check ──");
  const primeQuery = "Check whether 29 is a prime number";
  const primeTask = interpretDSAQuery(primeQuery);
  assert(primeTask.topicId === "prime-number", "Identified prime-number topic");
  assert(Boolean(primeTask.problemPlan?.finalAnswer.includes("PRIME")), "Outputs 29 is prime");
  const primeJsRun = verifyJavaScript(primeTask.codeSnippets?.javascript || "");
  assert(primeJsRun.success && primeJsRun.output.includes("PRIME"), "JavaScript prime verification prints PRIME");

  console.log("\n── 4. Testing Palindrome Check ──");
  const palQuery = "Check if 'racecar' is a palindrome";
  const palTask = interpretDSAQuery(palQuery);
  assert(palTask.topicId === "palindrome-check", "Identified palindrome-check topic");
  assert(Boolean(palTask.problemPlan?.finalAnswer.includes("PALINDROME")), "Outputs 'racecar' is palindrome");
  const palJsRun = verifyJavaScript(palTask.codeSnippets?.javascript || "");
  assert(palJsRun.success && palJsRun.output.includes("PALINDROME"), "JavaScript palindrome verification prints PALINDROME");

  console.log("\n── 5. Testing Factorial Computation ──");
  const factQuery = "Calculate 5!";
  const factTask = interpretDSAQuery(factQuery);
  assert(factTask.topicId === "factorial", "Identified factorial topic");
  assert(Boolean(factTask.problemPlan?.finalAnswer.includes("120")), "Outputs 5! = 120");
  const factJsRun = verifyJavaScript(factTask.codeSnippets?.javascript || "");
  assert(factJsRun.success && factJsRun.output.includes("120"), "JavaScript factorial verification prints 120");

  console.log("\n── 6. Testing Fibonacci Computation ──");
  const fibQuery = "Find the 7th Fibonacci number";
  const fibTask = interpretDSAQuery(fibQuery);
  assert(fibTask.topicId === "fibonacci", "Identified fibonacci topic");
  assert(Boolean(fibTask.problemPlan?.finalAnswer.includes("13")), "Outputs F(7) = 13");
  const fibJsRun = verifyJavaScript(fibTask.codeSnippets?.javascript || "");
  assert(fibJsRun.success && fibJsRun.output.includes("13"), "JavaScript fibonacci verification prints 13");

  console.log("\n── 7. Testing GCD & LCM ──");
  const gcdQuery = "Find GCD and LCM of 48 and 18";
  const gcdTask = interpretDSAQuery(gcdQuery);
  assert(gcdTask.topicId === "gcd-lcm", "Identified gcd-lcm topic");
  assert(Boolean(gcdTask.problemPlan?.finalAnswer.includes("GCD(48, 18) = 6")), "Outputs GCD = 6");
  const gcdJsRun = verifyJavaScript(gcdTask.codeSnippets?.javascript || "");
  assert(gcdJsRun.success && gcdJsRun.output.includes("GCD = 6"), "JavaScript GCD verification prints GCD = 6");

  console.log("\n── 8. Testing Generic Coding Interview Problem Fallback ──");
  const genericQuery = "Find the median of two sorted arrays";
  const genericTask = interpretDSAQuery(genericQuery);
  assert(genericTask.intent === "problem_solving", "Routes to problem_solving");
  assert(genericTask.lessonId !== "two-sum", "Does NOT route to Two Sum");
  assert(genericTask.lessonId !== "graph-bfs", "Does NOT route to Graph BFS");
  assert(genericTask.codeSnippets?.javascript !== undefined, "Provides runnable JavaScript code");
  assert(genericTask.codeSnippets?.python !== undefined, "Provides runnable Python code");

  console.log("\n── 9. Positive Regressions for Core Visual Lessons ──");
  const smTask = interpretDSAQuery("Find the second maximum element");
  assert(smTask.lessonId === "second-max", "Second maximum routes to 'second-max'");

  const bsTask = interpretDSAQuery("Search 60 in sorted array [10, 20, 30, 40, 50, 60, 70]");
  assert(bsTask.lessonId !== "graph-bfs", "Binary search does NOT route to Graph BFS");

  const bfsTask = interpretDSAQuery("Explain breadth first search traversal of graph");
  assert(bfsTask.lessonId === "graph-bfs", "Explicit BFS query routes to 'graph-bfs'");

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Universal Solver Suite: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
