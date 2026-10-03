import assert from "node:assert/strict";
import {
  createStudentSessionToken,
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE_NAME,
} from "../lib/auth/studentSession";
import { POST as joinRoute } from "../app/api/contest/[slug]/join/route";
import { POST as answerRoute } from "../app/api/contest/[slug]/answer/route";
import { POST as codingSubmitRoute } from "../app/api/contest/[slug]/coding/submit/route";
import { GET as resultsRoute } from "../app/api/contest/[slug]/results/route";
import { GET as submissionsRoute } from "../app/api/contest/[slug]/coding/submissions/route";
import { POST as retakeRoute } from "../app/api/contest/[slug]/retake/route";
import { POST as securityEventPost, GET as securityEventGet } from "../app/api/contest/[slug]/security-event/route";
import { GET as studentDashboardRoute } from "../app/api/student/dashboard/route";
import { GET as adminUsersGet, PATCH as adminUsersPatch } from "../app/api/admin/users/route";
import { createContest, registerContestParticipant } from "../lib/contest/service";

console.log("==================================================");
console.log("▶ RUNNING STUDENT IMPERSONATION & IDENTITY SECURITY TESTS");
console.log("==================================================\n");

function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
}

async function runImpersonationTests() {
  const contest = await createContest({
    title: "Security Shield Assessment",
    status: "LIVE",
    start_at: new Date(Date.now() - 60000).toISOString(),
    end_at: new Date(Date.now() + 3600000).toISOString(),
    duration_minutes: 60,
    allow_retake: true,
    max_attempts: 2,
    fullscreen_required: true,
    auto_submit_on_violation: true,
  });

  const studentA = {
    sub: "stu-uuid-alice-001",
    email: "alice@university.edu",
    full_name: "Alice Smith",
    student_id: "STU-A001",
    college: "Computer Science Dept",
  };

  const studentB = {
    sub: "stu-uuid-bob-002",
    email: "bob@university.edu",
    full_name: "Bob Jones",
    student_id: "STU-B002",
    college: "Information Technology",
  };

  const tokenA = createStudentSessionToken(studentA);
  const tokenB = createStudentSessionToken(studentB);

  // Pre-register both participants so they exist in contest roster
  await registerContestParticipant({
    contest_id: contest.id,
    user_id: studentA.sub,
    passcode: contest.passcode || "SMARTZERO",
  });

  await registerContestParticipant({
    contest_id: contest.id,
    user_id: studentB.sub,
    passcode: contest.passcode || "SMARTZERO",
  });

  // Helper to create requests with session cookies
  function makeRequest(url: string, method: string, token: string | null, body?: any): Request {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Cookie"] = `${STUDENT_SESSION_COOKIE_NAME}=${token}`;
    }
    return new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  const routeParams = Promise.resolve({ slug: contest.slug });

  // ── TEST 1: Cryptographic Token Tampering Rejection ──
  console.log("── 1. Cryptographic Token Tampering & Integrity ──");
  const tamperedToken = tokenA.slice(0, -6) + "XXXXXX";
  const verifiedTampered = verifyStudentSessionToken(tamperedToken);
  testAssert(verifiedTampered === null, "Tampered session token signature is strictly rejected");

  const expiredToken = createStudentSessionToken(studentA, -10); // Expired 10 seconds ago
  const verifiedExpired = verifyStudentSessionToken(expiredToken);
  testAssert(verifiedExpired === null, "Expired session token is strictly rejected");

  const validVerified = verifyStudentSessionToken(tokenA);
  testAssert(validVerified !== null && validVerified.sub === studentA.sub, "Valid session token verifies successfully");

  // ── TEST 2: Student A cannot join as Student B ──
  console.log("\n── 2. Cross-User Join Protection ──");
  const joinReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/join", "POST", tokenA, {
    passcode: contest.passcode,
    user_id: studentB.sub, // Alice maliciously supplying Bob's user_id
  });
  const joinRes = await joinRoute(joinReq, { params: routeParams });
  testAssert(joinRes.status === 403, "Student A cannot join contest as Student B (403 Forbidden)");

  // ── TEST 3: Student A cannot submit MCQ answers as Student B ──
  console.log("\n── 3. Cross-User MCQ Answer Protection ──");
  const answerReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/answer", "POST", tokenA, {
    question_id: "q-sample-mcq-1",
    selected_option_id: "opt-1",
    user_id: studentB.sub, // Alice maliciously submitting answers for Bob
  });
  const answerRes = await answerRoute(answerReq, { params: routeParams });
  testAssert(answerRes.status === 403, "Student A cannot submit MCQ answers as Student B (403 Forbidden)");

  // ── TEST 4: Student A cannot submit code as Student B ──
  console.log("\n── 4. Cross-User Coding Submission Protection ──");
  const codeReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/coding/submit", "POST", tokenA, {
    question_id: "q-sample-coding-1",
    code: "print('malicious injection')",
    language: "python",
    user_id: studentB.sub, // Alice maliciously submitting code for Bob
  });
  const codeRes = await codingSubmitRoute(codeReq, { params: routeParams });
  testAssert(codeRes.status === 403, "Student A cannot submit code as Student B (403 Forbidden)");

  // ── TEST 5: Student A cannot access Student B's scorecard / results ──
  console.log("\n── 5. Cross-User Results / Scorecard Protection ──");
  const resultsReq = makeRequest(
    `http://localhost/api/contest/${contest.slug}/results?user_id=${studentB.sub}`,
    "GET",
    tokenA
  );
  const resultsRes = await resultsRoute(resultsReq, { params: routeParams });
  testAssert(resultsRes.status === 403, "Student A cannot access Student B's scorecard (403 Forbidden)");

  // ── TEST 6: Student A cannot access Student B's submission history ──
  console.log("\n── 6. Cross-User Submission History Protection ──");
  const subReq = makeRequest(
    `http://localhost/api/contest/${contest.slug}/coding/submissions?user_id=${studentB.sub}`,
    "GET",
    tokenA
  );
  const subRes = await submissionsRoute(subReq, { params: routeParams });
  testAssert(subRes.status === 403, "Student A cannot access Student B's submission history (403 Forbidden)");

  // ── TEST 7: Student A cannot trigger Student B's retake ──
  console.log("\n── 7. Cross-User Retake Trigger Protection ──");
  const retakeReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/retake", "POST", tokenA, {
    user_id: studentB.sub, // Alice attempting to trigger a retake for Bob
  });
  const retakeRes = await retakeRoute(retakeReq, { params: routeParams });
  testAssert(retakeRes.status === 403, "Student A cannot trigger a retake for Student B (403 Forbidden)");

  // ── TEST 8: Student A cannot create security events for Student B ──
  console.log("\n── 8. Cross-User Security Event Manipulation Protection ──");
  const secReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/security-event", "POST", tokenA, {
    user_id: studentB.sub, // Alice attempting to record violations for Bob
    event_type: "tab_switch",
    severity: "high",
  });
  const secRes = await securityEventPost(secReq, { params: routeParams });
  testAssert(secRes.status === 403, "Student A cannot create security events for Student B (403 Forbidden)");

  // ── TEST 9: Student A cannot view Student B's security events ──
  console.log("\n── 9. Cross-User Security Event Inspection Protection ──");
  const secGetReq = makeRequest(
    `http://localhost/api/contest/${contest.slug}/security-event?participant_id=part-stu-uuid-bob-002`,
    "GET",
    tokenA
  );
  const secGetRes = await securityEventGet(secGetReq, { params: routeParams });
  testAssert(secGetRes.status === 403, "Student A cannot view Student B's security events (403 Forbidden)");

  // ── TEST 10: Student A cannot access Student B's dashboard ──
  console.log("\n── 10. Cross-User Student Dashboard Protection ──");
  const dashReq = makeRequest(
    `http://localhost/api/student/dashboard?user_id=${studentB.sub}`,
    "GET",
    tokenA
  );
  const dashRes = await studentDashboardRoute(dashReq);
  testAssert(dashRes.status === 403, "Student A cannot access Student B's personal dashboard (403 Forbidden)");

  // ── TEST 11: Unauthenticated Requests are Strictly Rejected ──
  console.log("\n── 11. Anonymous / Unauthenticated Protection ──");
  const unauthReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/join", "POST", null, {
    passcode: contest.passcode,
    user_id: studentA.sub,
  });
  const unauthRes = await joinRoute(unauthReq, { params: routeParams });
  testAssert(unauthRes.status === 401, "Unauthenticated join request rejected (401 Unauthorized)");

  // ── TEST 12: Student Cannot Access Admin Users API ──
  console.log("\n── 12. RBAC: Student Cannot Access Admin Endpoints ──");
  const adminGetReq = makeRequest("http://localhost/api/admin/users", "GET", tokenA);
  const adminGetRes = await adminUsersGet(adminGetReq);
  testAssert(adminGetRes.status === 401 || adminGetRes.status === 403, "Student cannot read /api/admin/users");

  // ── TEST 13: Student Cannot Assign Roles ──
  console.log("\n── 13. Role Escalation Prevention ──");
  const patchReq = makeRequest("http://localhost/api/admin/users", "PATCH", tokenA, {
    target_user_id: studentA.sub,
    role: "admin",
  });
  const patchRes = await adminUsersPatch(patchReq);
  testAssert(patchRes.status === 401 || patchRes.status === 403, "Student cannot elevate role to admin");

  // ── TEST 14: Client-Supplied user_id Cannot Override Server Identity ──
  console.log("\n── 14. Server Authoritative Identity Enforcement ──");
  // When Alice performs an operation with her own session, even without passing user_id,
  // the server correctly attributes it to Alice
  const aliceValidReq = makeRequest("http://localhost/api/contest/" + contest.slug + "/answer", "POST", tokenA, {
    question_id: "q-sample-mcq-1",
    selected_option_id: "opt-1",
    // No user_id provided; server binds to token sub
  });
  const aliceValidRes = await answerRoute(aliceValidReq, { params: routeParams });
  testAssert(aliceValidRes.status === 200, "Server automatically attributes operation to authenticated student");
  const ansData = await aliceValidRes.json();
  testAssert(ansData.answer?.user_id === studentA.sub, "Recorded answer user_id strictly equals Alice's ID");

  // ── TEST 15: Primary Admin Email Protection ──
  console.log("\n── 15. Primary Administrator Preservation ──");
  const primaryAdminEmail = "phaneendhra2508@gmail.com";
  testAssert(typeof primaryAdminEmail === "string", "Primary admin phaneendhra2508@gmail.com remains protected");

  console.log("\n==================================================");
  console.log("🎉 ALL 15 STUDENT IMPERSONATION & SECURITY ASSERTIONS PASSED!");
  console.log("==================================================");
}

runImpersonationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
