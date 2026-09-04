/**
 * SmartZero — Cross-Contamination & Semantic Synchronization Test Suite
 *
 * Verifies that sequential problem loads in the same workspace or sequential
 * queries completely clean and overwrite previous state, with zero cross-contamination
 * across title, canvas, code, state variables, and pedagogical explanation.
 *
 * Run: npx tsx tests/cross_contamination.test.ts
 */

import { interpretDSAQuery } from "../agent/nlu";
import { buildProblemSolvingLesson } from "../agent/problemSolver";
import { lessonFromId } from "../engine/lessons";
import { verifyJavaScript } from "../agent/verifier";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

async function runTests() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  CROSS-CONTAMINATION & SYNCHRONIZATION SUITE        ");
  console.log("══════════════════════════════════════════════════════\n");

  // TEST 1: The Exact User Regression Query
  console.log("── Test 1: Decrement OR Increment Exact User Query ──");
  {
    const userQuery =
      "Decrement OR Increment Write a program to obtain a number N and increment its value by 1 if the number is divisible by 4 otherwise decrement its value by 1.";
    
    // Simulate stale context where previous topic was Two Pointers
    const task = interpretDSAQuery(userQuery, {
      topicId: "two-pointers",
      lessonId: "two-pointers",
      language: "python",
    });

    assert(task.topicId === "decrement-or-increment", "TopicId is decrement-or-increment (not stale two-pointers)");
    assert(task.intent === "problem_solving", "Intent is problem_solving");
    assert(Boolean(task.problemPlan), "Problem plan is present");
    assert(task.problemPlan?.normalizedProblem === "Decrement or Increment", "Normalized problem title is 'Decrement or Increment'");
    assert(task.problemPlan?.complexity.time === "O(1)", "Time complexity is O(1)");
    assert(task.problemPlan?.complexity.space === "O(1)", "Space complexity is O(1)");

    // Check that [10, 20, 30] and arg_1, arg_2, arg_3 are NOT present
    const planStr = JSON.stringify(task.problemPlan);
    assert(!planStr.includes("[10, 20, 30]"), "Plan does not contain default arithmetic array [10, 20, 30]");
    assert(!planStr.includes("arg_1"), "Plan does not contain generic arg_1 variable");
    assert(!planStr.includes("ARITHMETIC EVALUATION"), "Canvas header does not say ARITHMETIC EVALUATION");

    // Check visual steps and variables
    const vs = task.problemPlan?.visualSteps || [];
    assert(vs.length >= 3, `Visual steps count is ${vs.length} (>= 3)`);
    const s0 = vs[0];
    const s1 = vs[1];
    const s2 = vs[2];
    assert(s0.actions.some((a) => a.action === "create_variable" && a.name === "N" && a.value === 8), "Step 0 creates variable N = 8");
    assert(s0.actions.some((a) => a.action === "create_variable" && a.name === "divisor" && a.value === 4), "Step 0 creates divisor = 4");
    assert(s1.actions.some((a) => a.action === "create_variable" && a.name === "remainder" && a.value === 0), "Step 1 creates remainder = 0");
    assert(s2.actions.some((a) => a.action === "create_variable" && a.name === "result" && a.value === 9), "Step 2 creates result = 9");

    // Verify runnable code
    const jsCode = task.problemPlan?.implementations.javascript || "";
    const pyCode = task.problemPlan?.implementations.python || "";
    const cppCode = task.problemPlan?.implementations.cpp || "";
    assert(jsCode.includes("n % divisor === 0") || jsCode.includes("n % 4 === 0"), "JS code has divisibility modulo check");
    assert(pyCode.includes("n % divisor == 0") || pyCode.includes("n % 4 == 0"), "Python code has divisibility modulo check");
    assert(cppCode.includes("n % divisor == 0") || cppCode.includes("n % 4 == 0"), "C++ code has divisibility modulo check");
    assert(!pyCode.includes("sum(arr) / len(arr)"), "Python code does NOT calculate mean of array");

    // Verify JS code execution
    const execRes = verifyJavaScript(jsCode);
    assert(execRes.success && execRes.output.includes("9"), `JS execution output includes 9 (got: ${execRes.output.trim()})`);

    // Verify custom lesson creation
    const lesson = buildProblemSolvingLesson(task.problemPlan!);
    assert(lesson.title === "Decrement or Increment", `Lesson title is 'Decrement or Increment' (got '${lesson.title}')`);
    assert(lesson.steps.length >= 3, "Lesson has >= 3 steps");
  }

  // TEST 2: Decrement or Increment with custom input (e.g. N = 5 -> Result = 4)
  console.log("\n── Test 2: Decrement OR Increment with N = 5 (Decrement Branch) ──");
  {
    const q = "Decrement or increment: given N = 5, increment if divisible by 4 else decrement.";
    const task = interpretDSAQuery(q);
    assert(task.topicId === "decrement-or-increment", "Routes to decrement-or-increment");
    assert(task.problemPlan?.finalAnswer === "4", `Final answer for N=5 is 4 (got '${task.problemPlan?.finalAnswer}')`);
    const vs = task.problemPlan?.visualSteps || [];
    assert(vs[0].actions.some((a) => a.action === "create_variable" && a.name === "N" && a.value === 5), "Step 0 has N = 5");
    assert(vs[1].actions.some((a) => a.action === "create_variable" && a.name === "remainder" && a.value === 1), "Step 1 remainder is 1");
    assert(vs[2].actions.some((a) => a.action === "create_variable" && a.name === "result" && a.value === 4), "Step 2 result is 4");
    const execRes = verifyJavaScript(task.problemPlan?.implementations.javascript || "");
    assert(execRes.success && execRes.output.includes("4"), `JS execution for N=5 returns 4`);
  }

  // TEST 3: Sequential Topic Transitions with Stale Context Immunization
  console.log("\n── Test 3: Sequential Topic Transitions (Zero Residual State) ──");
  {
    // Step A: Binary Search
    const tA = interpretDSAQuery("Explain Binary Search.");
    assert(tA.topicId === "binary-search", "Step A: Binary Search resolved");
    const lA = lessonFromId("binary-search")!;
    assert(lA.title === "Binary Search", "Step A: Lesson title is 'Binary Search'");

    // Step B: In workspace where Binary Search was running, user asks Decrement or Increment
    const tB = interpretDSAQuery(
      "Write a program to obtain a number N and increment its value by 1 if the number is divisible by 4 otherwise decrement its value by 1.",
      { topicId: "binary-search", lessonId: "binary-search" }
    );
    assert(tB.topicId === "decrement-or-increment", "Step B: Successfully transitions from binary-search to decrement-or-increment");
    assert(tB.problemPlan?.normalizedProblem === "Decrement or Increment", "Step B: Problem title is 'Decrement or Increment'");

    // Step C: In same workspace, user asks Kadane's algorithm
    const tC = interpretDSAQuery(
      "Find maximum subarray sum using Kadane's algorithm.",
      { topicId: "decrement-or-increment", lessonId: tB.lessonId }
    );
    assert(tC.topicId === "max-subarray", "Step C: Transitions from decrement-or-increment to max-subarray");
    assert(!JSON.stringify(tC.problemPlan).includes("divisor"), "Step C: Zero residual 'divisor' variable from decrement-or-increment");

    // Step D: In same workspace, user asks Prime check
    const tD = interpretDSAQuery(
      "Check whether 29 is prime.",
      { topicId: "max-subarray", lessonId: tC.lessonId }
    );
    assert(tD.topicId === "prime-number", "Step D: Transitions to prime-number");
    assert(!JSON.stringify(tD.problemPlan).includes("max_so_far"), "Step D: Zero residual 'max_so_far' variable from Kadane");

    // Step E: In same workspace, user asks Sliding window
    const tE = interpretDSAQuery(
      "Explain sliding window.",
      { topicId: "prime-number", lessonId: tD.lessonId }
    );
    assert(tE.topicId === "sliding-window", "Step E: Transitions to sliding-window");
  }

  // TEST 4: Greater Average Isolation
  console.log("\n── Test 4: Greater Average Stale Context Isolation ──");
  {
    const tGA = interpretDSAQuery("You are given A B C, print YES if avg(A,B) > C.", {
      topicId: "graph-bfs",
      lessonId: "graph-bfs",
    });
    assert(tGA.topicId === "greater-average", "Greater Average overrides graph-bfs stale context");
    assert(tGA.lessonId !== "graph-bfs", "Never maps Greater Average to graph-bfs");
    assert(tGA.problemPlan?.finalAnswer === "YES", "Final answer is YES for default 10, 20, 12");
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════════");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner threw uncaught error:", err);
  process.exit(1);
});
