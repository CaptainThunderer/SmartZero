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
  assert(DSA_TOPIC_REGISTRY["dynamic-programming"].hasDeterministicEngine === false, "DP has hasDeterministicEngine=false (strictly conceptual)");
  assert(tDp.lessonId === "explain-dp", "DP maps to explain-dp whiteboard lesson");

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
  assert(tVs2.lessonId === "compare-bfs-vs-dfs", "BFS vs DFS maps to compare-bfs-vs-dfs whiteboard lesson");

  const tVs3 = interpretDSAQuery("Stack vs queue");
  assert(tVs3.intent === "compare", "Identifies comparison for 'Stack vs queue'");

  const tVs4 = interpretDSAQuery("Array vs Linked List");
  assert(tVs4.intent === "compare", "Identifies comparison for 'Array vs Linked List'");
  assert(tVs4.lessonId === "compare-array-vs-linked-list", "Array vs Linked List maps to compare-array-vs-linked-list whiteboard lesson");

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

/* ══════════════════════════════════════════
   7. Whiteboard Conceptual Lessons & Narrative Integrity
   ══════════════════════════════════════════ */
console.log("\n── 7. Whiteboard Conceptual Lessons Coverage ──");
const whiteboardLessons = [
  { id: "explain-arrays", title: "Understanding Arrays", checkKey: "array" },
  { id: "explain-two-pointers", title: "Two Pointer Technique", checkKey: "array" },
  { id: "explain-sliding-window", title: "Sliding Window Technique", checkKey: "slidingWindow" },
  { id: "explain-set", title: "Understanding Sets", checkKey: "setContainer" },
  { id: "explain-dp", title: "Dynamic Programming", checkKey: "dpTable" },
  { id: "explain-recursion", title: "Recursion & Call Stack", checkKey: "callStack" },
  { id: "explain-backtracking", title: "Backtracking Decision Tree", checkKey: "decisionTree" },
  { id: "compare-array-vs-linked-list", title: "Array vs. Linked List", checkKey: "comparisonBoard" },
  { id: "compare-bfs-vs-dfs", title: "BFS vs. DFS", checkKey: "comparisonBoard" },
  { id: "explain-complexity", title: "Time & Space Complexity", checkKey: "comparisonBoard" },
];

for (const wb of whiteboardLessons) {
  const lesson = lessonFromId(wb.id);
  assert(lesson !== null, `${wb.title} (${wb.id}) resolves successfully`);
  if (!lesson) continue;

  assert(lesson.steps.length >= 3, `${wb.title} has multiple steps (${lesson.steps.length})`);
  assert(lesson.code.javascript.length > 0, `${wb.title} has JavaScript code`);
  assert(lesson.code.cpp.length > 0, `${wb.title} has C++ code`);

  // Verify that steps have structured narrative
  const stepsWithNarrative = lesson.steps.filter((s) => s.narrative !== undefined);
  assert(
    stepsWithNarrative.length > 0,
    `${wb.title} has structured narratives (currentStep, why, whatChanged, etc.)`
  );

  // Check initial state has boardHeader
  const initial = replay(lesson.steps, 0);
  assert(initial.boardHeader !== null && initial.boardHeader !== undefined, `${wb.title} initializes boardHeader`);

  // Check final state
  const final = replay(lesson.steps, lesson.steps.length - 1);
  assert(final !== null, `${wb.title} replays to final state without error`);
}

/* ══════════════════════════════════════════
   8. Verification of 26 Representative Questions
   ══════════════════════════════════════════ */
console.log("\n── 8. 26 Representative Questions Coverage ──");

// 1. "Explain merge sort"
{
  const t = interpretDSAQuery("Explain merge sort");
  assert(t.topicId === "merge-sort" && t.lessonId === "merge-sort", "1. 'Explain merge sort' -> merge-sort lesson");
}

// 2. "Show bubble sort"
{
  const t = interpretDSAQuery("Show bubble sort");
  assert(t.intent === "visualize" && t.lessonId === "bubble-sort", "2. 'Show bubble sort' -> visualize bubble-sort");
}

// 3. "Insert 42 into this BST"
{
  const t = interpretDSAQuery("Insert 42 into this BST");
  assert(t.intent === "visualize" && t.lessonId === "bst-insert" && t.targetValue === 42, "3. 'Insert 42 into this BST' -> target 42 bst-insert");
}

// 4. "Sort [5, 1, 9, 3] with quick sort"
{
  const t = interpretDSAQuery("Sort [5, 1, 9, 3] with quick sort");
  assert(t.intent === "visualize" && t.lessonId === "quick-sort", "4. 'Sort [5, 1, 9, 3] with quick sort' -> visualize quick-sort");
  assert(JSON.stringify(t.inputData) === JSON.stringify([5, 1, 9, 3]), "4. extracts [5, 1, 9, 3]");
}

// 5. "Why is quicksort sometimes O(n^2)?"
{
  const t = interpretDSAQuery("Why is quicksort sometimes O(n²)?");
  assert(t.intent === "complexity" && t.topicId === "quick-sort", "5. 'Why is quicksort sometimes O(n²)?' -> complexity");
  assert(t.complexity?.worst === "O(n²)", "5. worst-case is O(n²)");
}

// 6. "Compare BFS and DFS"
{
  const t = interpretDSAQuery("Compare BFS and DFS");
  assert(t.intent === "compare" && t.lessonId === "compare-bfs-vs-dfs", "6. 'Compare BFS and DFS' -> compare-bfs-vs-dfs lesson");
}

// 7. "Array vs Linked List"
{
  const t = interpretDSAQuery("Array vs Linked List");
  assert(t.intent === "compare" && t.lessonId === "compare-array-vs-linked-list", "7. 'Array vs Linked List' -> compare-array-vs-linked-list lesson");
}

// 8. "What is a heap?"
{
  const t = interpretDSAQuery("What is a heap?");
  assert(t.topicId === "heap-ops", "8. 'What is a heap?' -> maps to heap-ops");
  assert(DSA_TOPIC_REGISTRY["heap-ops"].hasDeterministicEngine === false, "8. heap-ops hasDeterministicEngine=false");
}

// 9. "How does binary search work?"
{
  const t = interpretDSAQuery("How does binary search work?");
  assert(t.topicId === "binary-search" && t.lessonId === "binary-search", "9. 'How does binary search work?' -> binary-search");
}

// 10. "Reverse a linked list"
{
  const t = interpretDSAQuery("Reverse a linked list");
  assert(t.intent === "visualize" && t.lessonId === "linked-list-reverse", "10. 'Reverse a linked list' -> linked-list-reverse");
}

// 11. "Explain two pointers technique"
{
  const t = interpretDSAQuery("Explain two pointers technique");
  assert(t.topicId === "two-pointers" && t.lessonId === "explain-two-pointers", "11. 'Explain two pointers technique' -> explain-two-pointers");
}

// 12. "What is sliding window?"
{
  const t = interpretDSAQuery("What is sliding window?");
  assert(t.topicId === "sliding-window" && t.lessonId === "explain-sliding-window", "12. 'What is sliding window?' -> explain-sliding-window");
}

// 13. "Explain dynamic programming"
{
  const t = interpretDSAQuery("Explain dynamic programming");
  assert(t.topicId === "dynamic-programming" && t.lessonId === "explain-dp", "13. 'Explain dynamic programming' -> explain-dp");
}

// 14. "What is a Set and how does it work?"
{
  const t = interpretDSAQuery("What is a Set and how does it work?");
  assert(t.topicId === "set-ops" && t.lessonId === "explain-set", "14. 'What is a Set' -> explain-set");
}

// 15. "How does recursion use the call stack?"
{
  const t = interpretDSAQuery("How does recursion use the call stack?");
  assert(t.topicId === "recursion-basics" && t.lessonId === "explain-recursion", "15. 'Recursion call stack' -> explain-recursion");
}

// 16. "What is backtracking?"
{
  const t = interpretDSAQuery("What is backtracking?");
  assert(t.topicId === "backtracking" && t.lessonId === "explain-backtracking", "16. 'What is backtracking?' -> explain-backtracking");
}

// 17. "What is time and space complexity?"
{
  const t = interpretDSAQuery("What is time and space complexity?");
  assert(t.intent === "complexity" && t.lessonId === "explain-complexity", "17. 'Time and space complexity' -> explain-complexity");
}

// 18. "How to implement a trie in JavaScript or C++?"
{
  const t = interpretDSAQuery("How to implement a trie in JavaScript or C++?");
  assert(t.intent === "implementation" && t.topicId === "trie-prefix-tree", "18. 'Implement trie' -> implementation trie");
  assert(t.codeSnippets?.javascript?.includes("class Trie") === true, "18. provides JavaScript Trie implementation");
  assert(t.codeSnippets?.cpp?.includes("class Trie") === true, "18. provides C++ Trie implementation");
}

// 19. "What is Disjoint Set Union (DSU) / Union-Find?"
{
  const t = interpretDSAQuery("What is Disjoint Set Union (DSU) / Union-Find?");
  assert(t.intent === "theory" || t.intent === "explain", "19. 'Disjoint Set Union' -> theory/explain");
  assert(t.topicId === "disjoint-set-union", "19. maps to disjoint-set-union");
}

// 20. "Find the shortest path in an unweighted graph"
{
  const t = interpretDSAQuery("Find the shortest path in an unweighted graph");
  assert(t.intent === "problem_solving", "20. 'Shortest path in unweighted graph' -> problem_solving");
  assert(t.algorithm === "Breadth-First Search (BFS)", "20. recommends BFS for unweighted shortest path");
}

// 21. "What is a monotonic stack?"
{
  const t = interpretDSAQuery("What is a monotonic stack?");
  assert(t.intent === "theory" || t.intent === "explain", "21. 'What is a monotonic stack?' -> theory/explain");
  assert(t.topicId === "monotonic-stack", "21. maps to monotonic-stack");
}

// 22. "Sort strings using Radix Sort"
{
  const t = interpretDSAQuery("Sort strings using Radix Sort");
  assert(t.intent === "trace" || t.intent === "explain", "22. 'Sort strings using Radix Sort' -> trace/explain");
  assert(t.topicId === "radix-sort", "22. maps to radix-sort");
}

// 23. "Explain AVL tree rotations"
{
  const t = interpretDSAQuery("Explain AVL tree rotations");
  assert(t.intent === "theory" || t.intent === "explain", "23. 'Explain AVL tree rotations' -> theory/explain");
  assert(t.topicId === "avl-tree", "23. maps to avl-tree");
}

// 24. "Bit manipulation tricks for checking if power of two"
{
  const t = interpretDSAQuery("Bit manipulation tricks for checking if power of two");
  assert(t.intent === "theory" || t.intent === "implementation", "24. 'Bit manipulation power of two' -> theory/implementation");
  assert(t.topicId === "bit-manipulation", "24. maps to bit-manipulation");
}

// 25. "What's the weather in Tokyo?"
{
  const t = interpretDSAQuery("What's the weather in Tokyo?");
  assert(t.intent === "unsupported_non_dsa", "25. 'What's the weather in Tokyo?' -> unsupported_non_dsa");
  assert(t.lessonId === null, "25. returns null lessonId");
}

// 26. "Show me sorting"
{
  const t = interpretDSAQuery("Show me sorting");
  assert(t.intent === "clarification", "26. 'Show me sorting' -> clarification");
  assert((t.clarificationOptions?.length ?? 0) >= 4, "26. provides >= 4 clarification options");
}

/* ══════════════════════════════════════════
   9. Gold Standard Merge Sort & MergeTree Layout
   ══════════════════════════════════════════ */
console.log("\n── 9. Gold Standard Merge Sort Divide-and-Conquer ──");
{
  const msLesson = lessonFromId("merge-sort");
  assert(msLesson !== null, "Merge sort builds successfully");
  if (msLesson) {
    const finalState = replay(msLesson.steps, msLesson.steps.length - 1);
    assert(finalState.boardHeader !== null, "Merge sort has boardHeader");
    assert(finalState.insightCard !== null, "Merge sort has final insightCard");

    // Check divide-and-conquer mergeTree steps
    const stepWithTree = msLesson.steps.find((s) =>
      s.actions.some((a) => a.action === "create_merge_tree")
    );
    assert(stepWithTree !== undefined, "Merge sort creates divide-and-conquer mergeTree");

    // Check all steps have structured narrative
    const allHaveNarrative = msLesson.steps.every((s) => s.narrative !== undefined);
    assert(allHaveNarrative, "ALL Merge Sort steps have structured narrative");
  }
}

/* ═══════════════════════════════════════════
   RESULTS
   ═══════════════════════════════════════════ */
console.log(`\n${"═".repeat(50)}`);
console.log(`  Coverage Suite: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
