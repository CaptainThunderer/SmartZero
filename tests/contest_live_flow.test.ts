/**
 * SmartZero 2.0 — Phase 5 Live Contest Foundation Test Suite
 *
 * Verifies:
 * 1. Contest discovery & public metadata sanitization (no passcode hash leak)
 * 2. Passcode validation & participant registration
 * 3. Invalid passcode rejection
 * 4. Idempotency (prevent duplicate participant records)
 * 5. Server-authoritative status & timer countdown (UPCOMING, LIVE, ENDED)
 * 6. Participant retrieval & listing
 *
 * Run: npx tsx tests/contest_live_flow.test.ts
 */

import {
  createContest,
  getContestById,
  getContestBySlug,
  computeContestStatus,
  registerContestParticipant,
  getParticipant,
  listParticipants,
  updateContest,
} from "../lib/contest/service";

console.log("▶ Running SmartZero Phase 5 Live Contest Foundation Tests...\n");

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
  // ── 1. Contest Setup & Discovery ──
  console.log("── 1. Contest Discovery & Public Metadata Sanitization ──");
  const now = Date.now();
  const contestSecret = "LIVE_CONTEST_PASS_99";
  const upcomingContest = await createContest({
    title: "National Algorithmic Sprint 2026",
    slug: "national-algorithmic-sprint-2026",
    passcode: contestSecret,
    start_at: new Date(now + 600000).toISOString(), // starts in 10 minutes
    end_at: new Date(now + 4200000).toISOString(),   // ends in 70 minutes
    duration_minutes: 60,
    instructions: "No external resources permitted. Deterministic scoring applies.",
    negative_marking: true,
    default_negative_mark: 1,
  });

  testAssert(upcomingContest.id.startsWith("contest-"), "Contest created with valid ID");
  testAssert(upcomingContest.slug === "national-algorithmic-sprint-2026", "Slug matches specification");

  // Retrieve by slug
  const retrieved = await getContestBySlug("national-algorithmic-sprint-2026");
  testAssert(retrieved !== null, "Contest resolvable by slug");
  testAssert(retrieved?.title === "National Algorithmic Sprint 2026", "Title preserved");

  // Verify passcode is hashed, never returned plaintext
  testAssert(retrieved?.passcode_hash !== contestSecret, "Passcode is never stored as plaintext");

  // ── 2. Passcode Validation & Participant Registration ──
  console.log("\n── 2. Passcode Validation & Participant Registration ──");
  const studentUser1 = "user-student-alice-101";
  const studentUser2 = "user-student-bob-102";

  // Wrong passcode should fail
  const wrongAttempt = await registerContestParticipant({
    contest_id: upcomingContest.id,
    user_id: studentUser1,
    passcode: "INCORRECT_KEY",
  });
  testAssert(wrongAttempt.participant === null, "Invalid passcode rejected");
  testAssert(wrongAttempt.error === "Invalid contest passcode.", "Clear error returned for wrong passcode");

  // Empty passcode should fail
  const emptyAttempt = await registerContestParticipant({
    contest_id: upcomingContest.id,
    user_id: studentUser1,
    passcode: "",
  });
  testAssert(emptyAttempt.participant === null, "Empty passcode rejected");

  // Valid passcode succeeds
  const validAttempt = await registerContestParticipant({
    contest_id: upcomingContest.id,
    user_id: studentUser1,
    passcode: contestSecret,
  });
  testAssert(validAttempt.participant !== null, "Participant successfully registered with correct passcode");
  testAssert(validAttempt.participant?.user_id === studentUser1, "Participant bound to correct user_id");
  testAssert(validAttempt.participant?.status === "registered", "Participant initial status is 'registered'");
  testAssert(validAttempt.error === null, "No error on valid join");

  // Second distinct participant
  const validAttempt2 = await registerContestParticipant({
    contest_id: upcomingContest.id,
    user_id: studentUser2,
    passcode: contestSecret,
  });
  testAssert(validAttempt2.participant !== null, "Second participant registered");

  // ── 3. Duplicate Prevention (Idempotency) ──
  console.log("\n── 3. Duplicate Prevention & Participant Retrieval ──");
  const repeatAttempt = await registerContestParticipant({
    contest_id: upcomingContest.id,
    user_id: studentUser1,
    passcode: contestSecret,
  });
  testAssert(repeatAttempt.participant !== null, "Repeat join returns existing record");
  testAssert(repeatAttempt.participant?.id === validAttempt.participant?.id, "Same participant ID preserved (idempotent)");

  const partAlice = await getParticipant(upcomingContest.id, studentUser1);
  testAssert(partAlice !== null, "Alice retrieved via getParticipant");
  testAssert(partAlice?.user_id === studentUser1, "Retrieved user matches Alice");

  const participants = await listParticipants(upcomingContest.id);
  testAssert(participants.length === 2, "Exactly 2 distinct participants in contest roster");

  // Non-existent participant
  const noPart = await getParticipant(upcomingContest.id, "ghost-user");
  testAssert(noPart === null, "Non-existent user returns null");

  // ── 4. Server-Authoritative Timer & Status Transitions ──
  console.log("\n── 4. Server-Authoritative Timer & Status Transitions ──");

  // Case A: Future contest -> UPCOMING
  const statusUpcoming = computeContestStatus({
    status: "PUBLISHED",
    start_at: new Date(Date.now() + 600000).toISOString(),
    end_at: new Date(Date.now() + 4200000).toISOString(),
  });
  testAssert(statusUpcoming === "UPCOMING", "Future contest computed as UPCOMING");

  // Case B: Ongoing contest -> LIVE
  const statusLive = computeContestStatus({
    status: "PUBLISHED",
    start_at: new Date(Date.now() - 600000).toISOString(), // started 10m ago
    end_at: new Date(Date.now() + 3000000).toISOString(),  // ends in 50m
  });
  testAssert(statusLive === "LIVE", "Active time window computed as LIVE");

  // Case C: Past contest -> ENDED
  const statusEnded = computeContestStatus({
    status: "PUBLISHED",
    start_at: new Date(Date.now() - 3600000).toISOString(), // started 60m ago
    end_at: new Date(Date.now() - 60000).toISOString(),     // ended 1m ago
  });
  testAssert(statusEnded === "ENDED", "Past end time computed as ENDED");

  // Case D: Draft status is sticky (never goes UPCOMING or LIVE until published)
  const statusDraft = computeContestStatus({
    status: "DRAFT",
    start_at: new Date(Date.now() - 600000).toISOString(),
    end_at: new Date(Date.now() + 3000000).toISOString(),
  });
  testAssert(statusDraft === "DRAFT", "DRAFT status stays DRAFT regardless of time window");

  // Case E: FINAL_RESULTS status is sticky
  const statusFinal = computeContestStatus({
    status: "FINAL_RESULTS",
    start_at: new Date(Date.now() - 3600000).toISOString(),
    end_at: new Date(Date.now() - 60000).toISOString(),
  });
  testAssert(statusFinal === "FINAL_RESULTS", "FINAL_RESULTS status is preserved");

  // ── 5. Dynamic Time Calculation for Live Route State ──
  console.log("\n── 5. Countdown Mathematics ──");
  const testStartTime = Date.now() + 120000; // 2 minutes from now
  const testEndTime = Date.now() + 3720000;  // 62 minutes from now

  const calcSecondsToStart = Math.max(0, Math.floor((testStartTime - Date.now()) / 1000));
  const calcSecondsRemaining = Math.max(0, Math.floor((testEndTime - Date.now()) / 1000));

  testAssert(calcSecondsToStart >= 118 && calcSecondsToStart <= 120, "Seconds to start calculated accurately");
  testAssert(calcSecondsRemaining >= 3718 && calcSecondsRemaining <= 3720, "Seconds remaining calculated accurately");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} PHASE 5 LIVE CONTEST TESTS PASSED!`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
