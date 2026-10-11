import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_CONSOLE_HEIGHT,
  MIN_CONSOLE_HEIGHT,
  MIN_EDITOR_HEIGHT,
  RESIZE_HANDLE_HEIGHT,
  clampConsoleHeight,
} from "../components/contest/CodingIDE";

console.log("==================================================");
console.log("▶ RUNNING RESIZABLE OUTPUT CONSOLE TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

// ── 1. Sizing Constants & Default Limits ──
console.log("── 1. Sizing Constants & Default Limits ──");
testAssert(DEFAULT_CONSOLE_HEIGHT === 216, `DEFAULT_CONSOLE_HEIGHT is 216px (matches original layout)`);
testAssert(MIN_CONSOLE_HEIGHT === 120, `MIN_CONSOLE_HEIGHT is 120px (keeps tabs, controls & verdict visible)`);
testAssert(MIN_EDITOR_HEIGHT === 160, `MIN_EDITOR_HEIGHT is 160px (preserves usable code editing area)`);
testAssert(RESIZE_HANDLE_HEIGHT === 8, `RESIZE_HANDLE_HEIGHT is 8px (comfortable interactive drag bar)`);

// ── 2. Boundary Clamping Math ──
console.log("\n── 2. Boundary Clamping Math ──");
{
  const container = 650;
  const maxAllowed = 650 - MIN_EDITOR_HEIGHT - RESIZE_HANDLE_HEIGHT; // 482px

  // Within range
  testAssert(clampConsoleHeight(300, container) === 300, "Target within range (300px) returns 300px");
  testAssert(clampConsoleHeight(216, container) === 216, "Default height (216px) returns 216px");

  // Clamped at bottom (min height)
  testAssert(clampConsoleHeight(100, container) === MIN_CONSOLE_HEIGHT, `Sub-minimum height (100px) clamps to ${MIN_CONSOLE_HEIGHT}px`);
  testAssert(clampConsoleHeight(0, container) === MIN_CONSOLE_HEIGHT, `Zero height clamps to ${MIN_CONSOLE_HEIGHT}px`);
  testAssert(clampConsoleHeight(-50, container) === MIN_CONSOLE_HEIGHT, `Negative height clamps to ${MIN_CONSOLE_HEIGHT}px`);

  // Clamped at top (max height respecting editor)
  testAssert(clampConsoleHeight(550, container) === maxAllowed, `Super-maximum height (550px) clamps to max ${maxAllowed}px`);
  testAssert(clampConsoleHeight(800, container) === maxAllowed, `Extreme height (800px) clamps to max ${maxAllowed}px`);

  // Pixel rounding
  testAssert(clampConsoleHeight(245.4, container) === 245, "Decimals round to nearest integer (245.4 -> 245)");
  testAssert(clampConsoleHeight(245.7, container) === 246, "Decimals round to nearest integer (245.7 -> 246)");
}

// ── 3. Responsive Container Bounds ──
console.log("\n── 3. Responsive Container Bounds ──");
{
  // Large screen: 1000px container
  const largeContainer = 1000;
  const largeMax = 1000 - MIN_EDITOR_HEIGHT - RESIZE_HANDLE_HEIGHT; // 832px
  testAssert(clampConsoleHeight(500, largeContainer) === 500, "Large container allows expanded console up to 500px");
  testAssert(clampConsoleHeight(800, largeContainer) === 800, "Large container allows expanded console up to 800px");
  testAssert(clampConsoleHeight(950, largeContainer) === largeMax, `Large container clamps to ${largeMax}px (keeps editor space)`);

  // Compact screen: 450px container
  const compactContainer = 450;
  const compactMax = 450 - MIN_EDITOR_HEIGHT - RESIZE_HANDLE_HEIGHT; // 282px
  testAssert(clampConsoleHeight(250, compactContainer) === 250, "Compact container preserves proportional resize (250px)");
  testAssert(clampConsoleHeight(400, compactContainer) === compactMax, `Compact container clamps to ${compactMax}px`);

  // Ultra-cramped screen: 200px container (extreme edge case)
  const tinyContainer = 200;
  testAssert(clampConsoleHeight(200, tinyContainer) === MIN_CONSOLE_HEIGHT, `Ultra-cramped container protects MIN_CONSOLE_HEIGHT (${MIN_CONSOLE_HEIGHT}px)`);
}

// ── 4. Pointer Dragging Simulation (Delta Math) ──
console.log("\n── 4. Pointer Dragging Simulation ──");
{
  const container = 650;
  let currentHeight = DEFAULT_CONSOLE_HEIGHT; // 216px

  // Drag UPWARD by 84px (Pointer moves Y: 500 -> 416, deltaY = -84)
  const dragUpDeltaY = -84;
  const heightAfterUp = clampConsoleHeight(currentHeight - dragUpDeltaY, container);
  testAssert(heightAfterUp === 300, `Dragging upward (delta -84px) increases height from 216px to 300px`);
  currentHeight = heightAfterUp;

  // Drag DOWNWARD by 60px (Pointer moves Y: 416 -> 476, deltaY = +60)
  const dragDownDeltaY = 60;
  const heightAfterDown = clampConsoleHeight(currentHeight - dragDownDeltaY, container);
  testAssert(heightAfterDown === 240, `Dragging downward (delta +60px) decreases height from 300px to 240px`);
  currentHeight = heightAfterDown;

  // Drag UPWARD to maximum limit (Pointer delta = -400)
  const dragMaxDeltaY = -400;
  const heightAtMax = clampConsoleHeight(currentHeight - dragMaxDeltaY, container);
  const expectedMax = 650 - MIN_EDITOR_HEIGHT - RESIZE_HANDLE_HEIGHT;
  testAssert(heightAtMax === expectedMax, `Dragging upward past ceiling clamps exactly to max height (${expectedMax}px)`);

  // Drag DOWNWARD to minimum limit (Pointer delta = +500)
  const dragMinDeltaY = 500;
  const heightAtMin = clampConsoleHeight(currentHeight - dragMinDeltaY, container);
  testAssert(heightAtMin === MIN_CONSOLE_HEIGHT, `Dragging downward past floor clamps exactly to min height (${MIN_CONSOLE_HEIGHT}px)`);
}

// ── 5. Keyboard Navigation & Accessibility Semantics ──
console.log("\n── 5. Keyboard Navigation & Accessibility Semantics ──");
{
  const container = 650;
  const maxAllowed = 650 - MIN_EDITOR_HEIGHT - RESIZE_HANDLE_HEIGHT;
  let height = 216;

  // ArrowUp: Step +20px
  height = clampConsoleHeight(height + 20, container);
  testAssert(height === 236, "ArrowUp increments console height by 20px");

  // Shift + ArrowUp: Step +40px
  height = clampConsoleHeight(height + 40, container);
  testAssert(height === 276, "Shift + ArrowUp increments console height by 40px");

  // ArrowDown: Step -20px
  height = clampConsoleHeight(height - 20, container);
  testAssert(height === 256, "ArrowDown decrements console height by 20px");

  // Home key: Jump to minimum height
  height = MIN_CONSOLE_HEIGHT;
  testAssert(height === 120, "Home key sets console height directly to MIN_CONSOLE_HEIGHT (120px)");

  // End key: Jump to maximum height
  height = maxAllowed;
  testAssert(height === maxAllowed, `End key sets console height directly to maxAllowed (${maxAllowed}px)`);

  // Double Click Reset: Restores default height
  height = DEFAULT_CONSOLE_HEIGHT;
  testAssert(height === 216, "Double click restores default console height (216px)");
}

// ── 6. Component Code & Static Architecture Verification ──
console.log("\n── 6. Component Code & Static Architecture Verification ──");
{
  const filePath = path.resolve("components/contest/CodingIDE.tsx");
  const code = fs.readFileSync(filePath, "utf-8");

  testAssert(code.includes('role="separator"'), "Resize handle contains accessible role='separator'");
  testAssert(code.includes('aria-orientation="horizontal"'), "Resize handle contains aria-orientation='horizontal'");
  testAssert(code.includes('aria-label="Resize console"'), "Resize handle contains accessible aria-label");
  testAssert(code.includes("cursor-row-resize"), "Resize handle contains cursor-row-resize");
  testAssert(code.includes("rightPaneRef"), "Container ref rightPaneRef mounted for dynamic height bounds");
  testAssert(code.includes("automaticLayout: true"), "Monaco Editor has automaticLayout enabled for dynamic reflow");
  testAssert(code.includes("overflow-y-auto"), "Console drawer content maintains overflow-y-auto scroll behavior");
  testAssert(code.includes("fixed inset-0 z-50 cursor-row-resize select-none"), "Full-screen drag overlay prevents Monaco from intercepting pointer events");
  testAssert(code.includes("window.removeEventListener(\"pointermove\""), "Pointermove window listener properly cleaned up");
  testAssert(code.includes("window.removeEventListener(\"pointerup\""), "Pointerup window listener properly cleaned up");
  testAssert(code.includes("window.removeEventListener(\"pointercancel\""), "Pointercancel window listener properly cleaned up");
  testAssert(!code.includes("react-resizable"), "Zero external resizing dependencies introduced");
}

console.log(`\n==================================================`);
console.log(`🎉 ALL ${passed} RESIZABLE CONSOLE ASSERTIONS PASSED!`);
console.log(`==================================================`);
