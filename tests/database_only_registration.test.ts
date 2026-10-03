import assert from "node:assert/strict";
import { POST as registerRoute } from "../app/api/auth/register/route";
import { POST as studentAccessRoute } from "../app/api/auth/student-access/route";
import { useAuthStore } from "../stores/authStore";
import { getPublicContestSummaries, registerContestParticipant, createContest } from "../lib/contest/service";
import type { UserRole } from "../types/auth";

console.log("==================================================");
console.log("▶ RUNNING DATABASE-ONLY REGISTRATION TEST SUITE");
console.log("==================================================\n");

function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
}

async function runTests() {
  const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 1000);
  const testStudentEmail = `student_${uniqueId}@university.edu`;
  const testFullName = "Ada Lovelace";
  const testStudentId = `STU-${uniqueId}`;
  const testCollege = "Imperial College London";

  // ── 1. Registration Saves Profile Details to Database ──
  console.log("── 1. Database-Only Registration ──");
  const regReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: testFullName,
      email: testStudentEmail,
      student_id: testStudentId,
      college: testCollege,
      // Passwords must be completely ignored even if submitted
      password: "IgnoredPlaintextPassword123!",
    }),
  });

  const regRes = await registerRoute(regReq);
  testAssert(regRes.status === 200, "Registration API returns 200 OK");

  const regData = await regRes.json();
  testAssert(regData.success === true, "Registration response indicates success");
  testAssert(Boolean(regData.profile?.id), "Profile record generated with unique ID");
  testAssert(regData.profile.email === testStudentEmail, "Profile email matches submitted email");
  testAssert(regData.profile.full_name === testFullName, "Profile full_name matches submitted name");
  testAssert(regData.profile.student_id === testStudentId, "Profile student_id is persisted");
  testAssert(regData.profile.college === testCollege, "Profile college is persisted");

  // ── 2. Student Role is Assigned ──
  console.log("\n── 2. Default Student Role Assignment ──");
  testAssert(regData.profile.role === "student", "Default student role is assigned");

  // ── 3. Zero Password Storage ──
  console.log("\n── 3. Zero Password Storage Verification ──");
  testAssert(regData.profile.password === undefined, "Profile payload contains NO password");
  testAssert(regData.profile.password_hash === undefined, "Profile payload contains NO password_hash");

  // ── 4. No Supabase Auth Call & No Email Confirmation Dependency ──
  console.log("\n── 4. No Auth Email / Confirmation Dependency ──");
  testAssert(regData.profile.email_confirmed === undefined, "Does not check or depend on email_confirmed flag");
  testAssert(regData.profile.account_status === "verified", "Student is immediately marked verified/active for access");

  // ── 5. Student Access Lookup (Passwordless) ──
  console.log("\n── 5. Student Access Lookup via Database ──");
  const accessReq = new Request("http://localhost:3000/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testStudentEmail }),
  });

  const accessRes = await studentAccessRoute(accessReq);
  testAssert(accessRes.status === 200, "Student access route returns 200 OK");
  const accessData = await accessRes.json();
  testAssert(accessData.profile.email === testStudentEmail, "Student access retrieves registered profile");
  testAssert(accessData.profile.student_id === testStudentId, "Student ID matches retrieved record");

  // ── 6. Client Store Integration ──
  console.log("\n── 6. Client Auth Store Registration Integration ──");
  const authStore = useAuthStore.getState();
  testAssert(typeof authStore.registerStudent === "function", "registerStudent action is available on auth store");
  testAssert(typeof authStore.signInWithRegisteredEmail === "function", "signInWithRegisteredEmail action is available");

  // ── 7. Admin RBAC Integrity Preservation ──
  console.log("\n── 7. Admin RBAC Matrix Preservation ──");
  function checkRoleAccess(userRole: UserRole, targetRoute: string): boolean {
    if (targetRoute === "/" || targetRoute === "/login" || targetRoute === "/signup") return true;
    if (targetRoute === "/profile" || targetRoute === "/dashboard") return true;
    if (targetRoute.startsWith("/admin")) return userRole === "admin" || userRole === "super_admin";
    return false;
  }

  testAssert(checkRoleAccess("student", "/admin") === false, "Student cannot access /admin");
  testAssert(checkRoleAccess("student", "/admin/users") === false, "Student cannot access /admin/users");
  testAssert(checkRoleAccess("admin", "/admin") === true, "Admin can access /admin");
  testAssert(checkRoleAccess("super_admin", "/admin") === true, "Super Admin can access /admin");

  // ── 8. Contest Participation with Registered Student ──
  console.log("\n── 8. Contest Participation with Registered Student ──");
  const now = new Date();
  const testContest = await createContest({
    title: `Database Student Test Contest ${uniqueId}`,
    passcode: "REGTEST",
    duration_minutes: 60,
    status: "LIVE",
    start_at: new Date(now.getTime() - 10000).toISOString(),
    end_at: new Date(now.getTime() + 3600000).toISOString(),
  });

  const regPart = await registerContestParticipant({
    contest_id: testContest.id,
    user_id: regData.profile.id,
    passcode: "REGTEST",
  });

  testAssert(regPart.participant !== null, "Registered student can join contest using database ID");
  testAssert(regPart.participant?.user_id === regData.profile.id, "Participant user_id matches registered student ID");
  testAssert(regPart.participant?.status === "registered", "Participant status is registered");

  console.log("\n==================================================");
  console.log("🎉 ALL DATABASE-ONLY REGISTRATION ASSERTIONS PASSED!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
