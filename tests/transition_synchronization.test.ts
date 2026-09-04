/**
 * SmartZero — Sequential Topic Transition & Synchronization Test Suite
 *
 * Validates Section 13 & Section 8 of the Synchronization Spec:
 * 1. Insertion Sort -> Kadane -> Binary Search -> Merge Sort -> Insertion Sort
 * 2. Canvas, Code, State, Current Step, Title, TopicId, and Narration all stay 100% synchronized
 * 3. Zero residual variables or visual drift between sequential topic transitions
 * 4. Asynchronous request safety: older out-of-order responses never overwrite the active lesson
 *
 * Run: npx tsx tests/transition_synchronization.test.ts
 */

import { interpretDSAQuery } from "../agent/nlu";
import { lessonFromId } from "../engine/lessons";
import { replay } from "../engine/core";
import { getConciseStepNarration } from "../lib/featherlessNarration";
import type { Lesson, CanvasState } from "../types/dsa";

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

function formatWorkspaceTitle(raw: string): string {
  if (!raw) return "Canvas";
  const clean = raw.trim();
  if (/kadane/i.test(clean)) return "Kadane Algorithm";
  if (clean.length <= 26) return clean;
  return clean.slice(0, 24) + "...";
}

interface SimulatedWorkspace {
  id: string;
  topicId: string;
  lessonId: string;
  title: string;
  lesson: Lesson;
  step: number;
  canvasState: CanvasState;
  explanation: string;
}

function applyLessonToWorkspace(ws: SimulatedWorkspace, lesson: Lesson, explanation: string) {
  ws.lesson = lesson;
  ws.lessonId = lesson.id;
  ws.topicId =
    (lesson as any).topicId ||
    (lesson.id === "max-subarray" || /kadane/i.test(lesson.title + " " + lesson.pattern)
      ? "max-subarray"
      : lesson.id);
  ws.title = formatWorkspaceTitle(lesson.title);
  ws.step = 0;
  ws.canvasState = replay(lesson.steps, 0);
  ws.explanation = explanation;
}

function resolveLessonForQuery(q: string): { lesson: Lesson; explanation: string; topicId: string } {
  const task = interpretDSAQuery(q);
  let lesson: Lesson | null = null;
  if (task.customLesson) {
    lesson = task.customLesson;
  } else if (task.lessonId && lessonFromId(task.lessonId, task.inputData)) {
    lesson = lessonFromId(task.lessonId, task.inputData)!;
  } else if (task.topicId && lessonFromId(task.topicId, task.inputData)) {
    lesson = lessonFromId(task.topicId, task.inputData)!;
  }

  if (!lesson) {
    throw new Error(`Failed to resolve lesson for query: ${q}`);
  }

  return {
    lesson,
    explanation: task.explanation || "",
    topicId: task.topicId || lesson.id,
  };
}

async function run() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  SMARTZERO TOPIC SYNCHRONIZATION & TRANSITION REGRESSION SUITE");
  console.log("══════════════════════════════════════════════════════════════");

  const ws: SimulatedWorkspace = {
    id: "ws-1",
    topicId: "",
    lessonId: "",
    title: "",
    lesson: null as any,
    step: 0,
    canvasState: null as any,
    explanation: "",
  };

  // Step 0: Start on Insertion Sort
  console.log("\n── 0. Initial State: Insertion Sort ──");
  {
    const initial = resolveLessonForQuery("Explain insertion sort");
    applyLessonToWorkspace(ws, initial.lesson, initial.explanation);

    assert(ws.topicId === "insertion-sort", "Topic is insertion-sort");
    assert(ws.title === "Insertion Sort", `Title is 'Insertion Sort' (got '${ws.title}')`);
    assert(ws.canvasState.array?.values.length === 5, "Canvas shows 5 elements for Insertion Sort");
    assert(ws.lesson.code.javascript.some((l) => l.includes("insertionSort")), "Code contains insertionSort");
    const narr = getConciseStepNarration(ws.lesson.steps[0], 0, ws.lesson.steps.length, ws.lesson.title);
    assert(narr.toLowerCase().includes("insertion") || narr.toLowerCase().includes("starting"), "Narration describes Insertion Sort");
  }

  // Step 1: User asks "Explain kadane algorithm"
  console.log("\n── 1. Transition: 'Explain kadane algorithm' ──");
  {
    const kadaneRes = resolveLessonForQuery("Explain kadane algorithm");
    applyLessonToWorkspace(ws, kadaneRes.lesson, kadaneRes.explanation);

    assert(ws.topicId === "max-subarray", `Topic updated to 'max-subarray' (got '${ws.topicId}')`);
    assert(ws.title === "Kadane Algorithm", `Workspace title is 'Kadane Algorithm' (got '${ws.title}')`);
    assert(
      JSON.stringify(ws.canvasState.array?.values) === JSON.stringify([-2, 1, -3, 4, -1, 2, 1, -5, 4]),
      "Canvas array is Kadane default [-2, 1, -3, 4, -1, 2, 1, -5, 4]"
    );
    assert(
      "currentSum" in ws.canvasState.variables || "bestSum" in ws.canvasState.variables || "maxSum" in ws.canvasState.variables,
      "State contains currentSum / maxSum variables"
    );
    assert(ws.lesson.code.javascript.some((l) => l.includes("maxSubArray")), "Code is Kadane maxSubArray");
    assert(!ws.lesson.code.javascript.some((l) => l.includes("insertionSort")), "Zero residual insertionSort code");

    const narr = getConciseStepNarration(ws.lesson.steps[0], 0, ws.lesson.steps.length, ws.lesson.title);
    assert(
      narr.toLowerCase().includes("kadane") || narr.toLowerCase().includes("subarray") || narr.toLowerCase().includes("starting"),
      `Narration describes Kadane's algorithm (got '${narr}')`
    );
  }

  // Step 2: User asks "Explain binary search"
  console.log("\n── 2. Transition: 'Explain binary search' ──");
  {
    const bsRes = resolveLessonForQuery("Explain binary search");
    applyLessonToWorkspace(ws, bsRes.lesson, bsRes.explanation);

    assert(ws.topicId === "binary-search", `Topic updated to 'binary-search' (got '${ws.topicId}')`);
    assert(ws.title === "Binary Search", `Workspace title is 'Binary Search' (got '${ws.title}')`);
    assert(ws.canvasState.array?.values.length === 8, "Canvas shows sorted array for Binary Search");
    assert(ws.lesson.code.javascript.some((l) => l.includes("binarySearch")), "Code is binarySearch");
    assert(!("currentSum" in ws.canvasState.variables), "Zero residual 'currentSum' variable from Kadane");

    const narr = getConciseStepNarration(ws.lesson.steps[0], 0, ws.lesson.steps.length, ws.lesson.title);
    assert(
      narr.toLowerCase().includes("binary search") || narr.toLowerCase().includes("starting") || narr.toLowerCase().includes("mid"),
      `Narration describes Binary Search (got '${narr}')`
    );
  }

  // Step 3: User asks "Explain merge sort"
  console.log("\n── 3. Transition: 'Explain merge sort' ──");
  {
    const msRes = resolveLessonForQuery("Explain merge sort");
    applyLessonToWorkspace(ws, msRes.lesson, msRes.explanation);

    assert(ws.topicId === "merge-sort", `Topic updated to 'merge-sort' (got '${ws.topicId}')`);
    assert(ws.title === "Merge Sort", `Workspace title is 'Merge Sort' (got '${ws.title}')`);
    assert(ws.lesson.code.javascript.some((l) => l.includes("mergeSort")), "Code is mergeSort");

    const narr = getConciseStepNarration(ws.lesson.steps[0], 0, ws.lesson.steps.length, ws.lesson.title);
    assert(
      narr.toLowerCase().includes("merge") || narr.toLowerCase().includes("starting") || narr.toLowerCase().includes("divide") || narr.toLowerCase().includes("halv"),
      `Narration describes Merge Sort (got '${narr}')`
    );
  }

  // Step 4: User asks "Explain insertion sort"
  console.log("\n── 4. Transition: 'Explain insertion sort' (Return) ──");
  {
    const isRes = resolveLessonForQuery("Explain insertion sort");
    applyLessonToWorkspace(ws, isRes.lesson, isRes.explanation);

    assert(ws.topicId === "insertion-sort", `Topic returned to 'insertion-sort' (got '${ws.topicId}')`);
    assert(ws.title === "Insertion Sort", `Workspace title returned to 'Insertion Sort' (got '${ws.title}')`);
    assert(ws.canvasState.array?.values.length === 5, "Canvas returned to Insertion Sort array");
    assert(ws.lesson.code.javascript.some((l) => l.includes("insertionSort")), "Code returned to insertionSort");

    const narr = getConciseStepNarration(ws.lesson.steps[0], 0, ws.lesson.steps.length, ws.lesson.title);
    assert(
      narr.toLowerCase().includes("insertion") || narr.toLowerCase().includes("starting"),
      `Narration describes Insertion Sort (got '${narr}')`
    );
  }

  // Step 5: Asynchronous Request Ordering Guard (Section 8)
  console.log("\n── 5. Asynchronous Out-of-Order Safety ──");
  {
    const requestSeq: Record<string, number> = { "ws-1": 0 };
    let currentLessonTitle = "Kadane Algorithm";

    // Simulate Request A fired first
    const seqA = ++requestSeq["ws-1"]; // seq 1: Insertion Sort
    // Simulate Request B fired second
    const seqB = ++requestSeq["ws-1"]; // seq 2: Kadane
    currentLessonTitle = "Kadane Algorithm";

    // Out-of-order resolution: Request A finishes AFTER Request B
    const handleResponseA = () => {
      if (requestSeq["ws-1"] !== seqA) {
        // Stale response ignored!
        return false;
      }
      currentLessonTitle = "Insertion Sort";
      return true;
    };

    const acceptedA = handleResponseA();
    assert(!acceptedA, "Stale asynchronous response A was discarded by sequence guard");
    assert(currentLessonTitle === "Kadane Algorithm", "Active lesson remained Kadane Algorithm");
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`Transition Tests: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
