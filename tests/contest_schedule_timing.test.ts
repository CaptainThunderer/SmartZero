import assert from "node:assert";
import {
  formatLocalDatetime,
  getCurrentLocalDatetime,
  addMinutesToLocalDatetime,
  localDatetimeToIso,
  validateContestSchedule,
} from "../lib/utils/dateTime";
import { computeContestStatus, createContest } from "../lib/contest/service";
import {
  getServerSecret,
  createStudentSessionToken,
  verifyStudentSessionToken,
} from "../lib/auth/studentSession";

console.log("==================================================");
console.log("▶ RUNNING CONTEST TIMING & PRODUCTION SECRET TESTS");
console.log("==================================================");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}:`, err);
    process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────
// PART A: CONTEST DATE/TIME DEFAULTS & TIMING RECALCULATION
// ────────────────────────────────────────────────────────────

test("1. Create Contest form uses current date", () => {
  const current = getCurrentLocalDatetime();
  const today = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const expectedDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  assert.ok(current.startsWith(expectedDate), `Expected current date ${expectedDate}, got ${current}`);
});

test("2. Start Time is never hardcoded to historical date (e.g. 2026-10-02)", () => {
  const current = getCurrentLocalDatetime();
  assert.ok(!current.includes("2026-10-02"), "Start time must not be hardcoded to 2026-10-02");
});

test("3. Start Time defaults to current local instant", () => {
  const now = new Date();
  const formatted = formatLocalDatetime(now);
  const current = getCurrentLocalDatetime();
  assert.strictEqual(current.slice(0, 15), formatted.slice(0, 15));
});

test("4. Duration automatically calculates End Time (Start + Duration)", () => {
  const start = "2026-10-03T07:00";
  const duration = 60;
  const end = addMinutesToLocalDatetime(start, duration);
  assert.strictEqual(end, "2026-10-03T08:00");
});

test("5. Changing Duration updates End Time when automatic", () => {
  const start = "2026-10-03T07:00";
  const end45 = addMinutesToLocalDatetime(start, 45);
  const end120 = addMinutesToLocalDatetime(start, 120);
  assert.strictEqual(end45, "2026-10-03T07:45");
  assert.strictEqual(end120, "2026-10-03T09:00");
});

test("6. Changing Start Time recalculates End Time based on duration", () => {
  const duration = 90;
  const start1 = "2026-10-03T10:00";
  const end1 = addMinutesToLocalDatetime(start1, duration);
  assert.strictEqual(end1, "2026-10-03T11:30");

  const start2 = "2026-10-03T14:15";
  const end2 = addMinutesToLocalDatetime(start2, duration);
  assert.strictEqual(end2, "2026-10-03T15:45");
});

test("7. Date rollover works correctly across midnight (11:45 PM + 60m -> 12:45 AM)", () => {
  const start = "2026-10-03T23:45";
  const duration = 60;
  const end = addMinutesToLocalDatetime(start, duration);
  assert.strictEqual(end, "2026-10-04T00:45");
});

test("8. Month rollover works correctly (Oct 31 11:30 PM + 60m -> Nov 1 12:30 AM)", () => {
  const start = "2026-10-31T23:30";
  const duration = 60;
  const end = addMinutesToLocalDatetime(start, duration);
  assert.strictEqual(end, "2026-11-01T00:30");
});

test("9. Year rollover works correctly (Dec 31 11:30 PM + 60m -> Jan 1 12:30 AM)", () => {
  const start = "2026-12-31T23:30";
  const duration = 60;
  const end = addMinutesToLocalDatetime(start, duration);
  assert.strictEqual(end, "2027-01-01T00:30");
});

test("10. Local datetime converts to unambiguous UTC ISO-8601 timestamptz", () => {
  const localStr = "2026-10-03T07:00";
  const iso = localDatetimeToIso(localStr);
  assert.ok(iso.endsWith("Z") || iso.includes("+00:00"));
  const parsed = new Date(iso);
  assert.ok(!isNaN(parsed.getTime()));
});

test("11. No UTC/IST off-by-one-day bug during morning or evening hours", () => {
  // Simulate 1:00 AM IST on Oct 3 (which in UTC is 7:30 PM on Oct 2)
  const istDate = new Date(2026, 9, 3, 1, 0, 0); // Oct 3 01:00 AM local
  const formatted = formatLocalDatetime(istDate);
  assert.ok(formatted.startsWith("2026-10-03T01:00"), `Expected 2026-10-03, got ${formatted}`);
});

test("12. Server validation rejects invalid schedules (end <= start or duration <= 0)", () => {
  const invalid1 = validateContestSchedule("2026-10-03T08:00", "2026-10-03T07:00", 60);
  assert.strictEqual(invalid1.valid, false);

  const invalid2 = validateContestSchedule("2026-10-03T08:00", "2026-10-03T09:00", 0);
  assert.strictEqual(invalid2.valid, false);

  const valid = validateContestSchedule("2026-10-03T07:00", "2026-10-03T08:00", 60);
  assert.strictEqual(valid.valid, true);
});

test("13. Server contest lifecycle engine computes status authoritatively", () => {
  const now = Date.now();
  const pastStart = new Date(now - 3600000).toISOString();
  const futureEnd = new Date(now + 3600000).toISOString();
  const pastEnd = new Date(now - 1800000).toISOString();
  const futureStart = new Date(now + 1800000).toISOString();

  // Upcoming
  const upcomingStatus = computeContestStatus({
    status: "PUBLISHED",
    start_at: futureStart,
    end_at: futureEnd,
  });
  assert.strictEqual(upcomingStatus, "UPCOMING");

  // Live
  const liveStatus = computeContestStatus({
    status: "PUBLISHED",
    start_at: pastStart,
    end_at: futureEnd,
  });
  assert.strictEqual(liveStatus, "LIVE");

  // Ended
  const endedStatus = computeContestStatus({
    status: "PUBLISHED",
    start_at: pastStart,
    end_at: pastEnd,
  });
  assert.strictEqual(endedStatus, "ENDED");
});

test("14. Contest creation persists hardening parameters (allow_retake, max_attempts, fullscreen)", async () => {
  const created = await createContest({
    title: "Practice 1 Timing Test",
    passcode: "PRACTICE-1",
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
    allow_retake: true,
    max_attempts: 3,
    fullscreen_required: true,
    auto_submit_on_violation: true,
    max_violations: 2,
  });

  assert.strictEqual(created.allow_retake, true);
  assert.strictEqual(created.max_attempts, 3);
  assert.strictEqual(created.fullscreen_required, true);
  assert.strictEqual(created.auto_submit_on_violation, true);
  assert.strictEqual(created.max_violations, 2);
});

// ────────────────────────────────────────────────────────────
// PART B: STUDENT SESSION SECRET PRODUCTION POLICY
// ────────────────────────────────────────────────────────────

test("15. Production mode: missing SMARTZERO_SESSION_SECRET is strictly rejected (fails closed)", () => {
  const envObj = process.env as Record<string, string | undefined>;
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SMARTZERO_SESSION_SECRET;
  const prevStudentSecret = process.env.STUDENT_SESSION_SECRET;

  try {
    envObj.NODE_ENV = "production";
    delete process.env.SMARTZERO_SESSION_SECRET;
    delete process.env.STUDENT_SESSION_SECRET;

    assert.throws(
      () => {
        getServerSecret();
      },
      /CRITICAL CONFIGURATION ERROR: SMARTZERO_SESSION_SECRET is required in production/
    );

    assert.throws(
      () => {
        createStudentSessionToken({
          sub: "user-123",
          email: "test@smartzero.edu",
        });
      },
      /CRITICAL CONFIGURATION ERROR/
    );
  } finally {
    envObj.NODE_ENV = prevEnv;
    if (prevSecret) process.env.SMARTZERO_SESSION_SECRET = prevSecret;
    if (prevStudentSecret) process.env.STUDENT_SESSION_SECRET = prevStudentSecret;
  }
});

test("16. Production mode: weak SMARTZERO_SESSION_SECRET (< 32 chars) is strictly rejected", () => {
  const envObj = process.env as Record<string, string | undefined>;
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SMARTZERO_SESSION_SECRET;

  try {
    envObj.NODE_ENV = "production";
    process.env.SMARTZERO_SESSION_SECRET = "too-short-secret";

    assert.throws(
      () => {
        getServerSecret();
      },
      /must be at least 32 characters in production/
    );
  } finally {
    envObj.NODE_ENV = prevEnv;
    if (prevSecret) process.env.SMARTZERO_SESSION_SECRET = prevSecret;
    else delete process.env.SMARTZERO_SESSION_SECRET;
  }
});

test("17. Production mode: valid SMARTZERO_SESSION_SECRET (>= 32 chars) succeeds", () => {
  const envObj = process.env as Record<string, string | undefined>;
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.SMARTZERO_SESSION_SECRET;

  try {
    envObj.NODE_ENV = "production";
    process.env.SMARTZERO_SESSION_SECRET = "production-super-secure-session-signing-secret-256bit-ok";

    const secret = getServerSecret();
    assert.strictEqual(secret.length >= 32, true);

    const token = createStudentSessionToken({
      sub: "prod-student-uuid",
      email: "prod@smartzero.edu",
    });
    assert.ok(token && token.split(".").length === 3);

    const verified = verifyStudentSessionToken(token);
    assert.ok(verified !== null);
    assert.strictEqual(verified.sub, "prod-student-uuid");
  } finally {
    envObj.NODE_ENV = prevEnv;
    if (prevSecret) process.env.SMARTZERO_SESSION_SECRET = prevSecret;
    else delete process.env.SMARTZERO_SESSION_SECRET;
  }
});

test("18. SMARTZERO_SESSION_SECRET is server-only (not prefixed with NEXT_PUBLIC_)", () => {
  assert.ok(!("NEXT_PUBLIC_SMARTZERO_SESSION_SECRET" in process.env));
  assert.ok(!("NEXT_PUBLIC_STUDENT_SESSION_SECRET" in process.env));
});

console.log("\n==================================================");
console.log("🎉 ALL 18 CONTEST TIMING & PRODUCTION SECRET TESTS PASSED!");
console.log("==================================================");
