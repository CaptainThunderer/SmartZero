import assert from "node:assert/strict";
import fs from "node:fs";

// Load .env.local for live Supabase testing
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

import { POST as registerRoute } from "../app/api/auth/register/route";
import { POST as studentAccessRoute } from "../app/api/auth/student-access/route";
import { GET as sessionRoute } from "../app/api/auth/session/route";
import {
  createStudentSessionToken,
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE_NAME,
} from "../lib/auth/studentSession";
import { useAuthStore } from "../stores/authStore";
import { registeredProfilesByEmail } from "../lib/contest/registrationStore";

console.log("==================================================");
console.log("▶ RUNNING AUTH & LOGIN FLOW VERIFICATION TEST SUITE");
console.log("==================================================\n");

function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
}

async function runTests() {
  const uniqueId = Date.now() + "_" + Math.floor(Math.random() * 1000);
  const testStudentEmail = `student_auth_${uniqueId}@university.edu`;
  const testFullName = "Marie Curie";
  const testStudentId = `STU-MC-${uniqueId}`;
  const testCollege = "Sorbonne University";

  // ── 1. Student Registration (Database-Only) ──
  console.log("── 1. Student Registration ──");
  const regReq = new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: testFullName,
      email: testStudentEmail,
      student_id: testStudentId,
      college: testCollege,
      // Attempted role injection must be ignored
      role: "admin",
    }),
  });

  const regRes = await registerRoute(regReq);
  testAssert(regRes.status === 200, "Registration returns HTTP 200 OK");
  const regData = await regRes.json();
  testAssert(regData.success === true, "Registration marked success: true");
  testAssert(regData.profile.email === testStudentEmail, "Profile email matches registered email");
  testAssert(regData.profile.role === "student", "Role injection prevented: role is strictly 'student'");
  testAssert(Boolean(regData.token), "HMAC-SHA256 student session token is issued on registration");

  // ── 2. Existing Student Login via Student Access ──
  console.log("\n── 2. Existing Student Login via Student Access ──");
  const studentLoginReq = new Request("http://localhost/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testStudentEmail }),
  });

  const studentLoginRes = await studentAccessRoute(studentLoginReq);
  testAssert(studentLoginRes.status === 200, "Existing student login returns HTTP 200 OK");
  const studentLoginData = await studentLoginRes.json();
  testAssert(studentLoginData.success === true, "Student login marked success: true");
  testAssert(studentLoginData.profile.id === regData.profile.id, "Student ID matches registered profile");
  testAssert(studentLoginData.profile.role === "student", "Student access returns role 'student'");
  testAssert(Boolean(studentLoginData.token), "Student access returns signed session token");

  // ── 3. Unknown Student Email Behavior (Controlled 404) ──
  console.log("\n── 3. Unknown Student Email Returns Controlled 404 ──");
  const unknownEmailReq = new Request("http://localhost/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unknown_person_99999@notfound.edu" }),
  });

  const unknownRes = await studentAccessRoute(unknownEmailReq);
  testAssert(unknownRes.status === 404, "Unknown student email returns HTTP 404");
  const unknownData = await unknownRes.json();
  testAssert(unknownData.code === "STUDENT_NOT_FOUND", "Error code is STUDENT_NOT_FOUND");
  testAssert(
    unknownData.error === "No student profile found for this email. Please register an account first.",
    "User-facing message instructs user to register first"
  );
  testAssert(unknownData.token === undefined, "No session token issued for unknown email");
  testAssert(!unknownData.error.includes("Failed to fetch details"), "No generic 'Failed to fetch details' error");

  // ── 4. Wrong-Flow Defense: Admin Email in Student Access Flow ──
  console.log("\n── 4. Admin Email in Student Access Flow (Defense in Depth) ──");
  const adminEmail = "phaneendhra2508@gmail.com";
  const adminInStudentFlowReq = new Request("http://localhost/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail }),
  });

  const adminInStudentFlowRes = await studentAccessRoute(adminInStudentFlowReq);
  testAssert(adminInStudentFlowRes.status === 404, "Admin email in student flow returns HTTP 404");
  const adminInStudentFlowData = await adminInStudentFlowRes.json();
  testAssert(
    adminInStudentFlowData.code === "STAFF_ACCOUNT_DETECTED",
    "Returns code STAFF_ACCOUNT_DETECTED"
  );
  testAssert(
    adminInStudentFlowData.error.includes("Admin / Staff portal"),
    "Directs staff account to use Admin / Staff portal"
  );
  testAssert(adminInStudentFlowData.token === undefined, "DOES NOT issue student session token to admin");

  // Also test in-memory fallback defense for staff accounts
  registeredProfilesByEmail.set("mock_staff@smartzero.io", {
    id: "staff-001",
    email: "mock_staff@smartzero.io",
    full_name: "Mock Staff Admin",
    display_name: "Mock Staff",
    student_id: "",
    college: "",
    avatar_url: null,
    role: "admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const mockStaffReq = new Request("http://localhost/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mock_staff@smartzero.io" }),
  });
  const mockStaffRes = await studentAccessRoute(mockStaffReq);
  testAssert(mockStaffRes.status === 404, "In-memory staff user in student flow is rejected (HTTP 404)");
  const mockStaffData = await mockStaffRes.json();
  testAssert(mockStaffData.code === "STAFF_ACCOUNT_DETECTED", "In-memory staff role correctly triggers STAFF_ACCOUNT_DETECTED");

  // ── 5. Invalid / Malformed Input Handling ──
  console.log("\n── 5. Input Validation & Error Codes ──");
  const emptyEmailReq = new Request("http://localhost/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "   " }),
  });
  const emptyEmailRes = await studentAccessRoute(emptyEmailReq);
  testAssert(emptyEmailRes.status === 400, "Empty email returns HTTP 400");
  const emptyEmailData = await emptyEmailRes.json();
  testAssert(emptyEmailData.code === "EMAIL_REQUIRED", "Returns EMAIL_REQUIRED code");

  const invalidEmailReq = new Request("http://localhost/api/auth/student-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  const invalidEmailRes = await studentAccessRoute(invalidEmailReq);
  testAssert(invalidEmailRes.status === 400, "Malformed email returns HTTP 400");
  const invalidEmailData = await invalidEmailRes.json();
  testAssert(invalidEmailData.code === "INVALID_EMAIL", "Returns INVALID_EMAIL code");

  // ── 6. Student Session Verification & Anti-Tampering ──
  console.log("\n── 6. Student Session Verification & Anti-Tampering ──");
  const validToken = studentLoginData.token;
  const verified = verifyStudentSessionToken(validToken);
  testAssert(verified !== null, "Cryptographic session token verifies successfully");
  testAssert(verified?.email === testStudentEmail, "Verified token contains student email");
  testAssert(verified?.role === "student", "Verified token role is student");

  // Signature tampering must fail
  const tamperedToken = validToken.slice(0, -8) + "ABCDEFGH";
  const verifiedTampered = verifyStudentSessionToken(tamperedToken);
  testAssert(verifiedTampered === null, "Tampered session token signature is rejected");

  // ── 7. Session API Endpoint ──
  console.log("\n── 7. Session API Route (/api/auth/session) ──");
  const sessionReq = new Request("http://localhost/api/auth/session", {
    headers: {
      Cookie: `${STUDENT_SESSION_COOKIE_NAME}=${validToken}`,
    },
  });
  const sessionRes = await sessionRoute(sessionReq);
  testAssert(sessionRes.status === 200, "Session endpoint returns HTTP 200");
  const sessionData = await sessionRes.json();
  testAssert(sessionData.authenticated === true, "Session reports authenticated: true");
  testAssert(sessionData.user.email === testStudentEmail, "Session reports correct student email");
  testAssert(sessionData.user.role === "student", "Session reports role: 'student'");

  // Unauthenticated session check
  const unauthSessionReq = new Request("http://localhost/api/auth/session");
  const unauthSessionRes = await sessionRoute(unauthSessionReq);
  const unauthSessionData = await unauthSessionRes.json();
  testAssert(unauthSessionData.authenticated === false, "Unauthenticated session reports authenticated: false");
  testAssert(unauthSessionData.user === null, "Unauthenticated session reports user: null");

  // ── 8. Client Auth Store Verification ──
  console.log("\n── 8. Client Auth Store Integration ──");
  const authStore = useAuthStore.getState();
  testAssert(typeof authStore.signInWithRegisteredEmail === "function", "signInWithRegisteredEmail is exposed on store");
  testAssert(typeof authStore.registerStudent === "function", "registerStudent is exposed on store");

  // In Node environment, bridge relative fetch calls to studentAccessRoute
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = input.toString();
      if (urlStr.includes("/api/auth/student-access")) {
        const fullUrl = urlStr.startsWith("http") ? urlStr : `http://localhost${urlStr}`;
        const req = new Request(fullUrl, init);
        return studentAccessRoute(req);
      }
      return originalFetch(input, init);
    };

    const clientLoginRes = await authStore.signInWithRegisteredEmail(testStudentEmail);
    testAssert(clientLoginRes.success === true, "Client store signInWithRegisteredEmail succeeds for registered student");
    testAssert(useAuthStore.getState().isAuthenticated === true, "Store state is authenticated");
    testAssert(useAuthStore.getState().role === "student", "Store state role is student");

    // Test client store handling of unknown student email
    const clientUnknownRes = await authStore.signInWithRegisteredEmail("unknown_person@notfound.edu");
    testAssert(clientUnknownRes.success === false, "Client store handles unknown student cleanly");
    testAssert(clientUnknownRes.code === "STUDENT_NOT_FOUND", "Client store returns STUDENT_NOT_FOUND code");
    testAssert(!clientUnknownRes.error?.includes("Failed to fetch"), "Error is not raw 'Failed to fetch'");

    // Test client store handling of admin email in student flow
    const clientAdminRes = await authStore.signInWithRegisteredEmail(adminEmail);
    testAssert(clientAdminRes.success === false, "Client store rejects admin in student flow");
    testAssert(clientAdminRes.code === "STAFF_ACCOUNT_DETECTED", "Client store returns STAFF_ACCOUNT_DETECTED code");

    // Clean sign out
    await authStore.signOut();
    testAssert(useAuthStore.getState().isAuthenticated === false, "After signOut, store state is unauthenticated");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("\n==================================================");
  console.log("🎉 ALL AUTH & LOGIN FLOW ASSERTIONS PASSED!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
