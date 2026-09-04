/**
 * SmartZero — User-Requested 7 Exact Queries NLU Test
 *
 * Run: npx tsx tests/exact_7_queries.test.ts
 */

import { interpretDSAQuery } from "../agent/nlu";

const tests = [
  "You are given A B C, print YES if avg(A,B) > C.",
  "Check whether N is prime.",
  "Check whether a number is Armstrong.",
  "Find two numbers that add to a target.",
  "Find maximum subarray sum using Kadane's algorithm.",
  "Reverse a linked list.",
  "Explain Dijkstra's shortest path algorithm.",
];

let failed = 0;

for (const q of tests) {
  const r = interpretDSAQuery(q);
  console.log("--------------------------------------------------");
  console.log("Q:", q);
  console.log("   topicId:", r.topicId);
  console.log("   lessonId:", r.lessonId);
  console.log("   intent:", r.intent);
  console.log("   problemPlan complexity.time:", r.problemPlan?.complexity?.time);
  console.log("   problemPlan algorithm/approach:", r.problemPlan?.selectedApproach?.name || r.algorithm);

  // Critical regressions
  if (q.includes("avg(A,B)")) {
    if (r.topicId !== "greater-average") {
      console.error("❌ FAILED: Expected topicId 'greater-average', got:", r.topicId);
      failed++;
    }
    if (r.lessonId === "graph-bfs" || r.lessonId === "two-sum" || r.lessonId === "binary-search") {
      console.error("❌ FAILED: Greater Average mapped to unrelated lesson:", r.lessonId);
      failed++;
    }
  }

  if (q.includes("prime")) {
    if (r.topicId !== "prime-number") {
      console.error("❌ FAILED: Expected topicId 'prime-number', got:", r.topicId);
      failed++;
    }
    if (r.lessonId === "graph-bfs" || r.lessonId === "binary-search") {
      console.error("❌ FAILED: Prime mapped to unrelated lesson:", r.lessonId);
      failed++;
    }
  }

  if (q.includes("Armstrong")) {
    if (r.topicId !== "armstrong-number") {
      console.error("❌ FAILED: Expected topicId 'armstrong-number', got:", r.topicId);
      failed++;
    }
    if (r.lessonId === "graph-bfs") {
      console.error("❌ FAILED: Armstrong mapped to graph-bfs:", r.lessonId);
      failed++;
    }
  }

  if (q.includes("two numbers that add to a target")) {
    if (r.topicId !== "two-sum" && r.lessonId !== "two-sum") {
      console.error("❌ FAILED: Expected Two Sum, got:", r.topicId, r.lessonId);
      failed++;
    }
  }

  if (q.includes("Kadane")) {
    if (r.topicId !== "max-subarray" && r.topicId !== "kadane" && r.lessonId !== "kadane") {
      console.error("❌ FAILED: Expected Kadane / max-subarray, got:", r.topicId, r.lessonId);
      failed++;
    }
  }

  if (q.includes("Reverse a linked list")) {
    if (r.topicId !== "reverse-linked-list" && r.topicId !== "linked-list-reverse" && r.lessonId !== "linked-list-reverse") {
      console.error("❌ FAILED: Expected Reverse Linked List, got:", r.topicId, r.lessonId);
      failed++;
    }
  }

  if (q.includes("Dijkstra")) {
    if (r.topicId !== "dijkstra" && r.lessonId !== "dijkstra") {
      console.error("❌ FAILED: Expected Dijkstra, got:", r.topicId, r.lessonId);
      failed++;
    }
  }
}

console.log("--------------------------------------------------");
if (failed === 0) {
  console.log("✅ ALL 7 EXACT QUERIES PASSED PERFECTLY!");
  process.exit(0);
} else {
  console.log(`❌ ${failed} QUERIES FAILED`);
  process.exit(1);
}
