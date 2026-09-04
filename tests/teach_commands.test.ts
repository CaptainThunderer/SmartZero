/**
 * SmartZero Teach Mode — Command Parser & Executor Test Suite
 *
 * Run: npx tsx tests/teach_commands.test.ts
 */

import { parseTeachCommand, TEACH_AUTOCOMPLETE_COMMANDS } from "../teach/commandParser";
import { executeTeachCommand } from "../teach/commandExecutor";
import { initialCanvas } from "../engine/core";
import type { CanvasState } from "../types/dsa";

let passed = 0;
let failed = 0;

function assert(condition: any, name: string) {
  if (Boolean(condition)) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
  }
}

console.log("── Testing Teach Mode Autocomplete Registry ──");
const requiredCmds = [
  "/array",
  "/list",
  "/var",
  "/set",
  "/pointer",
  "/stack",
  "/queue",
  "/tree",
  "/bst",
  "/heap",
  "/setdata",
  "/map",
  "/graph",
  "/clear",
  "/reset",
  "/undo",
  "/push",
  "/pop",
];
for (const cmd of requiredCmds) {
  const found = TEACH_AUTOCOMPLETE_COMMANDS.some((c) => c.cmd === cmd);
  assert(found, `Autocomplete entry exists for ${cmd}`);
}

console.log("\n── Testing Command Parser ──");
// Array
const arr1 = parseTeachCommand("/array(10, 5, 20, 8, 15)");
assert(arr1.success && arr1.command?.type === "array" && arr1.command.values.length === 5, "Parses /array(10, 5, 20, 8, 15)");
const arr2 = parseTeachCommand("/array([1, 2, 3])");
assert(arr2.success && arr2.command?.type === "array" && arr2.command.values.length === 3, "Parses /array([1, 2, 3])");
const arr3 = parseTeachCommand("/array(-10, 3.14, 0)");
assert(arr3.success && arr3.command?.type === "array" && arr3.command.values[0] === -10, "Parses negative & float numbers");
const arrErr = parseTeachCommand("/array(1, foo, 3)");
assert(!arrErr.success && Boolean(arrErr.error), "Rejects non-numeric array elements");

// Variables & Set
const var1 = parseTeachCommand("/var(max=10)");
assert(var1.success && var1.command?.type === "var" && var1.command.value === 10, "Parses /var(max=10)");
const var2 = parseTeachCommand("/var(status='searching')");
assert(var2.success && var2.command?.type === "var" && var2.command.value === "searching", "Parses string variable");
const set1 = parseTeachCommand("/set(max=20)");
assert(set1.success && set1.command?.type === "set" && set1.command.value === 20, "Parses /set(max=20)");
const setElem = parseTeachCommand("/set(arr[2]=99)");
assert(setElem.success && setElem.command?.type === "set_element" && setElem.command.index === 2, "Parses /set(arr[2]=99)");
const push1 = parseTeachCommand("/push(42)");
assert(push1.success && push1.command?.type === "push" && push1.command.value === 42, "Parses /push(42)");
const pop1 = parseTeachCommand("/pop");
assert(pop1.success && pop1.command?.type === "pop", "Parses /pop");

// Pointers
const ptr1 = parseTeachCommand("/pointer(i, 0)");
assert(ptr1.success && ptr1.command?.type === "pointer" && ptr1.command.index === 0, "Parses /pointer(i, 0)");
const ptrErr = parseTeachCommand("/pointer(i, abc)");
assert(!ptrErr.success, "Rejects non-integer pointer index");

// Data structures
const list1 = parseTeachCommand("/list(1, 2, 3, 4)");
assert(list1.success && list1.command?.type === "list" && list1.command.values.length === 4, "Parses /list(1, 2, 3, 4)");
const stack1 = parseTeachCommand("/stack(10, 20, 30)");
assert(stack1.success && stack1.command?.type === "stack" && stack1.command.values.length === 3, "Parses /stack(10, 20, 30)");
const queue1 = parseTeachCommand("/queue(A, B, C)");
assert(queue1.success && queue1.command?.type === "queue" && queue1.command.values.length === 3, "Parses /queue(A, B, C)");
const bst1 = parseTeachCommand("/bst(50, 30, 70, 20, 40)");
assert(bst1.success && bst1.command?.type === "bst" && bst1.command.values.length === 5, "Parses /bst(50, 30, 70, 20, 40)");
const heap1 = parseTeachCommand("/heap(20, 10, 30, 5, 15)");
assert(heap1.success && heap1.command?.type === "heap", "Parses /heap(20, 10, 30, 5, 15)");
const setdata1 = parseTeachCommand("/setdata(1, 2, 2, 3)");
assert(setdata1.success && setdata1.command?.type === "setdata", "Parses /setdata(1, 2, 2, 3)");
const map1 = parseTeachCommand('/map(name: "Alice", age: 30)');
assert(map1.success && map1.command?.type === "map" && (map1.command.entries as any).name === "Alice", "Parses /map");
const graph1 = parseTeachCommand("/graph(A-B, B-C)");
assert(graph1.success && graph1.command?.type === "graph" && graph1.command.edges.length === 2, "Parses /graph(A-B, B-C)");

console.log("\n── Testing Command Executor ──");
let state: CanvasState = initialCanvas();
let history: CanvasState[] = [];

// /array
let res = executeTeachCommand(arr1.command!, state, history);
assert(res.success && res.newState.array?.values.length === 5, "Executes /array: canvas has 5 values");
assert(res.newState.boardHeader?.title.includes("Array [10, 5, 20, 8, 15]"), "Board header updated with array values");

// /var and /set
res = executeTeachCommand(var1.command!, res.newState, res.history);
assert(res.success && res.newState.variables["max"] === 10, "Executes /var: declares variable max=10");
res = executeTeachCommand(set1.command!, res.newState, res.history);
assert(res.success && res.newState.variables["max"] === 20, "Executes /set: updates variable max=20");

// /pointer
res = executeTeachCommand(ptr1.command!, res.newState, res.history);
assert(res.success && res.newState.array?.pointers["i"] === 0, "Executes /pointer: sets pointer i at index 0");

// /set on array element
res = executeTeachCommand(setElem.command!, res.newState, res.history);
assert(res.success && res.newState.array?.values[2] === 99, "Executes /set_element: array[2] is updated to 99");

// /push and /pop
res = executeTeachCommand(push1.command!, res.newState, res.history);
assert(res.success && res.newState.array?.values.length === 6 && res.newState.array?.values[5] === 42, "Executes /push: appends 42");
res = executeTeachCommand(pop1.command!, res.newState, res.history);
assert(res.success && res.newState.array?.values.length === 5, "Executes /pop: removes last element");

// /undo
const beforeUndoLength = res.newState.array?.values.length;
const undoRes = executeTeachCommand({ type: "undo" }, res.newState, res.history);
assert(undoRes.success, "Executes /undo successfully");
assert(undoRes.newState.array?.values.length === 6, "Undo restored state prior to pop (length 6)");

// /clear
const clearRes = executeTeachCommand({ type: "clear" }, undoRes.newState, undoRes.history);
assert(clearRes.success && clearRes.newState.array === null, "Executes /clear: empties canvas");

// /bst
const bstRes = executeTeachCommand(bst1.command!, clearRes.newState, clearRes.history);
assert(bstRes.success && bstRes.newState.tree?.nodes.length === 5, "Executes /bst: constructs 5 nodes");
assert(bstRes.newState.tree?.edges.length === 4, "Executes /bst: constructs 4 edges");

console.log(`\n══════════════════════════════════════════════════`);
console.log(`  Teach Mode Suite: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
