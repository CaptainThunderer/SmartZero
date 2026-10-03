/**
 * SmartZero 2.0 — Live Supabase Database Reconciliation Verification
 * Tests that all required columns, tables, RPCs, and RLS policies exist in the PostgREST schema cache.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Load .env.local if present
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function verifyLiveReconciliation() {
  console.log("==================================================");
  console.log("VERIFYING LIVE SUPABASE SCHEMA RECONCILIATION");
  console.log("Target Project URL:", url);
  console.log("==================================================");

  let hasErrors = false;

  // 1. Check public.contests columns
  console.log("\n── 1. Checking public.contests Schema Cache ──");
  const contestCols = [
    "id", "title", "slug", "passcode_hash", "created_by",
    "start_at", "end_at", "duration_minutes", "status",
    "instructions", "negative_marking", "default_negative_mark",
    "fullscreen_required", "auto_submit_on_violation", "max_violations",
    "allow_retake", "max_attempts", "anti_cheat_settings"
  ];

  for (const col of contestCols) {
    const { error } = await supabase.from("contests").select(col).limit(1);
    if (error) {
      console.log(`  ❌ contests.${col}: MISSING (${error.message})`);
      hasErrors = true;
    } else {
      console.log(`  ✅ contests.${col}: EXISTS IN SCHEMA CACHE`);
    }
  }

  // 2. Check public.contest_participants columns
  console.log("\n── 2. Checking public.contest_participants Schema Cache ──");
  const partCols = [
    "id", "contest_id", "user_id", "joined_at", "started_at",
    "completed_at", "status", "score", "attempt_number",
    "submission_reason", "violations_count", "auto_submitted"
  ];

  for (const col of partCols) {
    const { error } = await supabase.from("contest_participants").select(col).limit(1);
    if (error) {
      console.log(`  ❌ contest_participants.${col}: MISSING (${error.message})`);
      hasErrors = true;
    } else {
      console.log(`  ✅ contest_participants.${col}: EXISTS IN SCHEMA CACHE`);
    }
  }

  // 3. Check public.contest_admin_assignments table
  console.log("\n── 3. Checking public.contest_admin_assignments ──");
  const { error: adminErr } = await supabase.from("contest_admin_assignments").select("id").limit(1);
  if (adminErr) {
    console.log(`  ❌ contest_admin_assignments: MISSING (${adminErr.message})`);
    hasErrors = true;
  } else {
    console.log(`  ✅ contest_admin_assignments: EXISTS IN SCHEMA CACHE`);
  }

  // 4. Check RPC functions
  console.log("\n── 4. Checking Security Definer RPC Functions ──");
  const { error: canManageErr } = await supabase.rpc("can_manage_contest", {
    lookup_user_id: "00000000-0000-0000-0000-000000000000",
    check_contest_id: "00000000-0000-0000-0000-000000000000",
  });
  if (canManageErr && canManageErr.message.includes("Could not find the function")) {
    console.log(`  ❌ can_manage_contest RPC: MISSING (${canManageErr.message})`);
    hasErrors = true;
  } else {
    console.log(`  ✅ can_manage_contest RPC: EXISTS`);
  }

  const { error: getStudentErr } = await supabase.rpc("get_student_by_email", {
    p_email: "probe_nonexistent@smartzero.edu",
  });
  if (getStudentErr && getStudentErr.message.includes("Could not find the function")) {
    console.log(`  ❌ get_student_by_email RPC: MISSING (${getStudentErr.message})`);
    hasErrors = true;
  } else {
    console.log(`  ✅ get_student_by_email RPC: EXISTS`);
  }

  // 5. Strict RLS Privacy Check (Anonymous Enumeration Protection)
  console.log("\n── 5. Checking Strict RLS Privacy & Anti-Enumeration ──");
  const { data: anonProfiles, error: anonErr } = await supabase.from("profiles").select("id, email, full_name");
  if (anonProfiles && anonProfiles.length > 0) {
    console.log(`  ❌ SECURITY WARNING: Anonymous query returned ${anonProfiles.length} profiles! RLS is too permissive.`);
    hasErrors = true;
  } else {
    console.log(`  ✅ Anonymous profile enumeration blocked by strict RLS (0 rows leaked).`);
  }

  if (hasErrors) {
    console.log("\n==================================================");
    console.log("⚠️ SCHEMA RECONCILIATION PENDING MANUAL SQL EXECUTION");
    console.log("Execute 'supabase/migrations/20261003_reconcile_live_schema.sql' in the Supabase SQL Editor, then re-run.");
    console.log("==================================================");
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL LIVE RECONCILIATION CHECKS PASSED!");
  console.log("==================================================");
}

verifyLiveReconciliation().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
