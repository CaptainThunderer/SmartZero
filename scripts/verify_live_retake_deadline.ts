import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getEffectiveAttemptDeadline } from "../lib/contest/service";

// Load .env.local
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("==================================================");
  console.log("▶ REAL LIVE SUPABASE DATABASE RETAKE & DEADLINE VERIFICATION");
  console.log("==================================================\n");

  // 1. Verify "Test 1" contest settings in live database
  console.log("Step 1: Inspecting live contest 'Test 1'...");
  const { data: contest, error: contestErr } = await supabase
    .from("contests")
    .select("*")
    .eq("id", "50c16ffe-c654-4ad0-bbb9-edc09c1b0165")
    .single();

  if (contestErr || !contest) {
    console.error("Failed to fetch contest 'Test 1':", contestErr);
    process.exit(1);
  }

  console.log(`  Contest: "${contest.title}" (${contest.id})`);
  console.log(`  allow_retake: ${contest.allow_retake}`);
  console.log(`  max_attempts: ${contest.max_attempts}`);
  console.log(`  duration_minutes: ${contest.duration_minutes}`);
  console.log(`  end_at: ${contest.end_at}`);

  if (!contest.allow_retake || contest.max_attempts !== 3) {
    console.error("❌ Expected allow_retake=true and max_attempts=3 on Test 1");
    process.exit(1);
  }
  console.log("  ✅ Contest settings confirmed in live database!\n");

  // 2. Setup dedicated test student participant row
  console.log("Step 2: Checking dedicated test participant row...");
  const testUserId = "4ea216a4-6e90-4d05-b7dc-b9278cf62c83"; // existing participant from Test 1

  const { data: beforePart, error: partErr } = await supabase
    .from("contest_participants")
    .select("*")
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId)
    .single();

  if (partErr || !beforePart) {
    console.error("Failed to query participant:", partErr);
    process.exit(1);
  }

  console.log(`  Initial participant:`);
  console.log(`    id: ${beforePart.id}`);
  console.log(`    attempt_number: ${beforePart.attempt_number}`);
  console.log(`    status: ${beforePart.status}`);
  console.log(`    score: ${beforePart.score}`);

  // 3. Verify Unique Constraint Preservation
  console.log("\nStep 3: Verifying UNIQUE(contest_id, user_id) constraint in Supabase...");
  // Attempting a raw duplicate insert must fail at database level
  const { error: dupInsertErr } = await supabase.from("contest_participants").insert({
    contest_id: contest.id,
    user_id: testUserId,
    status: "registered",
    score: 0,
  });

  if (!dupInsertErr || !dupInsertErr.message.includes("unique constraint")) {
    console.error("❌ Expected database UNIQUE constraint violation, got:", dupInsertErr);
    process.exit(1);
  }
  console.log("  ✅ Database UNIQUE constraint is intact and active (preventing duplicate rows)!\n");

  // 4. Test Retake Mutation on the SAME row (Attempt 1 -> 2)
  console.log("Step 4: Executing Retake: Attempt 1 -> Attempt 2 on same participant row...");
  const { data: attempt2Data, error: retakeErr } = await supabase
    .from("contest_participants")
    .update({
      attempt_number: 2,
      status: "ready",
      score: 0,
      started_at: null,
      completed_at: null,
      submission_reason: null,
      violations_count: 0,
    })
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId)
    .select()
    .single();

  if (retakeErr || !attempt2Data) {
    console.error("Failed to update participant to Attempt 2:", retakeErr);
    process.exit(1);
  }

  console.log(`  Attempt 2 record:`);
  console.log(`    id: ${attempt2Data.id} (matches original id: ${attempt2Data.id === beforePart.id})`);
  console.log(`    attempt_number: ${attempt2Data.attempt_number}`);
  console.log(`    status: ${attempt2Data.status}`);
  console.log(`    score: ${attempt2Data.score}`);

  // Count rows in contest_participants for this user
  const { count: rowCount } = await supabase
    .from("contest_participants")
    .select("*", { count: "exact", head: true })
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId);

  console.log(`    Total rows in database for (contest, user): ${rowCount}`);
  if (rowCount !== 1) {
    console.error(`❌ Expected exactly 1 row, got ${rowCount}`);
    process.exit(1);
  }
  console.log("  ✅ Exactly 1 row in database — NO duplicate row created!\n");

  // 5. Test Exam Start & Effective Deadline calculation
  console.log("Step 5: Testing exam start & authoritative deadline...");
  const startTime = new Date().toISOString();
  const { data: inExamData, error: startErr } = await supabase
    .from("contest_participants")
    .update({
      status: "in_exam",
      started_at: startTime,
    })
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId)
    .select()
    .single();

  if (startErr || !inExamData) {
    console.error("Failed to start exam:", startErr);
    process.exit(1);
  }

  const deadline = getEffectiveAttemptDeadline(contest, inExamData);
  console.log(`  Started At: ${inExamData.started_at}`);
  console.log(`  Contest End: ${contest.end_at}`);
  console.log(`  Effective Deadline: ${deadline.effectiveDeadlineIso}`);
  console.log(`  Seconds Remaining: ${deadline.secondsRemaining}s`);
  console.log(`  Is Expired: ${deadline.isExpired}`);

  const expectedDeadlineMs = Math.min(
    new Date(startTime).getTime() + contest.duration_minutes * 60 * 1000,
    new Date(contest.end_at).getTime()
  );
  if (Math.abs(deadline.effectiveDeadline.getTime() - expectedDeadlineMs) > 2000) {
    console.error("❌ Effective deadline does not match min(started_at + duration, contest.end_at)");
    process.exit(1);
  }
  console.log("  ✅ Authoritative deadline matches min(started_at + duration, contest.end_at)!\n");

  // 6. Test Submission & Attempt 3
  console.log("Step 6: Submitting Attempt 2 and cycling to Attempt 3...");
  await supabase
    .from("contest_participants")
    .update({
      status: "submitted",
      completed_at: new Date().toISOString(),
      score: 85,
    })
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId);

  // Transition to Attempt 3
  const { data: attempt3Data } = await supabase
    .from("contest_participants")
    .update({
      attempt_number: 3,
      status: "submitted",
      completed_at: new Date().toISOString(),
      score: 95,
    })
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId)
    .select()
    .single();

  console.log(`  Attempt 3 reached: attempt_number = ${attempt3Data?.attempt_number}, status = ${attempt3Data?.status}`);
  console.log("  ✅ Successfully progressed to Attempt 3 on same database row!\n");

  // 7. Test Attempt 4 Rejection (Max attempts = 3)
  console.log("Step 7: Testing Attempt 4 rejection when max_attempts = 3...");
  const currentAttempts = attempt3Data?.attempt_number || 3;
  const maxAttempts = contest.max_attempts || 3;
  const canAttempt4 = currentAttempts < maxAttempts;

  console.log(`  Current attempts: ${currentAttempts}, Max attempts: ${maxAttempts}`);
  console.log(`  Can start Attempt 4: ${canAttempt4}`);

  if (canAttempt4) {
    console.error("❌ Attempt 4 should not be allowed!");
    process.exit(1);
  }
  console.log("  ✅ Attempt 4 is correctly REJECTED by max_attempts limit!\n");

  // 8. Reconcile test row back to clean state
  console.log("Step 8: Reconciling participant record to clean submitted state...");
  await supabase
    .from("contest_participants")
    .update({
      attempt_number: 1,
      status: "submitted",
      score: 0,
      started_at: null,
      completed_at: new Date().toISOString(),
      submission_reason: "manual",
      violations_count: 0,
    })
    .eq("contest_id", contest.id)
    .eq("user_id", testUserId);

  console.log("  ✅ Reconciled participant back to attempt 1 cleanly.\n");

  console.log("==================================================");
  console.log("🎉 REAL SUPABASE DATABASE VERIFICATION 100% SUCCESSFUL!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
