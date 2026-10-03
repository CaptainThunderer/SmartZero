/**
 * SMARTZERO 2.0 — REAL DATABASE INTEGRATION & RBAC PERSISTENCE VERIFICATION
 *
 * Directly tests live Supabase PostgreSQL (mrgbigbqdsunhplviipe):
 * 1. Verifies primary super admin phaneendhra2508@gmail.com has role = super_admin, is_admin = true, is_super_admin = true
 * 2. Dedicated test student lifecycle in public.profiles & public.user_roles
 * 3. Actual live public.user_roles rows queried before mutation, after promotion, and after demotion
 * 4. Verifies public.contest_admin_assignments persistence on promotion and cleanup on demotion
 * 5. Authorization testing across assigned vs unassigned contests
 * 6. Fail-closed: Never accepts memory fallback when verifying live database persistence
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { updateUserRoleAndStatus } from "../lib/auth/roleService";
import { canUserManageContest, createContest } from "../lib/contest/service";

// Load .env.local
let url = "";
let anonKey = "";
let serviceKey = "";

if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (k === "NEXT_PUBLIC_SUPABASE_URL") url = v;
      if (k === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" || k === "NEXT_PUBLIC_SUPABASE_ANON_KEY") anonKey = v;
      if (k === "SUPABASE_SERVICE_ROLE_KEY") serviceKey = v;
    }
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && url) process.env.NEXT_PUBLIC_SUPABASE_URL = url;
if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && anonKey) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && serviceKey) process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

if (!url || !serviceKey) {
  console.error("FATAL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Authoritative client using service role key (bypasses RLS to inspect ground truth)
const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
// Public client using publishable/anon key
const publicClient = createClient(url, anonKey);

async function runRealDatabaseVerification() {
  console.log("==================================================");
  console.log("REAL SUPABASE DATABASE RBAC INTEGRATION AUDIT");
  console.log("Target Database URL:", url);
  console.log("Service Role Key Configured:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  console.log("==================================================\n");

  const results: Record<string, "PASS" | "FAIL"> = {};

  // ── 1. Verify Primary Super Admin in Database ──
  console.log("── REQUIREMENT 1: Primary Super Admin State Verification ──");
  const primaryAdminEmail = "phaneendhra2508@gmail.com";
  const { data: primaryProfile, error: pErr } = await adminClient
    .from("profiles")
    .select("id, email, full_name, display_name, account_status")
    .ilike("email", primaryAdminEmail)
    .single();

  if (pErr || !primaryProfile) {
    console.error("Failed to fetch primary admin profile:", pErr);
    results["primary super_admin profile in database"] = "FAIL";
    process.exit(1);
  }

  const primaryUserId = primaryProfile.id;
  const { data: primaryRoleRow, error: prErr } = await adminClient
    .from("user_roles")
    .select("*")
    .eq("user_id", primaryUserId)
    .single();

  const { data: isAdminRpc } = await adminClient.rpc("is_admin", { lookup_user_id: primaryUserId });
  const { data: isSuperAdminRpc } = await adminClient.rpc("is_super_admin", { lookup_user_id: primaryUserId });

  console.log("Primary Super Admin DB Profile:", primaryProfile);
  console.log("Primary Super Admin DB user_roles Row:", primaryRoleRow);
  console.log(`RPC is_admin('${primaryUserId}'):`, isAdminRpc);
  console.log(`RPC is_super_admin('${primaryUserId}'):`, isSuperAdminRpc);

  const req1Pass =
    primaryRoleRow?.role === "super_admin" &&
    isAdminRpc === true &&
    isSuperAdminRpc === true;

  results["primary super_admin database role consistency (role = super_admin, is_admin = true, is_super_admin = true)"] =
    req1Pass ? "PASS" : "FAIL";

  if (!req1Pass) {
    console.error("REQUIREMENT 1 FAILED: Primary admin role is not super_admin or RPCs failed.");
    process.exit(1);
  }

  // ── 2. Dedicated Test Student Account ──
  console.log("\n── REQUIREMENT 2: Dedicated Test Student Setup ──");
  const testStudentEmail = "test_student_rbac_verify@smartzero.edu";

  // Ensure student exists via register_student RPC
  await publicClient.rpc("register_student", {
    p_full_name: "RBAC Verification Student",
    p_email: testStudentEmail,
    p_student_id: "STU-RBAC-01",
    p_college: "SmartZero Institute",
  });

  const { data: studentProfile, error: spErr } = await adminClient
    .from("profiles")
    .select("*")
    .ilike("email", testStudentEmail)
    .single();

  if (spErr || !studentProfile) {
    console.error("Failed to locate test student profile:", spErr);
    process.exit(1);
  }

  const testUserId = studentProfile.id;
  console.log("Dedicated test student profile:", {
    id: studentProfile.id,
    email: studentProfile.email,
    full_name: studentProfile.full_name,
    account_status: studentProfile.account_status,
  });

  // Reset to student if previously modified
  await adminClient.from("user_roles").upsert({
    user_id: testUserId,
    role: "student",
    created_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  await adminClient.from("contest_admin_assignments").delete().eq("admin_id", testUserId);

  // ── 3. Query Actual Live public.user_roles Row Before Mutation ──
  console.log("\n── REQUIREMENT 3: Pre-Mutation Live Database Query ──");
  const { data: preRoleRow, error: preErr } = await adminClient
    .from("user_roles")
    .select("user_id, role, created_at")
    .eq("user_id", testUserId)
    .single();

  const { data: preAssignments } = await adminClient
    .from("contest_admin_assignments")
    .select("*")
    .eq("admin_id", testUserId);

  console.log("ACTUAL LIVE public.user_roles (BEFORE):", preRoleRow);
  console.log("ACTUAL LIVE public.contest_admin_assignments (BEFORE):", preAssignments);

  results["pre-mutation user_roles is student"] = preRoleRow?.role === "student" ? "PASS" : "FAIL";

  // Create real test contests for scoping
  const contestAssigned = await createContest({
    title: "RBAC Assigned Contest Alpha",
    start_at: new Date(Date.now() + 3600_000).toISOString(),
    end_at: new Date(Date.now() + 7200_000).toISOString(),
    duration_minutes: 60,
    passcode: "ALPHA",
  });

  const contestUnassigned = await createContest({
    title: "RBAC Unassigned Contest Beta",
    start_at: new Date(Date.now() + 3600_000).toISOString(),
    end_at: new Date(Date.now() + 7200_000).toISOString(),
    duration_minutes: 60,
    passcode: "BETA",
  });

  // ── 4 & 5. Promote Student -> Contest Admin via Production API / Service Path ──
  console.log("\n── REQUIREMENT 4 & 5: Role Promotion via Production Service Path ──");
  const promotionRes = await updateUserRoleAndStatus({
    callerUserId: primaryUserId,
    callerRole: "super_admin",
    targetUserId: testUserId,
    newRole: "contest_admin",
    contestIds: [contestAssigned.id],
  });

  console.log("Production Service Promotion Response:", promotionRes);
  results["API role mutation (promotion)"] = promotionRes.success && promotionRes.status === 200 ? "PASS" : "FAIL";

  // ── 6. Query Actual Live public.user_roles Row AFTER Promotion ──
  console.log("\n── REQUIREMENT 6: Post-Promotion Live public.user_roles Query ──");
  const { data: postPromoRoleRow, error: promoDbErr } = await adminClient
    .from("user_roles")
    .select("user_id, role, created_at")
    .eq("user_id", testUserId)
    .single();

  console.log("ACTUAL LIVE public.user_roles (AFTER PROMOTION):", postPromoRoleRow);
  if (promoDbErr) console.error("Database query error:", promoDbErr);

  const promoDbPass = postPromoRoleRow?.role === "contest_admin";
  results["REAL Supabase user_roles mutation (role = contest_admin)"] = promoDbPass ? "PASS" : "FAIL";

  // ── 7. Verify Contest Admin Assignment Persistence in public.contest_admin_assignments ──
  console.log("\n── REQUIREMENT 7: Contest Admin Assignment Persistence ──");
  const { data: promoAssignments, error: assignDbErr } = await adminClient
    .from("contest_admin_assignments")
    .select("*")
    .eq("admin_id", testUserId);

  console.log("ACTUAL LIVE public.contest_admin_assignments (AFTER PROMOTION):", promoAssignments);
  if (assignDbErr) console.error("Database assignments error:", assignDbErr);

  const hasAssignmentInDb = promoAssignments?.some((a) => a.contest_id === contestAssigned.id);
  results["contest_admin assignment persistence"] = hasAssignmentInDb ? "PASS" : "FAIL";

  // ── 8 & 9. Verify Scoped Authorization ──
  console.log("\n── REQUIREMENT 8 & 9: Scoped Authorization Verification ──");
  const canManageAssigned = await canUserManageContest({
    contest_id: contestAssigned.id,
    user_id: testUserId,
    user_role: "contest_admin",
  });
  console.log(`canUserManageContest (Assigned Contest Alpha - ${contestAssigned.id}):`, canManageAssigned);
  results["authorization after promotion (assigned contest allowed)"] = canManageAssigned === true ? "PASS" : "FAIL";

  const canManageUnassigned = await canUserManageContest({
    contest_id: contestUnassigned.id,
    user_id: testUserId,
    user_role: "contest_admin",
  });
  console.log(`canUserManageContest (Unassigned Contest Beta - ${contestUnassigned.id}):`, canManageUnassigned);
  results["authorization after promotion (unassigned contest rejected)"] = canManageUnassigned === false ? "PASS" : "FAIL";

  // ── 10. Demote: contest_admin -> student ──
  console.log("\n── REQUIREMENT 10: Role Demotion via Production Service Path ──");
  const demotionRes = await updateUserRoleAndStatus({
    callerUserId: primaryUserId,
    callerRole: "super_admin",
    targetUserId: testUserId,
    newRole: "student",
  });

  console.log("Production Service Demotion Response:", demotionRes);
  results["API role mutation (demotion)"] = demotionRes.success && demotionRes.status === 200 ? "PASS" : "FAIL";

  // ── 11. Query Actual Live public.user_roles Row AFTER Demotion ──
  console.log("\n── REQUIREMENT 11: Post-Demotion Live public.user_roles Query ──");
  const { data: postDemoteRoleRow, error: demoteDbErr } = await adminClient
    .from("user_roles")
    .select("user_id, role, created_at")
    .eq("user_id", testUserId)
    .single();

  console.log("ACTUAL LIVE public.user_roles (AFTER DEMOTION):", postDemoteRoleRow);
  if (demoteDbErr) console.error("Database query error:", demoteDbErr);

  const demoteDbPass = postDemoteRoleRow?.role === "student";
  results["REAL Supabase user_roles demotion (role = student)"] = demoteDbPass ? "PASS" : "FAIL";

  // ── 12. Verify contest_admin_assignments Are Cleared ──
  console.log("\n── REQUIREMENT 12: Contest Admin Assignment Cleanup ──");
  const { data: postDemoteAssignments, error: clearDbErr } = await adminClient
    .from("contest_admin_assignments")
    .select("*")
    .eq("admin_id", testUserId);

  console.log("ACTUAL LIVE public.contest_admin_assignments (AFTER DEMOTION):", postDemoteAssignments);
  if (clearDbErr) console.error("Database cleanup check error:", clearDbErr);

  const assignmentsCleared = Array.isArray(postDemoteAssignments) && postDemoteAssignments.length === 0;
  results["demotion cleanup (assignments cleared in DB)"] = assignmentsCleared ? "PASS" : "FAIL";

  // ── 13. Verify Contest Management Access is Rejected After Demotion ──
  console.log("\n── REQUIREMENT 13: Access Rejection After Demotion ──");
  const canManageAfterDemote = await canUserManageContest({
    contest_id: contestAssigned.id,
    user_id: testUserId,
    user_role: "student",
  });
  console.log(`canUserManageContest after demotion (Assigned Contest Alpha):`, canManageAfterDemote);
  results["authorization after demotion (management access rejected)"] = canManageAfterDemote === false ? "PASS" : "FAIL";

  // ── Report Before / After Summary ──
  console.log("\n==================================================");
  console.log("ACTUAL OBSERVED DATABASE VALUES SUMMARY");
  console.log("==================================================");
  console.log("TARGET TEST USER:", testStudentEmail, `(${testUserId})`);
  console.log(`BEFORE MUTATION:`);
  console.log(`  user_roles.role = ${preRoleRow?.role}`);
  console.log(`  contest_admin_assignments = ${preAssignments?.length} rows`);
  console.log(`AFTER PROMOTION:`);
  console.log(`  user_roles.role = ${postPromoRoleRow?.role}`);
  console.log(`  contest_admin_assignments = ${JSON.stringify(promoAssignments?.map(a => a.contest_id))}`);
  console.log(`AFTER DEMOTION:`);
  console.log(`  user_roles.role = ${postDemoteRoleRow?.role}`);
  console.log(`  contest_admin_assignments = ${postDemoteAssignments?.length} rows`);
  console.log("==================================================\n");

  // ── Final Verification Table ──
  console.log("==================================================");
  console.log("FINAL INTEGRATION AUDIT SCORECARD");
  console.log("==================================================");
  let allPassed = true;
  for (const [check, status] of Object.entries(results)) {
    console.log(`  ${status === "PASS" ? "✅" : "❌"} ${check}: ${status}`);
    if (status !== "PASS") allPassed = false;
  }
  console.log("==================================================");

  if (!allPassed) {
    console.error("FAIL: One or more real database integration checks failed.");
    process.exit(1);
  }

  console.log("🎉 ALL REAL DATABASE INTEGRATION REQUIREMENTS VERIFIED & PASSED!");
}

runRealDatabaseVerification().catch((err) => {
  console.error("Fatal verification execution error:", err);
  process.exit(1);
});
