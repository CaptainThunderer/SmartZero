/**
 * SmartZero 2.0 — Phase 10 Secure Exam & Anti-Cheat Test Suite
 *
 * Verifies:
 * 1. Auditable security event logging for browser events
 * 2. Fact-based event recording without premature accusations
 * 3. Configurable warning and violation thresholds
 * 4. Progressive policy enforcement: continue -> warning -> lock
 * 5. Event metadata preservation (timestamps, user agent, coordinates)
 * 6. Historical event inspection for proctors/admins
 *
 * Run: npx tsx tests/anti_cheat.test.ts
 */

import {
  recordSecurityEvent,
  getParticipantSecurityEvents,
} from "../lib/contest/security";

console.log("▶ Running SmartZero Phase 10 Secure Exam & Anti-Cheat Tests...\n");

let passed = 0;
function testAssert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    throw new Error(`Assertion failed: ${name}`);
  }
}

async function run() {
  const testContestId = "contest-security-audit-101";
  const testParticipantId = "part-student-eva-77";
  const testUserId = "user-student-eva";

  // ── 1. Single Event Logging (Low Threshold) ──
  console.log("── 1. Single Security Event Logging ──");
  const event1 = await recordSecurityEvent({
    contest_id: testContestId,
    participant_id: testParticipantId,
    user_id: testUserId,
    event_type: "context_menu",
    metadata: { x: 450, y: 320 },
    policy: { warning_threshold: 2, violation_threshold: 4, action_on_violation: "lock" },
  });

  testAssert(event1.event.id.startsWith("sec-"), "Security event assigned valid unique ID");
  testAssert(event1.event.event_type === "context_menu", "Event type recorded accurately");
  testAssert(event1.total_events === 1, "Total event count is 1");
  testAssert(event1.action === "continue", "First isolated event does not trigger warning (action: continue)");

  // ── 2. Warning Threshold Reached ──
  console.log("\n── 2. Warning Threshold Enforcement ──");
  const event2 = await recordSecurityEvent({
    contest_id: testContestId,
    participant_id: testParticipantId,
    user_id: testUserId,
    event_type: "tab_switch",
    metadata: { reason: "Document visibility set to hidden" },
    policy: { warning_threshold: 2, violation_threshold: 4, action_on_violation: "lock" },
  });

  testAssert(event2.total_events === 2, "Total event count is 2");
  testAssert(event2.action === "warning", "Reaching warning threshold sets action: 'warning'");
  testAssert(event2.message.includes("integrity warning"), "Advisory non-accusatory warning message returned");

  // ── 3. Third Event (Between Warning & Violation) ──
  console.log("\n── 3. Successive Event Logging ──");
  const event3 = await recordSecurityEvent({
    contest_id: testContestId,
    participant_id: testParticipantId,
    user_id: testUserId,
    event_type: "fullscreen_exit",
    metadata: { reason: "User pressed ESC" },
    policy: { warning_threshold: 2, violation_threshold: 4, action_on_violation: "lock" },
  });

  testAssert(event3.total_events === 3, "Total event count is 3");
  testAssert(event3.action === "warning", "Still in warning state below violation threshold");

  // ── 4. Violation Threshold Triggered ──
  console.log("\n── 4. Violation Threshold & Policy Enforcement ──");
  const event4 = await recordSecurityEvent({
    contest_id: testContestId,
    participant_id: testParticipantId,
    user_id: testUserId,
    event_type: "devtools_open",
    metadata: { key: "F12" },
    policy: { warning_threshold: 2, violation_threshold: 4, action_on_violation: "lock" },
  });

  testAssert(event4.total_events === 4, "Total event count is 4");
  testAssert(event4.action === "lock", "Reaching violation threshold executes policy action ('lock')");
  testAssert(event4.message.includes("Violation threshold reached"), "Informative policy enforcement message");

  // ── 5. Auditable History Retrieval ──
  console.log("\n── 5. Auditable Security History Inspection ──");
  const history = await getParticipantSecurityEvents(testContestId, testParticipantId);

  testAssert(history.length === 4, "All 4 events preserved in auditable history log");
  testAssert(history[0].event_type === "context_menu", "Event 1 type preserved");
  testAssert(history[1].event_type === "tab_switch", "Event 2 type preserved");
  testAssert(history[2].event_type === "fullscreen_exit", "Event 3 type preserved");
  testAssert(history[3].event_type === "devtools_open", "Event 4 type preserved");

  // Verify timestamps and metadata integrity
  testAssert(typeof history[0].created_at === "string", "Timestamp present on event");
  testAssert(history[3].metadata?.key === "F12", "Event metadata retained for audit review");

  // Non-existent participant returns empty list
  const emptyHistory = await getParticipantSecurityEvents(testContestId, "non-existent-part");
  testAssert(emptyHistory.length === 0, "Non-existent participant returns empty array");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 10 ANTI-CHEAT TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
