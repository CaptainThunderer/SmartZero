/**
 * SmartZero V1 — Problem Solving & Multi-Language Coverage Test Suite
 *
 * Covers:
 * 1. All 30 Problem Types from Section 28
 * 2. Story Problem Normalization (Chef, classroom, tokens, etc.)
 * 3. Multi-Approach Comparison (Brute Force vs Better vs Optimal)
 * 4. Complete, Runnable Multi-Language Code (JavaScript, C++, Python)
 * 5. Dynamic Whiteboard Canvas Lessons with Structured Narratives
 *
 * Run: npx tsx tests/problem_solving_coverage.test.ts
 */

import { interpretDSAQuery } from "../agent/nlu";
import { parseProblemStatement, solveDSAProblem, buildProblemSolvingLesson } from "../agent/problemSolver";
import { ProblemSolutionPlanSchema } from "../ai/schemas";

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

console.log("\n==================================================");
console.log("  SMARTZERO V1 — PROBLEM SOLVING & MULTI-LANGUAGE SUITE");
console.log("==================================================");

const PROBLEM_TEST_CASES = [
  {
    name: "1. Missing Number (Story Problem)",
    query: "Chef has 4 pieces of paper with numbers 1, 2, 4, 5. The numbers have a known total. One number is missing. Find the missing number.",
    expectedType: "missing-number",
    hasStory: true,
    expectedAnswerSubstring: "3",
  },
  {
    name: "2. Two Sum",
    query: "Given an array of integers nums = [2, 7, 11, 15] and target = 9, find the two numbers that add up to target.",
    expectedType: "two-sum",
    hasStory: false,
    expectedAnswerSubstring: "0, 1",
  },
  {
    name: "3. Maximum Subarray Sum (Kadane)",
    query: "Find the contiguous subarray with the maximum sum in [-2, 1, -3, 4, -1, 2, 1, -5, 4].",
    expectedType: "max-subarray",
    hasStory: false,
    expectedAnswerSubstring: "6",
  },
  {
    name: "4. Best Time to Buy and Sell Stock",
    query: "Given stock prices [7, 1, 5, 3, 6, 4], find the maximum profit you can achieve from a single buy and sell.",
    expectedType: "stock-buy-sell",
    hasStory: false,
    expectedAnswerSubstring: "5",
  },
  {
    name: "5. Move Zeroes to End",
    query: "Move all 0s to the end of the array [0, 1, 0, 3, 12] while maintaining relative order.",
    expectedType: "move-zeroes",
    hasStory: false,
    expectedAnswerSubstring: "1, 3, 12, 0, 0",
  },
  {
    name: "6. Remove Duplicates from Sorted Array",
    query: "Remove duplicates in-place from sorted array [1, 1, 2, 2, 3, 4, 4, 5].",
    expectedType: "remove-duplicates",
    hasStory: false,
    expectedAnswerSubstring: "5",
  },
  {
    name: "7. Longest Substring Without Repeating Characters",
    query: "Find the length of the longest substring without repeating characters in abcabcbb.",
    expectedType: "longest-substring-no-repeat",
    hasStory: false,
    expectedAnswerSubstring: "3",
  },
  {
    name: "8. Max Sum Subarray of Size K",
    query: "Find the maximum sum of any 3 consecutive days in [2, 1, 5, 1, 3, 2].",
    expectedType: "max-subarray-k",
    hasStory: false,
    expectedAnswerSubstring: "9",
  },
  {
    name: "9. Binary Search",
    query: "Search in sorted array [10, 20, 30, 37, 50, 60, 80] for target 37.",
    expectedType: "binary-search",
    hasStory: false,
    expectedAnswerSubstring: "3",
  },
  {
    name: "10. Search in Rotated Sorted Array",
    query: "Search for target 0 in rotated sorted array [4, 5, 6, 7, 0, 1, 2].",
    expectedType: "search-rotated-array",
    hasStory: false,
    expectedAnswerSubstring: "4",
  },
  {
    name: "11. Reverse a Linked List",
    query: "Reverse this linked list: 1 -> 2 -> 3 -> 4 -> null.",
    expectedType: "reverse-linked-list",
    hasStory: false,
    expectedAnswerSubstring: "Reversed list",
  },
  {
    name: "12. Detect Linked List Cycle",
    query: "Detect a cycle in a linked list using Floyd's Tortoise and Hare algorithm.",
    expectedType: "detect-linked-list-cycle",
    hasStory: false,
    expectedAnswerSubstring: "Cycle detected",
  },
  {
    name: "13. Valid Parentheses",
    query: "Determine if the string containing brackets {[()]} is valid and balanced.",
    expectedType: "valid-parentheses",
    hasStory: false,
    expectedAnswerSubstring: "true",
  },
  {
    name: "14. Queue Using Stacks",
    query: "Implement a FIFO queue using two LIFO stacks.",
    expectedType: "queue-using-stacks",
    hasStory: false,
    expectedAnswerSubstring: "Queue",
  },
  {
    name: "15. First Repeating Element",
    query: "Find the first repeating element in array [2, 1, 3, 5, 3, 2].",
    expectedType: "first-repeating-element",
    hasStory: false,
    expectedAnswerSubstring: "3",
  },
  {
    name: "16. Top K Frequent Elements",
    query: "Find the top k frequent elements in [1, 1, 1, 2, 2, 3] with k = 2.",
    expectedType: "top-k-frequent",
    hasStory: false,
    expectedAnswerSubstring: "Top K",
  },
  {
    name: "17. Tree Traversals",
    query: "Perform tree traversal inorder preorder postorder on binary tree.",
    expectedType: "tree-traversal",
    hasStory: false,
    expectedAnswerSubstring: "structural",
  },
  {
    name: "18. BST Search",
    query: "Search for key in binary search tree invariant.",
    expectedType: "bst-search",
    hasStory: false,
    expectedAnswerSubstring: "Target node",
  },
  {
    name: "19. Number of Islands",
    query: "Given a 2D grid of 1s (land) and 0s (water), count the number of islands.",
    expectedType: "number-of-islands",
    hasStory: false,
    expectedAnswerSubstring: "Island count",
  },
  {
    name: "20. Shortest Path in Unweighted Graph",
    query: "Find the shortest number of edges to reach target vertex in unweighted graph.",
    expectedType: "bfs-shortest-path",
    hasStory: false,
    expectedAnswerSubstring: "Minimum number of edges",
  },
  {
    name: "21. Connected Components",
    query: "Count the number of connected components in an undirected graph.",
    expectedType: "dfs-connected-components",
    hasStory: false,
    expectedAnswerSubstring: "Component count",
  },
  {
    name: "22. Dijkstra's Algorithm",
    query: "Find shortest path with non-negative weights using Dijkstra's algorithm.",
    expectedType: "dijkstra",
    hasStory: false,
    expectedAnswerSubstring: "Shortest distance",
  },
  {
    name: "23. Climbing Stairs",
    query: "How many distinct ways to reach stair 5 if you can take 1 or 2 steps at a time?",
    expectedType: "climbing-stairs",
    hasStory: false,
    expectedAnswerSubstring: "ways",
  },
  {
    name: "24. Coin Change",
    query: "Find the minimum number of coins needed to make amount 11 using [1, 2, 5].",
    expectedType: "coin-change",
    hasStory: false,
    expectedAnswerSubstring: "coins",
  },
  {
    name: "25. Longest Common Subsequence",
    query: "Find the length of the longest common subsequence of text1 and text2 using LCS.",
    expectedType: "lcs",
    hasStory: false,
    expectedAnswerSubstring: "LCS length",
  },
  {
    name: "26. Generate All Subsets",
    query: "Generate all subsets power set of [1, 2, 3].",
    expectedType: "generate-subsets",
    hasStory: false,
    expectedAnswerSubstring: "subsets",
  },
  {
    name: "27. N-Queens",
    query: "Solve the N-Queens puzzle on an 4x4 chessboard.",
    expectedType: "n-queens",
    hasStory: false,
    expectedAnswerSubstring: "Valid configurations",
  },
  {
    name: "28. Next Greater Element",
    query: "Find the next greater element for each element in [4, 5, 2, 25] using monotonic stack.",
    expectedType: "next-greater-element",
    hasStory: false,
    expectedAnswerSubstring: "Next greater",
  },
  {
    name: "29. Range Sum Query (Prefix Sum)",
    query: "Compute range sum queries in O(1) time using prefix sum on [1, 2, 3, 4, 5].",
    expectedType: "prefix-sum",
    hasStory: false,
    expectedAnswerSubstring: "Prefix sum array",
  },
  {
    name: "30. Union-Find / Disjoint Set Union",
    query: "Solve dynamic connectivity between components using union-find dsu connectivity.",
    expectedType: "union-find",
    hasStory: false,
    expectedAnswerSubstring: "Connected component sets",
  },
];

console.log("\n── Testing All 30 Problem Types ──");

for (const tc of PROBLEM_TEST_CASES) {
  const parsed = parseProblemStatement(tc.query);
  assert(parsed !== null, `${tc.name}: parsed successfully`);
  if (!parsed) continue;

  assert(parsed.problemType === tc.expectedType, `${tc.name}: matched problemType '${tc.expectedType}'`);
  if (tc.hasStory) {
    assert(!!parsed.storyContext, `${tc.name}: storyContext identified ('${parsed.storyContext}')`);
  }

  // Solve problem and produce plan
  const plan = solveDSAProblem(tc.query, parsed);
  assert(!!plan, `${tc.name}: plan generated`);
  if (!plan) continue;

  // Validate Zod Schema
  const schemaValidation = ProblemSolutionPlanSchema.safeParse(plan);
  assert(schemaValidation.success, `${tc.name}: plan conforms strictly to Zod ProblemSolutionPlanSchema`);
  if (!schemaValidation.success) {
    console.error("Zod Schema Errors:", schemaValidation.error.format());
  }

  // Candidate approaches verification
  assert(plan.candidateApproaches.length >= 1, `${tc.name}: has candidate approaches (count: ${plan.candidateApproaches.length})`);
  assert(!!plan.selectedApproach.name, `${tc.name}: selected approach is named ('${plan.selectedApproach.name}')`);
  assert(!!plan.selectedApproach.timeComplexity, `${tc.name}: selected approach has time complexity ('${plan.selectedApproach.timeComplexity}')`);
  assert(!!plan.selectedApproach.spaceComplexity, `${tc.name}: selected approach has space complexity ('${plan.selectedApproach.spaceComplexity}')`);

  // Runnable code verification for all THREE languages
  assert(plan.implementations.javascript.length > 50, `${tc.name}: has complete JavaScript code`);
  assert(plan.implementations.cpp.length > 50, `${tc.name}: has complete C++ code with headers`);
  assert(plan.implementations.python.length > 50, `${tc.name}: has complete Python code`);

  // Python validation
  assert(plan.implementations.python.includes("def "), `${tc.name}: Python code contains function definitions`);
  assert(plan.implementations.python.includes('if __name__ == "__main__":'), `${tc.name}: Python code contains main entry point`);

  // C++ validation
  assert(plan.implementations.cpp.includes("#include <iostream>"), `${tc.name}: C++ code includes iostream`);
  assert(plan.implementations.cpp.includes("int main("), `${tc.name}: C++ code contains int main()`);

  // JavaScript validation
  assert(plan.implementations.javascript.includes("function ") || plan.implementations.javascript.includes("class "), `${tc.name}: JavaScript code contains functions/classes`);
  assert(plan.implementations.javascript.includes("console.log("), `${tc.name}: JavaScript code contains runnable demo`);

  // Canvas visual lesson generation
  const lesson = buildProblemSolvingLesson(plan);
  assert(lesson.steps.length >= 3, `${tc.name}: visual lesson has at least 3 pedagogical steps (${lesson.steps.length} steps)`);
  assert(lesson.steps[0].actions[0].action === "reset_scene", `${tc.name}: visual lesson starts with reset_scene`);
  
  // Board header and structured narrative check
  const headerAction = lesson.steps[0].actions.find((a) => a.action === "set_board_header");
  assert(!!headerAction, `${tc.name}: step 0 initializes set_board_header`);

  // Question / learner pause check
  const pauseStep = lesson.steps.find((s) => s.pause === true && s.question !== undefined);
  assert(!!pauseStep, `${tc.name}: contains interactive learner question step`);

  // Multi-language code sync in lesson
  assert(lesson.code.javascript.length > 0, `${tc.name}: lesson has JavaScript code synced`);
  assert(lesson.code.cpp.length > 0, `${tc.name}: lesson has C++ code synced`);
  assert(!!lesson.code.python && lesson.code.python.length > 0, `${tc.name}: lesson has Python code synced`);
}

console.log("\n── Testing Story Normalization & Natural Language Routing ──");

// Story variation: Chef with missing paper
{
  const task = interpretDSAQuery("Chef has 4 pieces of paper with numbers 1, 2, 4, 5. The total sum is known. Find the missing number in Python.");
  assert(task.intent === "problem_solving", "Chef story query routes to problem_solving intent");
  assert(task.topicId === "missing-number", "Identifies underlying topic 'missing-number'");
  assert(task.customLesson !== undefined, "Dynamic visual lesson generated for story problem");
  assert(task.codeSnippets?.python !== undefined, "Python code snippet attached");
  assert(task.codeSnippets?.python?.includes("missing_number") === true, "Python code has missing_number function");
  assert(task.explanation?.includes("Chef's numbered papers") === true, "Explanation acknowledges story context");
  assert(task.explanation?.includes("APPROACH") === true, "Explanation outlines approach");
}

// Language request: "Give me the C++ implementation of Kadane's algorithm"
{
  const task = interpretDSAQuery("Give me the C++ code for maximum subarray Kadane's algorithm");
  assert(task.intent === "problem_solving" || task.intent === "implementation", "Kadane code request routed correctly");
  assert(task.codeSnippets?.cpp !== undefined, "C++ code provided");
  assert(task.codeSnippets?.cpp?.includes("int maxSubArray") === true, "C++ maxSubArray function present");
}

// Language request: "Implement Two Sum in Python"
{
  const task = interpretDSAQuery("Two numbers that sum to 9 in [2, 7, 11, 15] in Python");
  assert(task.intent === "problem_solving", "Two sum in Python routes to problem_solving");
  assert(task.codeSnippets?.python !== undefined, "Python code provided");
  assert(task.codeSnippets?.python?.includes("def two_sum") === true, "Python def two_sum function present");
  assert(task.codeSnippets?.python?.includes('if __name__ == "__main__":') === true, "Python main test driver present");
}

console.log("\n══════════════════════════════════════════════════");
console.log(`  Problem Solving Suite: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
