import assert from "node:assert/strict";
import fs from "node:fs";
import { NextRequest } from "next/server";
import { updateSession } from "../lib/supabase-middleware";
import {
  createStudentSessionToken,
  createStaffSessionToken,
} from "../lib/auth/studentSession";
import { GET as profileGetRoute, PATCH as profilePatchRoute } from "../app/api/profile/route";
import { GET as sessionGetRoute } from "../app/api/auth/session/route";
import { POST as logoutRoute } from "../app/api/auth/logout/route";
import { registeredProfilesById, registeredProfilesByEmail } from "../lib/contest/registrationStore";

console.log("==================================================");
console.log("▶ RUNNING STUDENT PROFILE ACCESS & SECURITY TEST SUITE");
console.log("==================================================\n");

let passedCount = 0;
function check(condition: boolean, msg: string) {
  assert(condition, msg);
  console.log(`  ✅ ${msg}`);
  passedCount++;
}

async function runTests() {
  const studentAId = `stu-prof-a-${Date.now()}`;
  const studentBId = `stu-prof-b-${Date.now()}`;
  const adminId = `admin-prof-${Date.now()}`;

  // Seed student profiles in registration store
  const studentA = {
    id: studentAId,
    email: "student_a@test.edu",
    full_name: "Alice Student",
    display_name: "Alice Student",
    student_id: "STU-ALICE-01",
    college: "MIT",
    avatar_url: null,
    account_status: "verified" as const,
    role: "student" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const studentB = {
    id: studentBId,
    email: "student_b@test.edu",
    full_name: "Bob Student",
    display_name: "Bob Student",
    student_id: "STU-BOB-02",
    college: "Stanford",
    avatar_url: null,
    account_status: "verified" as const,
    role: "student" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  registeredProfilesById.set(studentAId, studentA);
  registeredProfilesByEmail.set(studentA.email.toLowerCase(), studentA);
  registeredProfilesById.set(studentBId, studentB);
  registeredProfilesByEmail.set(studentB.email.toLowerCase(), studentB);

  const tokenA = createStudentSessionToken({
    sub: studentAId,
    email: studentA.email,
    full_name: studentA.full_name,
    student_id: studentA.student_id,
    college: studentA.college,
    account_status: "verified",
  });

  const tokenB = createStudentSessionToken({
    sub: studentBId,
    email: studentB.email,
    full_name: studentB.full_name,
    student_id: studentB.student_id,
    college: studentB.college,
    account_status: "verified",
  });

  const tokenAdmin = createStaffSessionToken({
    userId: adminId,
    email: "admin_prof@test.edu",
    role: "admin",
    fullName: "Admin User",
  });

  // ── TEST 1: Student can access /profile ──
  console.log("── TEST 1: Student can access /profile ──");
  const mwReqStudent = new NextRequest("http://localhost:3000/profile", {
    headers: {
      cookie: `smartzero_student_session=${tokenA}`,
    },
  });
  const mwResStudent = await updateSession(mwReqStudent);
  check(!mwResStudent.headers.get("location"), "Middleware allows authenticated student on /profile (no redirect)");

  const reqProfileA = new Request("http://localhost:3000/api/profile", {
    headers: {
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const resProfileA = await profileGetRoute(reqProfileA);
  check(resProfileA.status === 200, "GET /api/profile returns 200 for authenticated student");

  // ── TEST 2: Student profile data is correct ──
  console.log("\n── TEST 2: Student profile data is correct ──");
  const dataProfileA = await resProfileA.json();
  check(dataProfileA.profile.id === studentAId, "Profile id matches student session sub");
  check(dataProfileA.profile.email === "student_a@test.edu", "Profile email matches student");
  check(dataProfileA.profile.full_name === "Alice Student", "Profile full_name matches student");
  check(dataProfileA.profile.student_id === "STU-ALICE-01", "Profile student_id matches student");
  check(dataProfileA.profile.college === "MIT", "Profile college matches student");
  check(dataProfileA.profile.account_status === "verified", "Profile account_status is verified");
  check(dataProfileA.profile.role === "student", "Profile role is student");

  const reqSessionA = new Request("http://localhost:3000/api/auth/session", {
    headers: {
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const resSessionA = await sessionGetRoute(reqSessionA);
  const dataSessionA = await resSessionA.json();
  check(dataSessionA.authenticated === true, "Session endpoint returns authenticated = true");
  check(dataSessionA.user.account_status === "verified", "Session endpoint returns verified account_status");
  check(dataSessionA.user.student_id === "STU-ALICE-01", "Session endpoint returns student_id");

  // ── TEST 3: Student session is required ──
  console.log("\n── TEST 3: Student session is required ──");
  const reqNoAuthGet = new Request("http://localhost:3000/api/profile");
  const resNoAuthGet = await profileGetRoute(reqNoAuthGet);
  check(resNoAuthGet.status === 401, "GET /api/profile without session returns 401");

  const reqNoAuthPatch = new Request("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Hacker" }),
  });
  const resNoAuthPatch = await profilePatchRoute(reqNoAuthPatch);
  check(resNoAuthPatch.status === 401, "PATCH /api/profile without session returns 401");

  const reqNoAuthSession = new Request("http://localhost:3000/api/auth/session");
  const resNoAuthSession = await sessionGetRoute(reqNoAuthSession);
  const dataNoAuthSession = await resNoAuthSession.json();
  check(dataNoAuthSession.authenticated === false, "GET /api/auth/session without session returns authenticated = false");

  // ── TEST 4: Anonymous /profile access is rejected/redirected ──
  console.log("\n── TEST 4: Anonymous /profile access is rejected or redirected appropriately ──");
  const mwReqAnon = new NextRequest("http://localhost:3000/profile");
  const mwResAnon = await updateSession(mwReqAnon);
  check(mwResAnon.status === 307, "Middleware returns 307 redirect for anonymous visitor on /profile");
  check(
    (mwResAnon.headers.get("location") || "").includes("/login"),
    "Middleware redirects anonymous visitor to /login"
  );

  // ── TEST 5: Student cannot request another student's profile ──
  console.log("\n── TEST 5: Student cannot request another student's profile ──");
  const reqSpoofGet = new Request(`http://localhost:3000/api/profile?userId=${studentBId}`, {
    headers: {
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const resSpoofGet = await profileGetRoute(reqSpoofGet);
  const dataSpoofGet = await resSpoofGet.json();
  check(dataSpoofGet.profile.id === studentAId, "Server ignores target userId parameter and returns caller's own profile");
  check(dataSpoofGet.profile.email === "student_a@test.edu", "Server returns Student A email, not Student B");

  // ── TEST 6: Student cannot escalate role through profile ──
  console.log("\n── TEST 6: Student cannot escalate role through profile ──");
  const reqEscalateAdmin = new Request("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ role: "admin" }),
  });
  const resEscalateAdmin = await profilePatchRoute(reqEscalateAdmin);
  check(resEscalateAdmin.status === 403, "Student attempting role escalation to admin receives 403 Forbidden");

  const reqEscalateSuper = new Request("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ role: "super_admin" }),
  });
  const resEscalateSuper = await profilePatchRoute(reqEscalateSuper);
  check(resEscalateSuper.status === 403, "Student attempting role escalation to super_admin receives 403 Forbidden");

  // ── TEST 7: Student cannot modify another student's data ──
  console.log("\n── TEST 7: Student cannot modify another student's data ──");
  const reqTamperB = new Request("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ id: studentBId, full_name: "Hacked by A" }),
  });
  const resTamperB = await profilePatchRoute(reqTamperB);
  check(resTamperB.status === 403, "Student attempting cross-user modification by id receives 403 Forbidden");

  const reqTamperBUserId = new Request("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ user_id: studentBId, full_name: "Hacked by A" }),
  });
  const resTamperBUserId = await profilePatchRoute(reqTamperBUserId);
  check(resTamperBUserId.status === 403, "Student attempting cross-user modification by user_id receives 403 Forbidden");

  // Student modifies own profile
  const reqValidUpdateA = new Request("http://localhost:3000/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ full_name: "Alice Updated", college: "Harvard" }),
  });
  const resValidUpdateA = await profilePatchRoute(reqValidUpdateA);
  check(resValidUpdateA.status === 200, "Student successfully updates own profile details");
  const dataValidUpdateA = await resValidUpdateA.json();
  check(dataValidUpdateA.profile.full_name === "Alice Updated", "Student full_name updated");
  check(dataValidUpdateA.profile.college === "Harvard", "Student college updated");

  // Verify Student B profile was NOT modified
  const profileBInStore = registeredProfilesById.get(studentBId);
  check(profileBInStore?.full_name === "Bob Student", "Student B profile remains unmodified");

  // ── TEST 8: Staff /profile still works ──
  console.log("\n── TEST 8: Staff /profile still works ──");
  const reqStaffProfile = new Request("http://localhost:3000/api/profile", {
    headers: {
      Authorization: `Bearer ${tokenAdmin}`,
    },
  });
  const resStaffProfile = await profileGetRoute(reqStaffProfile);
  check(resStaffProfile.status === 200, "Staff /api/profile returns 200");
  const dataStaffProfile = await resStaffProfile.json();
  check(dataStaffProfile.profile.role === "admin", "Staff profile role is admin");

  const mwReqStaff = new NextRequest("http://localhost:3000/profile", {
    headers: {
      cookie: `smartzero_student_session=${tokenAdmin}`,
    },
  });
  const mwResStaff = await updateSession(mwReqStaff);
  check(!mwResStaff.headers.get("location"), "Middleware allows staff session on /profile without redirect");

  // ── TEST 9: Student profile does not call Supabase Auth password APIs ──
  console.log("\n── TEST 9: Student profile does not call Supabase Auth password APIs ──");
  const profilePageCode = fs.readFileSync("app/profile/page.tsx", "utf-8");
  check(
    profilePageCode.includes('role !== "student"'),
    "app/profile/page.tsx guards password change section with role !== 'student'"
  );
  check(
    profilePageCode.includes("Security & Password Update (Staff Only)"),
    "Password section is explicitly designated Staff Only in UI markup"
  );

  // ── TEST 10: Logout makes /profile inaccessible ──
  console.log("\n── TEST 10: Logout makes /profile inaccessible ──");
  const logoutRes = await logoutRoute();
  check(logoutRes.status === 200, "POST /api/auth/logout succeeds with 200");
  const setCookieHeader = logoutRes.headers.get("set-cookie") || "";
  check(
    setCookieHeader.includes("smartzero_student_session") &&
      (setCookieHeader.includes("Max-Age=0") || setCookieHeader.includes("max-age=0") || setCookieHeader.includes("Expires=")),
    "Logout clears smartzero_student_session cookie"
  );

  const mwReqLoggedOut = new NextRequest("http://localhost:3000/profile");
  const mwResLoggedOut = await updateSession(mwReqLoggedOut);
  check(mwResLoggedOut.status === 307, "Subsequent /profile request after logout is redirected by middleware");
  check(
    (mwResLoggedOut.headers.get("location") || "").includes("/login"),
    "Logged out user is redirected to /login"
  );

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passedCount} STUDENT PROFILE REGRESSION ASSERTIONS PASSED!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
