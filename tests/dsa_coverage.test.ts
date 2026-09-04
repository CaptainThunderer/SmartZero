/**
 * SmartZero V1 — General DSA Intelligence & Coverage Test Suite
 *
 * Run: npx tsx tests/dsa_coverage.test.ts
 */

import { lessonFromId } from "../engine/lessons";
import { interpretDSAQuery, extractNumbers, extractTargetValue } from "../agent/nlu";
import { DSA_TOPIC_REGISTRY, findTopicByQuery, detectComparison } from "../engine/registry";
import { applyAction, initialCanvas, replay } from "../engine/core";
import type { CanvasState } from "../types/dsa";

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
console.log("  SMARTZERO V1 — GENERAL DSA COVERAGE AUDIT");
console.log("==================================================");

/* ══════════════════════════════════════════
   1. All 9 Sorting Algorithms Deterministic Execution
   ══════════════════════════════════════════ */
console.log("\n── 1. Deterministic Sorting Coverage (All 9 Algorithms) ──");

const sortingAlgorithms = [
  { id: "bubble-sort", name: "Bubble Sort", expectedTime: "O(n²)" },
  { id: "selection-sort", name: "Selection Sort", expectedTime: "O(n²)" },
  { id: "insertion-sort", name: "Insertion Sort", expectedTime: "O(n²)" },
  { id: "merge-sort", name: "Merge Sort", expectedTime: "O(n log n)" },
  { id: "quick-sort", name: "Quick Sort", expectedTime: "O(n log n)" },
  { id: "heap-sort", name: "Heap Sort", expectedTime: "O(n log n)" },
  { id: "counting-sort", name: "Counting Sort", expectedTime: "O(n + k)" },
  { id: "radix-sort", name: "Radix Sort", expectedTime: "O(d · (n + k))" },
  { id: "bucket-sort", name: "Bucket Sort", expectedTime: "O(n)" },
];

for (const algo of sortingAlgorithms) {
  const lesson = lessonFromId(algo.id);
  assert(lesson !== null, `${algo.name}: lesson builds successfully`);
  if (!lesson) continue;

  assert(lesson.steps.length > 3, `${algo.name}: has non-trivial steps (${lesson.steps.length} steps)`);
  assert(lesson.steps[0].actions[0].action === "reset_scene", `${algo.name}: starts with reset_scene`);
  
  const finalState = replay(lesson.steps, lesson.steps.length - 1);
  assert(finalState.array !== null, `${algo.name}: canvas has array`);
  assert(finalState.complexity?.time === algo.expectedTime, `${algo.name}: time complexity is ${algo.expectedTime}`);
  assert(lesson.code.javascript.length > 0, `${algo.name}: has JavaScript code sync`);
  assert(lesson.code.cpp.length > 0, `${algo.name}: has C++ code sync`);
}

/* ══════════════════════════════════════════
   2. Custom Array Input Sorting
   ══════════════════════════════════════════ */
console.log("\n── 2. Custom Array Input Sorting ──");
{
  const customArray = [8, 3, 5, 1, 9];
  const lesson = lessonFromId("quick-sort", customArray);
  assert(lesson !== null, "Quick sort accepts custom array");
  if (lesson) {
    const s1 = replay(lesson.steps, 1);
    assert(s1.array !== null, "Quick sort creates array");
    assert(
      JSON.stringify(s1.array?.values) === JSON.stringify(customArray),
      `Quick sort initializes exactly with custom array [${customArray.join(", ")}]`
    );
  }

  const customBubble = lessonFromId("bubble-sort", [99, 44, 6, 2, 1]);
  assert(customBubble !== null, "Bubble sort accepts custom array");
  if (customBubble) {
    const s1 = replay(customBubble.steps, 1);
    assert(s1.array?.values[0] === 99, "Bubble sort uses custom first value 99");
  }
}

/* ══════════════════════════════════════════
   3. Graph Traversal Engines (BFS & DFS)
   ══════════════════════════════════════════ */
console.log("\n── 3. Deterministic Graph Traversal Coverage ──");
{
  const bfsLesson = lessonFromId("graph-bfs");
  assert(bfsLesson !== null, "graph-bfs resolves");
  if (bfsLesson) {
    assert(bfsLesson.steps[0].actions[0].action === "reset_scene", "BFS starts with reset_scene");
    const s1 = replay(bfsLesson.steps, 1);
    assert(s1.graph !== null, "BFS initializes graph");
    assert(s1.graph?.nodes.length === 6, "BFS graph has 6 nodes (A, B, C, D, E, F)");
    assert(s1.graph?.edges.length === 5, "BFS graph has 5 edges");
    const last = replay(bfsLesson.steps, bfsLesson.steps.length - 1);
    assert(last.complexity?.time === "O(V + E)", "BFS time complexity is O(V + E)");
  }

  const dfsLesson = lessonFromId("graph-dfs");
  assert(dfsLesson !== null, "graph-dfs resolves");
  if (dfsLesson) {
    assert(dfsLesson.steps[0].actions[0].action === "reset_scene", "DFS starts with reset_scene");
    const s1 = replay(dfsLesson.steps, 1);
    assert(s1.graph !== null, "DFS initializes graph");
    const last = replay(dfsLesson.steps, dfsLesson.steps.length - 1);
    assert(last.complexity?.time === "O(V + E)", "DFS time complexity is O(V + E)");
  }
}

/* ══════════════════════════════════════════
   4. Linear Structures (Stack, Queue, Hash Table)
   ══════════════════════════════════════════ */
console.log("\n── 4. Linear Structures Coverage ──");
{
  const stackLesson = lessonFromId("stack-ops");
  assert(stackLesson !== null, "stack-ops resolves");
  if (stackLesson) {
    assert(stackLesson.steps[0].actions[0].action === "reset_scene", "Stack starts with reset_scene");
    const mid = replay(stackLesson.steps, Math.floor(stackLesson.steps.length / 2));
    assert(mid.stack !== null, "Stack is rendered on canvas");
    const last = replay(stackLesson.steps, stackLesson.steps.length - 1);
    assert(last.complexity?.time === "O(1)", "Stack operations time complexity is O(1)");
  }

  const queueLesson = lessonFromId("queue-ops");
  assert(queueLesson !== null, "queue-ops resolves");
  if (queueLesson) {
    assert(queueLesson.steps[0].actions[0].action === "reset_scene", "Queue starts with reset_scene");
    const mid = replay(queueLesson.steps, Math.floor(queueLesson.steps.length / 2));
    assert(mid.queue !== null, "Queue is rendered on canvas");
    const last = replay(queueLesson.steps, queueLesson.steps.length - 1);
    assert(last.complexity?.time === "O(1)", "Queue operations time complexity is O(1)");
  }

  const hashLesson = lessonFromId("hash-table-ops");
  assert(hashLesson !== null, "hash-table-ops resolves");
  if (hashLesson) {
    assert(hashLesson.steps[0].actions[0].action === "reset_scene", "Hash table starts with reset_scene");
    const mid = replay(hashLesson.steps, Math.floor(hashLesson.steps.length / 2));
    assert(mid.hashTable !== null, "Hash table is rendered on canvas");
    assert(mid.hashTable?.buckets.length === 5, "Hash table has 5 buckets");
    const last = replay(hashLesson.steps, hashLesson.steps.length - 1);
    assert(last.complexity?.time === "O(1)", "Hash table lookup average is O(1)");
  }
}

/* ══════════════════════════════════════════
   5. NLU Intent Classification Tests
   ══════════════════════════════════════════ */
console.log("\n── 5. NLU Query Interpretation ──");
{
  // 5a. Visual Interactive Execution with Custom Array
  const tSort = interpretDSAQuery("Sort [8, 3, 5, 1, 9] using quick sort");
  assert(tSort.intent === "visualize", "Identifies visualize intent for custom array quick sort");
  assert(tSort.lessonId === "quick-sort", "Maps to quick-sort lessonId");
  assert(JSON.stringify(tSort.inputData) === JSON.stringify([8, 3, 5, 1, 9]), "Extracts custom array correctly");

  // 5b. Conceptual Queries
  const tArr = interpretDSAQuery("Explain arrays");
  assert(tArr.intent === "explain", "Identifies explain intent for 'Explain arrays'");
  assert(tArr.topicId === "array-traversal", "Maps to array-traversal");
  assert(tArr.explanation !== undefined, "Provides conceptual explanation");

  const tDp = interpretDSAQuery("Explain dynamic programming");
  assert(tDp.intent === "explain", "Identifies explain intent for dynamic programming");
  assert(tDp.topicId === "dynamic-programming", "Maps to dynamic-programming");
  assert(tDp.lessonId === null, "DP is explanation-only (no fake deterministic engine)");

  const tHash = interpretDSAQuery("What is hashing?");
  assert(tHash.intent === "explain" || tHash.intent === "visualize", "Understands hashing query");
  assert(tHash.topicId === "hash-table-ops", "Maps to hash-table-ops");

  // 5c. Complexity Queries
  const tComp1 = interpretDSAQuery("Why is quicksort sometimes O(n²)?");
  assert(tComp1.intent === "complexity", "Identifies complexity intent for 'Why is quicksort sometimes O(n²)?'");
  assert(tComp1.complexity?.worst === "O(n²)", "Returns correct worst case complexity");

  const tComp2 = interpretDSAQuery("Merge sort time complexity");
  assert(tComp2.intent === "complexity", "Identifies complexity intent for 'Merge sort time complexity'");
  assert(tComp2.complexity?.time === "O(n log n)", "Returns O(n log n) average time complexity");

  // 5d. Comparison Queries
  const tVs1 = interpretDSAQuery("Merge sort vs quicksort");
  assert(tVs1.intent === "compare", "Identifies comparison for 'Merge sort vs quicksort'");
  assert(tVs1.comparisonTopics?.length === 2, "Identifies 2 comparison topics");

  const tVs2 = interpretDSAQuery("BFS vs DFS");
  assert(tVs2.intent === "compare", "Identifies comparison for 'BFS vs DFS'");

  const tVs3 = interpretDSAQuery("Stack vs queue");
  assert(tVs3.intent === "compare", "Identifies comparison for 'Stack vs queue'");

  // 5e. Ambiguous Queries
  const tAmb = interpretDSAQuery("Show me sorting");
  assert(tAmb.intent === "clarification", "Identifies clarification intent for ambiguous 'Show me sorting'");
  assert((tAmb.clarificationOptions?.length ?? 0) >= 4, "Provides clickable clarification options");

  // 5f. Non-DSA Queries
  const tNon = interpretDSAQuery("What is the weather today in Paris?");
  assert(tNon.intent === "unsupported_non_dsa", "Rejects non-DSA question cleanly");
  assert(tNon.lessonId === null, "Non-DSA returns null lessonId");
}

/* ══════════════════════════════════════════
   6. Cross-Structure Isolation (P0 Guarantee)
   ══════════════════════════════════════════ */
console.log("\n── 6. Multi-Structure Lesson Isolation ──");
{
  // Replay Quick Sort -> Graph BFS -> Stack -> BST -> Linked List
  const sSort = replay(lessonFromId("quick-sort")!.steps, 10);
  assert(sSort.array !== null, "Sort: array present");
  assert(sSort.graph === null, "Sort: NO graph");
  assert(sSort.stack === null, "Sort: NO stack");
  assert(sSort.queue === null, "Sort: NO queue");
  assert(sSort.hashTable === null, "Sort: NO hash table");
  assert(sSort.tree === null, "Sort: NO tree");
  assert(sSort.linkedList === null, "Sort: NO linked list");

  const sGraph = replay(lessonFromId("graph-bfs")!.steps, 5);
  assert(sGraph.graph !== null, "Graph BFS: graph present");
  assert(sGraph.array === null, "Graph BFS: NO residual array from Sort");
  assert(sGraph.stack === null, "Graph BFS: NO stack");
  assert(sGraph.tree === null, "Graph BFS: NO tree");

  const sStack = replay(lessonFromId("stack-ops")!.steps, 3);
  assert(sStack.stack !== null, "Stack: stack present");
  assert(sStack.graph === null, "Stack: NO residual graph");
  assert(sStack.array === null, "Stack: NO residual array");

  const sQueue = replay(lessonFromId("queue-ops")!.steps, 3);
  assert(sQueue.queue !== null, "Queue: queue present");
  assert(sQueue.stack === null, "Queue: NO residual stack");

  const sHash = replay(lessonFromId("hash-table-ops")!.steps, 4);
  assert(sHash.hashTable !== null, "Hash Table: hash table present");
  assert(sHash.queue === null, "Hash Table: NO residual queue");
}

/* ═══════════════════════════════════════════
   RESULTS
   ═══════════════════════════════════════════ */
console.log(`\n${"═".repeat(50)}`);
console.log(`  Coverage Suite: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
