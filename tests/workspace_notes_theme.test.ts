/**
 * SmartZero V1 — Workspace, Notes & Theme Verification Test Suite
 *
 * Run: npx tsx tests/workspace_notes_theme.test.ts
 */

import {
  useWorkspaceStore,
  generateWorkspaceTitle,
  createInitialWorkspace,
} from "../stores/workspaceStore";
import { interpretDSAQuery } from "../agent/nlu";
import { replay } from "../engine/core";
import { lessonFromId } from "../engine/lessons";
import type { LearningWorkspace, AppTheme } from "../types/dsa";

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
console.log("  SMARTZERO V1 — WORKSPACE, NOTES & THEME TESTS");
console.log("==================================================");

/* ══════════════════════════════════════════
   1. Workspace Creation & Initialization
   ══════════════════════════════════════════ */
console.log("\n── 1. Workspace Creation ──");
{
  const store = useWorkspaceStore.getState();
  const initialCount = store.workspaces.length;
  assert(initialCount >= 1, "starts with at least 1 default workspace");

  const wsAId = store.createWorkspace(
    "quick-sort",
    "Quick Sort — [8, 3, 5, 1, 9]",
    "quick-sort",
    [8, 3, 5, 1, 9]
  );
  const updatedStore = useWorkspaceStore.getState();
  assert(updatedStore.workspaces.length === initialCount + 1, "creates new workspace");
  assert(updatedStore.activeWorkspaceId === wsAId, "activates newly created workspace");

  const wsA = updatedStore.getActiveWorkspace();
  assert(wsA.id === wsAId, "active workspace matches returned ID");
  assert(wsA.title === "Quick Sort — [8, 3, 5, 1, 9]", "correct workspace title");
  assert(wsA.topicId === "quick-sort", "correct topicId");
  assert(wsA.lessonId === "quick-sort", "correct lessonId");
  assert(wsA.lesson !== null, "loads Quick Sort lesson");
  assert(wsA.step === 0, "starts at step 0");
  assert(wsA.playing === false, "playback starts paused");
  assert(wsA.notes.length === 0, "notes start empty");
  assert(wsA.chat.length >= 1, "has initial AI Teacher greeting");
  assert(wsA.mode === "learn", "mode starts as 'learn'");
}

/* ══════════════════════════════════════════
   2. Workspace Switching & Isolation
   ══════════════════════════════════════════ */
console.log("\n── 2. Workspace Switching & State Isolation ──");
{
  const store = useWorkspaceStore.getState();
  const ws1Id = store.activeWorkspaceId;

  // Advance Workspace 1 to step 5
  store.updateActiveWorkspace({ step: 5, playing: true });
  assert(useWorkspaceStore.getState().getActiveWorkspace().step === 5, "Workspace 1 advanced to step 5");

  // Create Workspace 2 (Binary Search)
  const ws2Id = store.createWorkspace(
    "binary-search",
    "Binary Search — Target 60",
    "binary-search",
    [10, 20, 30, 40, 50, 60, 70, 80]
  );

  const ws2 = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws2.id === ws2Id, "Workspace 2 is now active");
  assert(ws2.lessonId === "binary-search", "Workspace 2 has binary-search lesson");
  assert(ws2.step === 0, "Workspace 2 starts at step 0 (isolated from Workspace 1)");
  assert(ws2.playing === false, "Workspace 2 playback is paused");

  // Verify Workspace 1 playback was paused when switched away
  const ws1 = useWorkspaceStore.getState().workspaces.find((w) => w.id === ws1Id)!;
  assert(ws1.playing === false, "Workspace 1 playback was paused upon switching away");
  assert(ws1.step === 5, "Workspace 1 step 5 was preserved");

  // Switch back to Workspace 1
  store.switchWorkspace(ws1Id);
  const activeAfterSwitch = useWorkspaceStore.getState().getActiveWorkspace();
  assert(activeAfterSwitch.id === ws1Id, "Switched back to Workspace 1");
  assert(activeAfterSwitch.step === 5, "Workspace 1 restored at exact step 5");
  assert(activeAfterSwitch.lessonId === "quick-sort", "Workspace 1 restored Quick Sort lesson");
}

/* ══════════════════════════════════════════
   3. Notes Isolation & CRUD
   ══════════════════════════════════════════ */
console.log("\n── 3. Notes Management & Workspace Isolation ──");
{
  const store = useWorkspaceStore.getState();
  const currentWs = store.getActiveWorkspace();

  // Add note to Workspace 1
  store.addNote("Quick Sort Invariant", "Pivot chosen as 9. Elements smaller than pivot go left.");
  const ws1WithNote = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws1WithNote.notes.length === 1, "Added note to Workspace 1");
  assert(ws1WithNote.notes[0].title === "Quick Sort Invariant", "Note title correct");
  assert(ws1WithNote.notes[0].content.includes("Pivot chosen as 9"), "Note content correct");

  const noteId = ws1WithNote.notes[0].id;

  // Switch to Workspace 2
  const otherWs = store.workspaces.find((w) => w.id !== currentWs.id)!;
  store.switchWorkspace(otherWs.id);
  const ws2Active = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws2Active.notes.length === 0, "CRITICAL: Workspace 2 notes are completely isolated (length 0)");

  // Add note to Workspace 2
  store.addNote("Binary Search Bounds", "low and high converge on target in log(n) steps.");
  const ws2WithNote = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws2WithNote.notes.length === 1, "Added note to Workspace 2");
  assert(ws2WithNote.notes[0].title === "Binary Search Bounds", "Workspace 2 note title correct");

  // Switch back to Workspace 1 and verify its note is intact and not mixed
  store.switchWorkspace(currentWs.id);
  const ws1Returned = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws1Returned.notes.length === 1, "Workspace 1 note preserved (length 1)");
  assert(ws1Returned.notes[0].title === "Quick Sort Invariant", "Workspace 1 note content intact");
  assert(!ws1Returned.notes.some((n) => n.title === "Binary Search Bounds"), "CRITICAL: No note leakage from Workspace 2");

  // Edit note in Workspace 1
  store.updateNote(noteId, "Quick Sort Partitioning", "Updated: Partitioning around pivot 9 is complete.");
  const ws1Edited = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws1Edited.notes[0].title === "Quick Sort Partitioning", "Note successfully updated");

  // Delete note in Workspace 1
  store.deleteNote(noteId);
  const ws1Deleted = useWorkspaceStore.getState().getActiveWorkspace();
  assert(ws1Deleted.notes.length === 0, "Note successfully deleted from Workspace 1");
}

/* ══════════════════════════════════════════
   4. Canvas & Excalidraw Scene Isolation
   ══════════════════════════════════════════ */
console.log("\n── 4. Cross-Workspace Canvas State Isolation ──");
{
  const store = useWorkspaceStore.getState();

  // Create BST Workspace
  const bstId = store.createWorkspace(
    "bst-insert",
    "BST — Insert 65",
    "bst-insert",
    [50, 30, 70, 20, 40, 60, 80]
  );
  const bstWs = useWorkspaceStore.getState().getActiveWorkspace();
  assert(bstWs.canvasState.tree !== null, "BST workspace canvas has tree");
  assert(bstWs.canvasState.array === null, "BST workspace canvas has NO array");

  // Create Linked List Workspace
  const llId = store.createWorkspace(
    "linked-list-reverse",
    "Linked List — Reverse",
    "linked-list-reverse",
    [1, 2, 3, 4]
  );
  const llWs = useWorkspaceStore.getState().getActiveWorkspace();
  assert(llWs.canvasState.linkedList !== null, "Linked List workspace has linkedList");
  assert(llWs.canvasState.tree === null, "Linked List workspace has NO tree (BST isolated)");

  // Verify BST workspace canvas was not contaminated
  const bstCheck = useWorkspaceStore.getState().workspaces.find((w) => w.id === bstId)!;
  assert(bstCheck.canvasState.tree !== null, "BST canvas preserved tree");
  assert(bstCheck.canvasState.linkedList === null, "CRITICAL: BST canvas has NO linked list");
}

/* ══════════════════════════════════════════
   5. AI Tutor Conversation Isolation
   ══════════════════════════════════════════ */
console.log("\n── 5. AI Tutor Conversation Isolation ──");
{
  const store = useWorkspaceStore.getState();
  const wsAId = store.activeWorkspaceId;

  // Add message to Workspace A
  store.updateActiveWorkspace((prev) => ({
    chat: [...prev.chat, { role: "user", text: "How does the pivot work in quicksort?" }],
  }));

  const chatA = useWorkspaceStore.getState().getActiveWorkspace().chat;
  assert(chatA.some((m) => m.text.includes("pivot work in quicksort")), "Workspace A contains pivot question");

  // Switch to another workspace
  const wsB = store.workspaces.find((w) => w.id !== wsAId)!;
  store.switchWorkspace(wsB.id);
  const chatB = useWorkspaceStore.getState().getActiveWorkspace().chat;
  assert(
    !chatB.some((m) => m.text.includes("pivot work in quicksort")),
    "CRITICAL: Workspace B tutor conversation has NO messages from Workspace A"
  );
}

/* ══════════════════════════════════════════
   6. Learner Modal & Question Isolation
   ══════════════════════════════════════════ */
console.log("\n── 6. Learner Modal & Question Isolation ──");
{
  const store = useWorkspaceStore.getState();
  const currentWs = store.getActiveWorkspace();

  // Simulate reaching a decision point question in active workspace
  store.updateActiveWorkspace({
    phase: "waiting_for_learner",
    draftAnswer: "a",
    selectedAnswer: null,
  });

  assert(useWorkspaceStore.getState().getActiveWorkspace().phase === "waiting_for_learner", "Active workspace in waiting_for_learner phase");

  // Switch to another workspace
  const otherWs = store.workspaces.find((w) => w.id !== currentWs.id)!;
  store.switchWorkspace(otherWs.id);
  const otherActive = useWorkspaceStore.getState().getActiveWorkspace();
  assert(
    otherActive.phase !== "waiting_for_learner",
    "CRITICAL: Other workspace does NOT show or inherit the pending question modal"
  );

  // Switch back
  store.switchWorkspace(currentWs.id);
  assert(
    useWorkspaceStore.getState().getActiveWorkspace().phase === "waiting_for_learner",
    "Pending question modal restored when returning to original workspace"
  );
}

/* ══════════════════════════════════════════
   7. Workspace Renaming & Deletion
   ══════════════════════════════════════════ */
console.log("\n── 7. Workspace Renaming & Deletion ──");
{
  const store = useWorkspaceStore.getState();
  const wsId = store.activeWorkspaceId;

  // Rename
  store.renameWorkspace(wsId, "Custom DSA Exploration");
  assert(
    useWorkspaceStore.getState().getActiveWorkspace().title === "Custom DSA Exploration",
    "Workspace renamed to 'Custom DSA Exploration'"
  );

  // Delete
  const countBefore = useWorkspaceStore.getState().workspaces.length;
  store.deleteWorkspace(wsId);
  const countAfter = useWorkspaceStore.getState().workspaces.length;
  assert(countAfter === countBefore - 1, "Workspace deleted successfully");
  assert(
    useWorkspaceStore.getState().activeWorkspaceId !== wsId,
    "Active workspace switched away from deleted workspace"
  );
  assert(
    useWorkspaceStore.getState().getActiveWorkspace() !== undefined,
    "Valid active workspace always remains after deletion"
  );
}

/* ══════════════════════════════════════════
   8. Intelligent Query Routing
   ══════════════════════════════════════════ */
console.log("\n── 8. Intelligent Query Routing ──");
{
  // Test related query
  const qRelated = "Why is quicksort sometimes O(n²)?";
  const tRelated = interpretDSAQuery(qRelated);
  assert(tRelated.topicId === "quick-sort", "Related query identifies topicId 'quick-sort'");
  assert(tRelated.intent === "complexity", "Identifies complexity intent for related query");

  // Test unrelated query
  const qUnrelated = "Explain binary search";
  const tUnrelated = interpretDSAQuery(qUnrelated);
  assert(tUnrelated.topicId === "binary-search", "Unrelated query identifies topicId 'binary-search'");
  assert(tUnrelated.topicId !== tRelated.topicId, "Correctly identifies topics as different");

  // Title generation
  const title1 = generateWorkspaceTitle("Quick Sort", [8, 3, 5, 1, 9]);
  assert(title1 === "Quick Sort — [8, 3, 5, 1, 9]", "Generates title with custom array preview");

  const title2 = generateWorkspaceTitle("Binary Search", undefined, 60);
  assert(title2 === "Binary Search — Target 60", "Generates title with target value");
}

/* ══════════════════════════════════════════
   9. Light / Dark Theme System
   ══════════════════════════════════════════ */
console.log("\n── 9. Light / Dark Theme Management ──");
{
  const store = useWorkspaceStore.getState();

  // Test theme switching
  store.setTheme("dark");
  assert(useWorkspaceStore.getState().theme === "dark", "Theme set to dark");

  store.setTheme("light");
  assert(useWorkspaceStore.getState().theme === "light", "Theme set to light");

  store.toggleTheme();
  assert(useWorkspaceStore.getState().theme === "dark", "toggleTheme switches to dark");

  // Verify theme switch does NOT reset workspace state
  const curWs = useWorkspaceStore.getState().getActiveWorkspace();
  const stepBefore = curWs.step;
  const notesCountBefore = curWs.notes.length;
  const lessonIdBefore = curWs.lessonId;

  store.toggleTheme(); // Switch back to light
  const curWsAfter = useWorkspaceStore.getState().getActiveWorkspace();
  assert(curWsAfter.step === stepBefore, "Theme switch does NOT reset lesson step");
  assert(curWsAfter.notes.length === notesCountBefore, "Theme switch does NOT reset notes");
  assert(curWsAfter.lessonId === lessonIdBefore, "Theme switch does NOT reset lesson");
}

/* ═══════════════════════════════════════════
   RESULTS
   ═══════════════════════════════════════════ */
console.log(`\n${"═".repeat(50)}`);
console.log(`  Workspace & Theme Suite: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);
