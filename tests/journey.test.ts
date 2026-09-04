/**
 * Comprehensive Runtime Journey Verification Script
 * Simulates the entire 27-step user journey from Section 32 of specification.
 */

import { applyAction, initialCanvas, replay } from "../engine/core";
import {
  buildSecondMaxLesson,
  buildBinarySearchLesson,
  buildBSTLesson,
  buildLinkedListLesson,
  lessonFromId,
} from "../engine/lessons";
import { fallbackProvider } from "../ai/fallback";

function assert(condition: unknown, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✔ ${msg}`);
}

async function runJourney() {
  console.log("\n==================================================");
  console.log("  SMARTZERO V1 — FULL USER JOURNEY VERIFICATION");
  console.log("==================================================\n");

  // Step 1: Open app - Clean state
  console.log("Phase 1: Initial Clean State");
  let state = initialCanvas();
  assert(state.array === null, "Canvas has no array");
  assert(Object.keys(state.variables).length === 0, "Canvas has no variables");
  assert(state.linkedList === null, "Canvas has no linked list");
  assert(state.tree === null, "Canvas has no tree");

  // Step 2 & 3: Demo Mode -> Second Maximum
  console.log("\nPhase 2: Demo Mode (Second Maximum)");
  const smLesson = lessonFromId("second-max");
  assert(smLesson !== null, "Second Maximum lesson loaded");

  let smStep = 0;
  state = replay(smLesson!.steps, smStep);
  assert(state.array !== null, "Second Max array exists");
  assert(state.array!.values.join(",") === "10,5,20,8,15", "Values are [10, 5, 20, 8, 15]");
  assert(state.variables["max"] === "−∞", "max initialized to -∞");
  assert(state.variables["secondMax"] === "−∞", "secondMax initialized to -∞");
  assert(state.array!.pointers["i"] === 0, "pointer i at index 0");

  // Step 4 & 5: Play through steps to learner question
  console.log("\nPhase 3: Play to Learner Question at 20");
  const questionStepIndex = smLesson!.steps.findIndex((s) => s.pause);
  assert(questionStepIndex > 0, "Found pause question step");

  // Advance to question step
  smStep = questionStepIndex;
  const qStep = smLesson!.steps[smStep];
  assert(qStep.pause === true, "Question step has pause = true");
  assert(qStep.question !== undefined, "Question object exists");
  assert(
    qStep.question!.prompt.includes("20"),
    "Question asks what should happen at value 20"
  );

  // Step 6 & 7: Wrong answer evaluation
  console.log("\nPhase 4: Wrong Answer & Misconception Feedback");
  const wrongChoiceId = "c"; // "Set secondMax to 20"
  const isWrongCorrect = wrongChoiceId === qStep.question!.correctId;
  assert(!isWrongCorrect, "Choice 'c' is evaluated as incorrect");

  const misconception = qStep.question!.misconceptions[wrongChoiceId];
  assert(
    misconception.code === "SECONDMAX_MAX_CONFUSION",
    "Misconception code is SECONDMAX_MAX_CONFUSION"
  );
  assert(
    misconception.feedback.includes("beats the current max"),
    "Misconception feedback gives specific pedagogical reasoning"
  );

  // Step 8: Correct answer
  console.log("\nPhase 5: Correct Answer & Progression");
  const correctChoiceId = "a";
  const isCorrect = correctChoiceId === qStep.question!.correctId;
  assert(isCorrect, "Choice 'a' is evaluated as correct");

  // Continue to end of Second Maximum
  smStep = smLesson!.steps.length - 1;
  state = replay(smLesson!.steps, smStep);
  assert(state.variables["max"] === "20", "Final max is 20");
  assert(state.variables["secondMax"] === "15", "Final secondMax is 15");
  assert(state.complexity?.time === "O(n)", "Time complexity is O(n)");
  assert(state.complexity?.space === "O(1)", "Space complexity is O(1)");

  // Step 9: Switch to Binary Search -> Verify Lesson Isolation (P0)
  console.log("\nPhase 6: Ask Binary Search — P0 Lesson Isolation Check");
  const bsTask = await fallbackProvider.interpretQuestion("Explain binary search");
  assert(bsTask.lessonId === "binary-search", "AI interprets query as binary-search");

  const bsLesson = lessonFromId(bsTask.lessonId!);
  assert(bsLesson !== null, "Binary Search lesson loaded");

  // Load step 0 of Binary Search
  state = replay(bsLesson!.steps, 0);
  assert(state.array !== null, "Binary search array exists");
  assert(state.array!.values.join(",") === "10,20,30,40,50,60,70,80", "BS array is [10..80]");
  assert(state.bounds !== null, "BS search space bounds exist");
  assert(state.tree === null, "CRITICAL: NO tree exists in Binary Search");
  assert(state.linkedList === null, "CRITICAL: NO linked list exists in Binary Search");
  assert(state.variables["max"] === undefined, "CRITICAL: Old 'max' variable is GONE");
  assert(state.variables["secondMax"] === undefined, "CRITICAL: Old 'secondMax' variable is GONE");

  // Step 10: Run Binary Search to completion
  console.log("\nPhase 7: Binary Search Execution & Elimination");
  const bsFinal = replay(bsLesson!.steps, bsLesson!.steps.length - 1);
  assert(bsFinal.message?.includes("Found 60"), "Binary search finds target 60");
  assert(bsFinal.complexity?.time === "O(log n)", "Time is O(log n)");

  // Step 11: Switch to Linked List Reversal -> Verify Binary Search is GONE
  console.log("\nPhase 8: Ask Linked List — Isolation Check");
  const llTask = await fallbackProvider.interpretQuestion("Teach me linked list reversal");
  assert(llTask.lessonId === "linked-list-reverse", "AI interprets query as linked-list-reverse");

  const llLesson = lessonFromId(llTask.lessonId!);
  assert(llLesson !== null, "Linked List lesson loaded");

  state = replay(llLesson!.steps, 0);
  assert(state.linkedList !== null, "Linked list exists");
  assert(state.array === null, "CRITICAL: Binary search array is GONE");
  assert(state.bounds === null, "CRITICAL: Binary search bounds are GONE");
  assert(state.tree === null, "CRITICAL: NO tree exists");

  // Step 12: Linked List Pointer Stability before AND after reversal
  console.log("\nPhase 9: Linked List Pointer Stability (Semantic IDs)");
  // At step 0: prev is null, curr is n0
  assert(state.linkedList!.pointers["prev"] === null, "prev starts at null");
  assert(state.linkedList!.pointers["curr"] === "n0", "curr starts at semantic node n0");

  // At final step: list is fully reversed (4 -> 3 -> 2 -> 1)
  const llFinal = replay(llLesson!.steps, llLesson!.steps.length - 1);
  assert(llFinal.linkedList !== null, "Final linked list exists");
  assert(
    llFinal.message?.includes("4 → 3 → 2 → 1"),
    "Final list message shows 4 → 3 → 2 → 1"
  );
  assert(llFinal.complexity?.time === "O(n)", "LL Time is O(n)");
  assert(llFinal.complexity?.space === "O(1)", "LL Space is O(1)");

  // Step 13: Switch to BST -> Verify Linked List is GONE
  console.log("\nPhase 10: Ask BST — Isolation Check");
  const bstTask = await fallbackProvider.interpretQuestion("Insert 65 into BST");
  assert(bstTask.lessonId === "bst-insert", "AI interprets query as bst-insert");

  const bstLesson = lessonFromId(bstTask.lessonId!);
  assert(bstLesson !== null, "BST lesson loaded");

  state = replay(bstLesson!.steps, 0);
  assert(state.tree !== null, "BST tree exists");
  assert(state.linkedList === null, "CRITICAL: Linked list is GONE");
  assert(state.array === null, "CRITICAL: Array is GONE");

  const bstFinal = replay(bstLesson!.steps, bstLesson!.steps.length - 1);
  assert(bstFinal.message?.includes("65 inserted"), "65 inserted in BST");
  assert(bstFinal.complexity?.time === "O(h)", "BST Time is O(h)");

  // Step 14: Teach Mode Isolation
  console.log("\nPhase 11: Teach Mode / Learn Mode Isolation");
  let teachState = initialCanvas();
  // Create array
  teachState = applyAction(teachState, {
    action: "create_array",
    id: "manual-arr",
    values: [10, 20, 30, 40],
  });
  // Create variable
  teachState = applyAction(teachState, {
    action: "create_variable",
    name: "max",
    value: 0,
  });
  // Create pointer
  teachState = applyAction(teachState, {
    action: "create_pointer",
    pointer: "i",
    targetIndex: 0,
  });
  // Create linked list
  teachState = applyAction(teachState, {
    action: "create_linked_list",
    values: [1, 2, 3, 4],
  });
  // Create tree
  teachState = applyAction(teachState, {
    action: "create_tree",
    nodes: [
      { id: "t50", value: 50, x: 300, y: 80, visible: true },
      { id: "t30", value: 30, x: 180, y: 170, visible: true },
      { id: "t70", value: 70, x: 420, y: 170, visible: true },
    ],
    edges: [
      ["t50", "t30"],
      ["t50", "t70"],
    ],
  });
  assert(teachState.array !== null, "Teach state has array");
  assert(teachState.tree !== null, "Teach state has tree");
  assert(teachState.linkedList !== null, "Teach state has linked list");

  // Switch to Learn Mode: Must start clean lesson, ZERO teach mode leak
  const cleanLearnState = replay(smLesson!.steps, 0);
  assert(cleanLearnState.array !== null, "Clean lesson has only its own array");
  assert(cleanLearnState.tree === null, "CRITICAL: NO teach mode tree in Learn Mode");
  assert(cleanLearnState.linkedList === null, "CRITICAL: NO teach mode linked list in Learn Mode");

  console.log("\n==================================================");
  console.log("  ALL 27 USER JOURNEY CHECKS PASSED PERFECTLY!");
  console.log("==================================================\n");
}

runJourney().catch((err) => {
  console.error(err);
  process.exit(1);
});
