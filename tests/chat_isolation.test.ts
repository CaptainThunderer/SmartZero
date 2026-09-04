/**
 * SmartZero — Chat and Workspace Isolation Test Suite
 *
 * Run: npx tsx tests/chat_isolation.test.ts
 */

import { useWorkspaceStore, createInitialWorkspace, createEmptyWorkspace } from "../stores/workspaceStore";
import { interpretDSAQuery } from "../agent/nlu";
import { initialCanvas } from "../engine/core";

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

console.log("── Testing Workspace Creation Isolation ──");
const ws1 = createInitialWorkspace("ws-test-1", "second-max", "Second Maximum Element");
assert(ws1.id === "ws-test-1", "Workspace 1 has custom ID");
assert(ws1.topicId === "second-max", "Workspace 1 has topicId");
assert(ws1.chat.length === 1, "Workspace 1 starts with exactly 1 greeting message");
assert(ws1.chat[0].role === "ai", "Greeting message is from AI");
assert(ws1.chat[0].text.includes("Second Maximum"), "Greeting message introduces Second Maximum");

const wsEmpty = createEmptyWorkspace("ws-test-2", "Canvas 2");
assert(wsEmpty.id === "ws-test-2", "Workspace 2 has custom ID");
assert(wsEmpty.topicId === null, "New empty workspace has topicId null");
assert(wsEmpty.lesson === null, "New empty workspace has lesson null");
assert(wsEmpty.chat.length === 1, "New empty workspace has exactly 1 initial greeting");
assert(
  wsEmpty.chat[0].text === "Hi! I'm your SmartZero AI Teacher. Ask me any DSA question and we'll learn it visually on the canvas together!",
  "New empty workspace has exact standard fresh greeting"
);
assert(wsEmpty.notes.length === 0, "New empty workspace has empty notes");
assert(wsEmpty.canvasState.array === null, "New empty workspace canvasState array is null");
assert(wsEmpty.teachState.array === null, "New empty workspace teachState array is null");
assert(Array.isArray(wsEmpty.teachHistory) && wsEmpty.teachHistory.length === 0, "New empty workspace has empty teachHistory");

console.log("\n── Testing In-Flight Message Scoping to targetWsId ──");
// Simulate Zustand store with two workspaces
const store = useWorkspaceStore.getState();
store.createWorkspace("second-max", "Second Maximum Element", "second-max", [10, 5, 20, 8, 15]);
const stateAfterCreate1 = useWorkspaceStore.getState();
const firstWsId = stateAfterCreate1.activeWorkspaceId;

// Send question in Workspace 1
store.updateWorkspace(firstWsId, (prev) => ({
  chat: [...prev.chat, { role: "user", text: "How does second max work?" }],
}));

// User switches / creates Workspace 2 while AI is thinking
store.createWorkspace(undefined, "Canvas 2");
const stateAfterCreate2 = useWorkspaceStore.getState();
const secondWsId = stateAfterCreate2.activeWorkspaceId;
assert(secondWsId !== firstWsId, "Active workspace switched to newly created canvas");

// Check Canvas 2 chat
const secondWs = stateAfterCreate2.workspaces.find((w) => w.id === secondWsId)!;
assert(secondWs.chat.length === 1, "Canvas 2 chat has ONLY 1 message (initial greeting)");
assert(!secondWs.chat.some((m) => m.text.includes("How does second max work?")), "Canvas 2 does NOT leak user message from Canvas 1");

// Network response arrives for Workspace 1:
const aiResponseText = "Second maximum tracks max and secondMax in a single pass of O(n).";
store.updateWorkspace(firstWsId, (prev) => ({
  chat: [...prev.chat, { role: "ai", text: aiResponseText }],
}));

// Check that Canvas 2 STILL does not have the response:
const stateAfterArrival = useWorkspaceStore.getState();
const secondWsAfter = stateAfterArrival.workspaces.find((w) => w.id === secondWsId)!;
assert(secondWsAfter.chat.length === 1, "Canvas 2 chat remains isolated (still only 1 message)");
assert(!secondWsAfter.chat.some((m) => m.text.includes("Second maximum tracks")), "Canvas 2 did NOT receive in-flight AI message for Canvas 1");

// Check that Workspace 1 DID receive the response:
const firstWsAfter = stateAfterArrival.workspaces.find((w) => w.id === firstWsId)!;
assert(firstWsAfter.chat.length === 3, "Workspace 1 received AI response (initial + user + AI)");
assert(firstWsAfter.chat[2].text === aiResponseText, "Workspace 1 has correct response content");

console.log("\n── Testing Switching A → B → A State Restoration ──");
// Switch to Workspace 1 (A)
store.switchWorkspace(firstWsId);
const currentActiveAfterSwitchA = useWorkspaceStore.getState().activeWorkspaceId;
assert(currentActiveAfterSwitchA === firstWsId, "Switched back to Workspace A");
const wsACheck = useWorkspaceStore.getState().workspaces.find((w) => w.id === firstWsId)!;
assert(wsACheck.chat.length === 3, "Workspace A restored with its 3 chat messages");
assert(wsACheck.canvasState.array !== null, "Workspace A retained its canvas array");

// Switch to Workspace 2 (B)
store.switchWorkspace(secondWsId);
const currentActiveAfterSwitchB = useWorkspaceStore.getState().activeWorkspaceId;
assert(currentActiveAfterSwitchB === secondWsId, "Switched to Workspace B");
const wsBCheck = useWorkspaceStore.getState().workspaces.find((w) => w.id === secondWsId)!;
assert(wsBCheck.chat.length === 1, "Workspace B has ONLY its 1 initial message");
assert(wsBCheck.canvasState.array === null, "Workspace B retains empty canvas");

// Switch back to Workspace 1 (A)
store.switchWorkspace(firstWsId);
assert(useWorkspaceStore.getState().activeWorkspaceId === firstWsId, "Switched back to Workspace A again");
const wsARecheck = useWorkspaceStore.getState().workspaces.find((w) => w.id === firstWsId)!;
assert(wsARecheck.chat.length === 3, "Workspace A still has all 3 messages after switching back");

console.log("\n── Testing Teach Mode NLU & State Context ──");
const teachContext = {
  mode: "teach",
  teachSummary: "Array: [10, 5, 20, 8, 15] | Pointers: i@0 | Variables: {\"max\":10}",
};

const queryResult = interpretDSAQuery("Explain this array and how to find the max element", teachContext);
assert(queryResult.intent !== "unsupported_non_dsa", "NLU recognized DSA question in Teach mode");
assert(Boolean(queryResult.explanation), "NLU generated explanation");

console.log(`\n══════════════════════════════════════════════════`);
console.log(`  Chat Isolation Suite: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
