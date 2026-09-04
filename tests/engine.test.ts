/**
 * SmartZero V1 — Core Tests
 *
 * Run: npx tsx tests/engine.test.ts
 *
 * Tests: applyAction, replay, lesson isolation, all 4 lessons,
 * misconception detection, learner evaluation, reset, switching, playback
 */

import { applyAction, initialCanvas, replay } from "../engine/core";
import {
  buildSecondMaxLesson,
  buildBinarySearchLesson,
  buildBSTLesson,
  buildLinkedListLesson,
  lessonFromId,
} from "../engine/lessons";
import type { CanvasState, DSLAction } from "../types/dsa";

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

/* ══════════════════════════════════════════
   1. applyAction Tests
   ══════════════════════════════════════════ */
console.log("\n── applyAction ──");

{
  const s0 = initialCanvas();
  assert(s0.array === null, "initial canvas has null array");
  assert(Object.keys(s0.variables).length === 0, "initial canvas has no variables");
  assert(s0.linkedList === null, "initial canvas has null linkedList");
  assert(s0.tree === null, "initial canvas has null tree");
}

{
  const s0 = initialCanvas();
  const s1 = applyAction(s0, {
    action: "create_array",
    id: "a1",
    values: [10, 20, 30],
  });
  assert(s1.array !== null, "create_array creates array");
  assert(s1.array!.values.length === 3, "array has correct length");
  assert(s1.array!.dimIndices.length === 0, "array starts with empty dimIndices");
}

{
  const s0 = initialCanvas();
  const s1 = applyAction(s0, {
    action: "create_variable",
    name: "max",
    value: 10,
  });
  assert(s1.variables["max"] === 10, "create_variable sets value");
}

{
  const s0 = applyAction(initialCanvas(), {
    action: "create_array",
    id: "a1",
    values: [10, 20],
  });
  const s1 = applyAction(s0, { action: "dim_elements", indices: [0] });
  assert(s1.array!.dimIndices.includes(0), "dim_elements dims correct index");
  assert(!s1.array!.dimIndices.includes(1), "dim_elements doesn't dim others");
}

{
  const s1 = applyAction(initialCanvas(), {
    action: "create_array",
    id: "a1",
    values: [1, 2, 3],
  });
  const s2 = applyAction(s1, { action: "reset_scene" });
  assert(s2.array === null, "reset_scene clears array");
  assert(Object.keys(s2.variables).length === 0, "reset_scene clears variables");
}

/* ══════════════════════════════════════════
   2. Replay Tests
   ══════════════════════════════════════════ */
console.log("\n── replay ──");

{
  const lesson = buildSecondMaxLesson();
  const s0 = replay(lesson.steps, 0);
  assert(s0.array !== null, "replay step 0 creates array");
  assert(s0.array!.values[0] === 10, "replay step 0 first value is 10");
  assert(s0.variables["max"] !== undefined, "replay step 0 has max variable");
}

{
  const lesson = buildSecondMaxLesson();
  const last = replay(lesson.steps, lesson.steps.length - 1);
  assert(last.complexity !== undefined, "final step has complexity");
  assert(last.complexity!.time === "O(n)", "final time is O(n)");
  assert(last.complexity!.space === "O(1)", "final space is O(1)");
}

/* ══════════════════════════════════════════
   3. CRITICAL: Lesson Isolation
   ══════════════════════════════════════════ */
console.log("\n── Lesson Isolation (P0) ──");

{
  // Start lesson A (Second Max)
  const lessonA = buildSecondMaxLesson();
  const stateA = replay(lessonA.steps, 0);
  assert(stateA.array !== null, "Lesson A: array exists");
  assert(stateA.tree === null, "Lesson A: no tree");
  assert(stateA.linkedList === null, "Lesson A: no linked list");

  // Start lesson B (BST)
  const lessonB = buildBSTLesson();
  const stateB = replay(lessonB.steps, 0);
  assert(stateB.tree !== null, "Lesson B: tree exists");
  assert(stateB.array === null, "Lesson B: NO array (A cleaned up)");
  assert(stateB.linkedList === null, "Lesson B: NO linked list");

  // Start lesson C (Linked List)
  const lessonC = buildLinkedListLesson();
  const stateC = replay(lessonC.steps, 0);
  assert(stateC.linkedList !== null, "Lesson C: linked list exists");
  assert(stateC.tree === null, "Lesson C: NO tree (B cleaned up)");
  assert(stateC.array === null, "Lesson C: NO array");

  // Start lesson D (Binary Search)
  const lessonD = buildBinarySearchLesson();
  const stateD = replay(lessonD.steps, 0);
  assert(stateD.array !== null, "Lesson D: array exists");
  assert(stateD.linkedList === null, "Lesson D: NO linked list (C cleaned up)");
  assert(stateD.tree === null, "Lesson D: NO tree");
}

/* ══════════════════════════════════════════
   4. Second Maximum Lesson
   ══════════════════════════════════════════ */
console.log("\n── Second Maximum ──");

{
  const lesson = buildSecondMaxLesson();
  assert(lesson.id === "second-max", "lesson ID is second-max");
  assert(lesson.steps.length > 0, "lesson has steps");

  // Find pause step (learner question)
  const pauseStep = lesson.steps.find((s) => s.pause);
  assert(pauseStep !== undefined, "has a pause step");
  assert(pauseStep!.question !== undefined, "pause step has question");
  assert(pauseStep!.question!.correctId === "a", "correct answer is a");
  assert(pauseStep!.question!.hints.length >= 2, "has at least 2 hints");

  // Check misconception codes
  const misconceptions = pauseStep!.question!.misconceptions;
  assert("b" in misconceptions, "has misconception for choice b");
  assert(
    misconceptions["b"].code === "SECONDMAX_MAX_CONFUSION",
    "misconception b has correct code"
  );

  // Final state
  const final = replay(lesson.steps, lesson.steps.length - 1);
  assert(final.complexity?.time === "O(n)", "final complexity O(n)");
}

/* ══════════════════════════════════════════
   5. Binary Search Lesson
   ══════════════════════════════════════════ */
console.log("\n── Binary Search ──");

{
  const lesson = buildBinarySearchLesson();
  assert(lesson.id === "binary-search", "lesson ID is binary-search");

  // Verify it's array-based, not tree
  const s0 = replay(lesson.steps, 0);
  assert(s0.array !== null, "BS uses array");
  assert(s0.tree === null, "BS does NOT show tree");

  // Check for learner question
  const pauseStep = lesson.steps.find((s) => s.pause);
  assert(pauseStep !== undefined, "BS has learner question");

  // Final state should have complexity
  const final = replay(lesson.steps, lesson.steps.length - 1);
  assert(final.complexity?.time === "O(log n)", "BS final time O(log n)");
}

/* ══════════════════════════════════════════
   6. BST Insertion Lesson
   ══════════════════════════════════════════ */
console.log("\n── BST Insertion ──");

{
  const lesson = buildBSTLesson();
  assert(lesson.id === "bst-insert", "lesson ID is bst-insert");

  const s0 = replay(lesson.steps, 0);
  assert(s0.tree !== null, "BST has tree");
  assert(s0.array === null, "BST has no array");

  const pauseSteps = lesson.steps.filter((s) => s.pause);
  assert(pauseSteps.length >= 2, "BST has multiple learner questions");
}

/* ══════════════════════════════════════════
   7. Linked List Reversal
   ══════════════════════════════════════════ */
console.log("\n── Linked List Reversal ──");

{
  const lesson = buildLinkedListLesson();
  assert(lesson.id === "linked-list-reverse", "lesson ID is linked-list-reverse");

  const s0 = replay(lesson.steps, 0);
  assert(s0.linkedList !== null, "LL has linked list");
  assert(s0.array === null, "LL has no array");
  assert(s0.tree === null, "LL has no tree");
  assert(s0.linkedList!.nodes.length === 4, "LL has 4 nodes");

  // Check semantic pointer stability
  assert(
    s0.linkedList!.pointers["curr"] === "n0",
    "curr starts at n0"
  );

  // After full replay
  const final = replay(lesson.steps, lesson.steps.length - 1);
  assert(final.complexity?.time === "O(n)", "LL final time O(n)");
}

/* ══════════════════════════════════════════
   8. Linked List Pointer Bug
   ══════════════════════════════════════════ */
console.log("\n── Linked List Pointer Bug (Semantic ID Check) ──");

{
  const lesson = buildLinkedListLesson();
  // Find the relink step at reversal step 2
  const relinkSteps = lesson.steps.filter((s) =>
    s.actions.some((a) => a.action === "relink")
  );
  assert(relinkSteps.length > 0, "has relink steps");

  // After relinking, pointer should still reference by semantic ID (n0, n1, etc.)
  // not by display index
  const afterRelink = replay(lesson.steps, 5);
  if (afterRelink.linkedList) {
    // Pointers should use semantic IDs
    const ptrValues = Object.values(afterRelink.linkedList.pointers);
    const validIds = ptrValues.every(
      (v) => v === null || v.startsWith("n")
    );
    assert(validIds, "LL pointers use semantic node IDs (n0, n1, ...) not indices");
  }
}

/* ══════════════════════════════════════════
   9. Misconception Detection
   ══════════════════════════════════════════ */
console.log("\n── Misconception Detection ──");

{
  const lesson = buildSecondMaxLesson();
  const q = lesson.steps.find((s) => s.question)?.question;
  assert(q !== undefined, "SM has question");

  // Simulate wrong answer
  const wrongId = "c";
  const misconception = q!.misconceptions[wrongId];
  assert(misconception !== undefined, "misconception exists for wrong answer");
  assert(
    misconception!.code === "SECONDMAX_MAX_CONFUSION",
    "correct misconception code"
  );
  assert(misconception!.feedback.length > 10, "feedback is substantial");
}

/* ══════════════════════════════════════════
   10. lessonFromId
   ══════════════════════════════════════════ */
console.log("\n── lessonFromId ──");

{
  assert(lessonFromId("second-max") !== null, "second-max resolves");
  assert(lessonFromId("binary-search") !== null, "binary-search resolves");
  assert(lessonFromId("bst-insert") !== null, "bst-insert resolves");
  assert(lessonFromId("linked-list-reverse") !== null, "linked-list-reverse resolves");
  assert(lessonFromId("nonexistent") === null, "nonexistent returns null");
}

/* ══════════════════════════════════════════
   11. All lessons start with reset_scene
   ══════════════════════════════════════════ */
console.log("\n── All Lessons Start With reset_scene ──");

{
  ["second-max", "binary-search", "bst-insert", "linked-list-reverse"].forEach(
    (id) => {
      const l = lessonFromId(id)!;
      const firstAction = l.steps[0].actions[0];
      assert(
        firstAction.action === "reset_scene",
        `${id} starts with reset_scene`
      );
    }
  );
}

/* ══════════════════════════════════════════
   12. All Required Misconception Codes
   ══════════════════════════════════════════ */
console.log("\n── All Required Misconception Codes ──");

{
  // 1. SECONDMAX_MAX_CONFUSION
  const sm = buildSecondMaxLesson();
  const smCodes = sm.steps
    .flatMap((s) => (s.question ? Object.values(s.question.misconceptions).map((m) => m.code) : []));
  assert(smCodes.includes("SECONDMAX_MAX_CONFUSION"), "SECONDMAX_MAX_CONFUSION exists");

  // 2. BINARY_SEARCH_WRONG_HALF
  const bs = buildBinarySearchLesson();
  const bsCodes = bs.steps
    .flatMap((s) => (s.question ? Object.values(s.question.misconceptions).map((m) => m.code) : []));
  assert(bsCodes.includes("BINARY_SEARCH_WRONG_HALF"), "BINARY_SEARCH_WRONG_HALF exists");

  // 3. BST_WRONG_BRANCH
  const bst = buildBSTLesson();
  const bstCodes = bst.steps
    .flatMap((s) => (s.question ? Object.values(s.question.misconceptions).map((m) => m.code) : []));
  assert(bstCodes.includes("BST_WRONG_BRANCH"), "BST_WRONG_BRANCH exists");

  // 4. LINKED_LIST_POINTER_CONFUSION
  const ll = buildLinkedListLesson();
  const llCodes = ll.steps
    .flatMap((s) => (s.question ? Object.values(s.question.misconceptions).map((m) => m.code) : []));
  assert(llCodes.includes("LINKED_LIST_POINTER_CONFUSION"), "LINKED_LIST_POINTER_CONFUSION exists");
}

/* ══════════════════════════════════════════
   13. Fallback AI Interpretation Priority
   ══════════════════════════════════════════ */
console.log("\n── Fallback AI Interpretation ──");

import { fallbackProvider } from "../ai/fallback";

async function runAsyncTests() {
  const t1 = await fallbackProvider.interpretQuestion("Find the second maximum element");
  assert(t1.lessonId === "second-max", "interprets second-max");

  const t2 = await fallbackProvider.interpretQuestion("Explain binary search");
  assert(t2.lessonId === "binary-search", "interprets binary-search");

  const t3 = await fallbackProvider.interpretQuestion("Insert 65 into binary search tree");
  assert(t3.lessonId === "bst-insert", "interprets bst-insert (priority over binary search)");

  const t4 = await fallbackProvider.interpretQuestion("Reverse a linked list");
  assert(t4.lessonId === "linked-list-reverse", "interprets linked-list-reverse");

  const t5 = await fallbackProvider.interpretQuestion("Some unsupported question");
  assert(t5.lessonId === null, "unsupported question returns null lessonId");

  /* ═══════════════════════════════════════════
     RESULTS
     ═══════════════════════════════════════════ */
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}\n`);

  if (failed > 0) process.exit(1);
}

runAsyncTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
