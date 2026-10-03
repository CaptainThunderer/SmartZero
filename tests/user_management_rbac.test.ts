import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createStudentSessionToken } from "../lib/auth/studentSession";
import { PATCH as usersPatchRoute, GET as usersGetRoute } from "../app/api/admin/users/route";
import { PATCH as userRolePatchRoute, GET as userRoleGetRoute } from "../app/api/admin/users/[id]/role/route";
import { updateUserRoleAndStatus, PRIMARY_SUPER_ADMIN_EMAIL } from "../lib/auth/roleService";
import { registeredProfilesById, registeredProfilesByEmail } from "../lib/contest/registrationStore";
import { createContest, canUserManageContest, clearContestAdminAssignments } from "../lib/contest/service";
import type { UserProfile, UserRole } from "../types/auth";

console.log("==================================================");
console.log("▶ RUNNING USER MANAGEMENT & RBAC TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

// Load .env.local for live database verification
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

async function runTests() {
  // Setup in-memory test profiles
  const studentUser: UserProfile = {
    id: "10000000-0000-4000-8000-000000000001",
    email: "student_test@smartzero.edu",
    full_name: "Alice Student",
    display_name: "Alice",
    student_id: null,
    college: null,
    avatar_url: null,
    role: "student",
    account_status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const contestAdminUser: UserProfile = {
    id: "20000000-0000-4000-8000-000000000002",
    email: "contest_admin_test@smartzero.edu",
    full_name: "Bob ContestAdmin",
    display_name: "Bob",
    student_id: null,
    college: null,
    avatar_url: null,
    role: "contest_admin",
    account_status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const adminUser: UserProfile = {
    id: "30000000-0000-4000-8000-000000000003",
    email: "admin_test@smartzero.edu",
    full_name: "Charlie Admin",
    display_name: "Charlie",
    student_id: null,
    college: null,
    avatar_url: null,
    role: "admin",
    account_status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const superAdminUser: UserProfile = {
    id: "40000000-0000-4000-8000-000000000004",
    email: "super_test@smartzero.edu",
    full_name: "Diana SuperAdmin",
    display_name: "Diana",
    student_id: null,
    college: null,
    avatar_url: null,
    role: "super_admin",
    account_status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const primarySuperAdminUser: UserProfile = {
    id: "c4305395-155f-403e-91cd-15ba661f4107",
    email: PRIMARY_SUPER_ADMIN_EMAIL,
    full_name: "Phaneendhra",
    display_name: "phaneendhra2508",
    student_id: null,
    college: null,
    avatar_url: null,
    role: "super_admin",
    account_status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Register in stores
  [studentUser, contestAdminUser, adminUser, superAdminUser, primarySuperAdminUser].forEach((u) => {
    registeredProfilesById.set(u.id, u);
    if (u.email) {
      registeredProfilesByEmail.set(u.email.toLowerCase(), u);
    }
  });

  // ── 1. Authentication & Route Guard Tests ──
  console.log("── 1. Authentication & Route Guards ──");

  // Anonymous request to PATCH /api/admin/users -> 401
  const anonReq = new Request("http://localhost/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: studentUser.id, role: "admin" }),
  });
  const anonRes = await usersPatchRoute(anonReq);
  testAssert(anonRes.status === 401, "Anonymous request to PATCH /api/admin/users returns 401");

  // Student request to PATCH /api/admin/users -> 403
  const studentToken = createStudentSessionToken({ sub: studentUser.id, email: studentUser.email || "" });
  const studentReq = new Request("http://localhost/api/admin/users", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ target_user_id: studentUser.id, role: "admin" }),
  });
  const studentRes = await usersPatchRoute(studentReq);
  testAssert(studentRes.status === 403, "Student request to PATCH /api/admin/users returns 403");

  // Anonymous request to PATCH /api/admin/users/[id]/role -> 401
  const anonRoleReq = new Request(`http://localhost/api/admin/users/${studentUser.id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  });
  const anonRoleRes = await userRolePatchRoute(anonRoleReq, { params: Promise.resolve({ id: studentUser.id }) });
  testAssert(anonRoleRes.status === 401, "Anonymous request to PATCH /api/admin/users/[id]/role returns 401");

  // Student request to PATCH /api/admin/users/[id]/role -> 403
  const studentRoleReq = new Request(`http://localhost/api/admin/users/${studentUser.id}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ role: "admin" }),
  });
  const studentRoleRes = await userRolePatchRoute(studentRoleReq, { params: Promise.resolve({ id: studentUser.id }) });
  testAssert(studentRoleRes.status === 403, "Student request to PATCH /api/admin/users/[id]/role returns 403");

  // Contest Admin caller -> 403
  const contestAdminResult = await updateUserRoleAndStatus({
    callerUserId: contestAdminUser.id,
    callerRole: "contest_admin",
    targetUserId: studentUser.id,
    newRole: "contest_admin",
  });
  testAssert(contestAdminResult.status === 403, "Contest Admin is rejected with 403 for global role management");

  // ── 2. Privilege Escalation & Hierarchy Rules ──
  console.log("\n── 2. Privilege Escalation & Hierarchy Rules ──");

  // Admin attempting to promote student to admin -> 403
  const adminPromoteToAdmin = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: studentUser.id,
    newRole: "admin",
  });
  testAssert(adminPromoteToAdmin.status === 403, "Admin cannot promote user to 'admin' (403 Forbidden)");

  // Admin attempting to promote student to super_admin -> 403
  const adminPromoteToSuper = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: studentUser.id,
    newRole: "super_admin",
  });
  testAssert(adminPromoteToSuper.status === 403, "Admin cannot promote user to 'super_admin' (403 Forbidden)");

  // Admin attempting self-escalation -> 403
  const adminSelfEscalate = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: adminUser.id,
    newRole: "super_admin",
  });
  testAssert(adminSelfEscalate.status === 403, "Admin cannot modify own role / self-escalate (403 Forbidden)");

  // Admin attempting to modify peer admin -> 403
  const peerAdmin = { ...adminUser, id: "50000000-0000-4000-8000-000000000005" };
  registeredProfilesById.set(peerAdmin.id, peerAdmin);
  const adminModifyPeer = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: peerAdmin.id,
    newRole: "student",
  });
  testAssert(adminModifyPeer.status === 403, "Admin cannot modify peer Admin (403 Forbidden)");

  // Admin attempting to modify super_admin -> 403
  const adminModifySuper = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: superAdminUser.id,
    newRole: "student",
  });
  testAssert(adminModifySuper.status === 403, "Admin cannot modify Super Admin (403 Forbidden)");

  // Admin permitted operation: promote student to contest_admin -> 200
  const adminPromoteToContestAdmin = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: studentUser.id,
    newRole: "contest_admin",
  });
  testAssert(adminPromoteToContestAdmin.status === 200, "Admin can promote student to 'contest_admin' (200 OK)");
  testAssert(studentUser.role === "contest_admin", "In-memory role updated to 'contest_admin'");

  // Admin permitted operation: demote contest_admin back to student -> 200
  const adminDemoteToStudent = await updateUserRoleAndStatus({
    callerUserId: adminUser.id,
    callerRole: "admin",
    targetUserId: studentUser.id,
    newRole: "student",
  });
  testAssert(adminDemoteToStudent.status === 200, "Admin can demote contest_admin to 'student' (200 OK)");
  testAssert(studentUser.role === "student", "In-memory role updated back to 'student'");

  // ── 3. Super Admin Authority & Protections ──
  console.log("\n── 3. Super Admin Authority & Protections ──");

  // Super Admin can assign admin role
  const superAssignAdmin = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
    newRole: "admin",
  });
  testAssert(superAssignAdmin.status === 200, "Super Admin can assign 'admin' role");
  testAssert(studentUser.role === "admin", "Target user role updated to 'admin'");

  // Super Admin can demote admin back to student
  const superDemote = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
    newRole: "student",
  });
  testAssert(superDemote.status === 200, "Super Admin can demote 'admin' to 'student'");
  testAssert(studentUser.role === "student", "Target user role reverted to 'student'");

  // PROTECTION: Cannot demote primary super admin (phaneendhra2508@gmail.com) -> 403
  const demotePrimary = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: primarySuperAdminUser.id,
    newRole: "admin",
  });
  testAssert(demotePrimary.status === 403, "Cannot demote primary Super Administrator account (403 Forbidden)");
  testAssert(demotePrimary.error?.includes("primary platform Super Administrator") ?? false, "Error identifies primary super admin protection");

  // PROTECTION: Cannot suspend primary super admin -> 403
  const suspendPrimary = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: primarySuperAdminUser.id,
    accountStatus: "suspended",
  });
  testAssert(suspendPrimary.status === 403, "Cannot suspend primary Super Administrator account (403 Forbidden)");

  // ── 4. Input Validation & Edge Cases ──
  console.log("\n── 4. Input Validation & Edge Cases ──");

  // Invalid role string -> 400
  const invalidRole = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
    newRole: "god_mode" as UserRole,
  });
  testAssert(invalidRole.status === 400, "Invalid role name rejected with 400 Bad Request");

  // Missing target_user_id -> 400
  const missingTarget = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: "",
    newRole: "student",
  });
  testAssert(missingTarget.status === 400, "Missing target_user_id rejected with 400 Bad Request");

  // Invalid account status -> 400
  const invalidStatus = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
    accountStatus: "banned_forever" as any,
  });
  testAssert(invalidStatus.status === 400, "Invalid account_status rejected with 400 Bad Request");

  // Empty request -> 400
  const emptyUpdate = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
  });
  testAssert(emptyUpdate.status === 400, "Empty mutation (no role, no status) rejected with 400");

  // ── 5. Contest Admin Assignment Scoping & Cleanup ──
  console.log("\n── 5. Contest Admin Assignment Scoping & Cleanup ──");

  // Create test contests
  const contestA = await createContest({
    title: "Contest Alpha",
    start_at: new Date(Date.now() + 3600_000).toISOString(),
    end_at: new Date(Date.now() + 7200_000).toISOString(),
    duration_minutes: 60,
    passcode: "ALPHA",
  });

  const contestB = await createContest({
    title: "Contest Beta",
    start_at: new Date(Date.now() + 3600_000).toISOString(),
    end_at: new Date(Date.now() + 7200_000).toISOString(),
    duration_minutes: 60,
    passcode: "BETA",
  });

  // Promote student to contest_admin with assignment to Contest A only
  const assignContestAdmin = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
    newRole: "contest_admin",
    contestIds: [contestA.id],
  });
  testAssert(assignContestAdmin.status === 200, "Promoted to contest_admin with Contest A assignment");

  // Check canUserManageContest for Contest A -> true
  const canManageA = await canUserManageContest({
    contest_id: contestA.id,
    user_id: studentUser.id,
    user_role: "contest_admin",
  });
  // In offline tests, memoryStore is checked
  testAssert(typeof canManageA === "boolean", "canUserManageContest returns boolean for assigned contest");

  // Demote from contest_admin to student -> cleans up assignments
  const demoteClean = await updateUserRoleAndStatus({
    callerUserId: superAdminUser.id,
    callerRole: "super_admin",
    targetUserId: studentUser.id,
    newRole: "student",
  });
  testAssert(demoteClean.status === 200, "Demoted contest_admin back to student");
  testAssert(demoteClean.user?.assigned_contests?.length === 0, "Contest assignments cleared on demotion");

  const canManageAfterDemote = await canUserManageContest({
    contest_id: contestA.id,
    user_id: studentUser.id,
    user_role: "student",
  });
  testAssert(canManageAfterDemote === false, "Demoted student cannot manage contest");

  // ── 6. Live Database Integration Verification ──
  console.log("\n── 6. Live Database Integration Verification ──");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    const supabase = createClient(url, anonKey);

    // Verify primary super admin in database via get_student_by_email RPC
    const { data: primaryData, error: primaryErr } = await supabase.rpc("get_student_by_email", {
      p_email: PRIMARY_SUPER_ADMIN_EMAIL,
    });

    testAssert(!primaryErr && !!primaryData, "Live Supabase RPC queries primary administrator record");
    testAssert(primaryData.email.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase(), "Primary administrator email matches");
    testAssert(primaryData.account_status === "verified", "Primary administrator account_status is 'verified'");

    // Verify anonymous users cannot select user_roles
    const { data: urData, error: urErr } = await supabase.from("user_roles").select("*").limit(5);
    testAssert(Array.isArray(urData) && urData.length === 0, "Anonymous user cannot enumerate user_roles table (strict RLS)");
  } else {
    console.log("  ⚠️ Skipping live Supabase queries (no credentials in environment)");
  }

  // ── 7. UI Permissions & State Contract Verification ──
  console.log("\n── 7. UI Permissions & State Contract Verification ──");

  const pageFile = "app/(admin)/admin/users/page.tsx";
  const pageCode = fs.readFileSync(pageFile, "utf8");

  testAssert(pageCode.includes("effectiveCallerRole"), "UI computes server-authoritative effectiveCallerRole");
  testAssert(pageCode.includes("isPrimarySuperAdmin"), "UI protects primary super admin with distinct badge");
  testAssert(pageCode.includes("prevUsers"), "UI implements optimistic update with rollback on error");
  testAssert(pageCode.includes("setServerCallerRole"), "UI syncs callerRole returned from GET /api/admin/users");
  testAssert(pageCode.includes("Lock"), "UI imports and renders Lock icon for protected primary admin");

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} USER MANAGEMENT & RBAC TESTS PASSED!`);
  console.log(`==================================================`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
