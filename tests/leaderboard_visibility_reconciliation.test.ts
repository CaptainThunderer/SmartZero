import assert from "node:assert/strict";
import { POST as createContestRoute } from "../app/api/admin/contests/route";
import { PATCH as updateContestRoute, GET as getContestRoute } from "../app/api/admin/contests/[id]/route";
import { GET as studentLeaderboardRoute } from "../app/api/contest/[slug]/leaderboard/route";
import { POST as finishContestRoute } from "../app/api/contest/[slug]/finish/route";
import { GET as resultsRoute } from "../app/api/contest/[slug]/results/route";
import { createContest, deleteContest, registerContestParticipant } from "../lib/contest/service";
import { createStudentSessionToken, createStaffSessionToken } from "../lib/auth/studentSession";

console.log("==================================================");
console.log("▶ RUNNING LEADERBOARD VISIBILITY RECONCILIATION TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  const createdContestIds: string[] = [];
  const adminToken = createStaffSessionToken({
    userId: "test-admin-super",
    email: "superadmin@smartzero.edu",
    role: "super_admin",
  });

  try {
    // ── 1. Create Contest with leaderboard_visibility = PUBLIC via API Route ──
    console.log("── 1. POST /api/admin/contests (PUBLIC) ──");
    const reqPub = new Request("http://localhost/api/admin/contests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "API Public Contest",
        passcode: "PUB-TEST-123",
        start_at: new Date(Date.now() + 1000 * 60).toISOString(),
        end_at: new Date(Date.now() + 1000 * 3600).toISOString(),
        duration_minutes: 60,
        leaderboard_visibility: "PUBLIC",
      }),
    });
    const resPub = await createContestRoute(reqPub);
    testAssert(resPub.status === 201, "POST /api/admin/contests returns 201 Created for PUBLIC contest");
    const dataPub = await resPub.json();
    testAssert(dataPub.contest?.leaderboard_visibility === "PUBLIC", "Created contest has leaderboard_visibility = 'PUBLIC'");
    createdContestIds.push(dataPub.contest.id);

    // ── 2. Create Contest with leaderboard_visibility = ANONYMOUS via API Route ──
    console.log("\n── 2. POST /api/admin/contests (ANONYMOUS) ──");
    const reqAnon = new Request("http://localhost/api/admin/contests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "API Anonymous Contest",
        passcode: "ANON-TEST-123",
        start_at: new Date(Date.now() + 1000 * 60).toISOString(),
        end_at: new Date(Date.now() + 1000 * 3600).toISOString(),
        duration_minutes: 60,
        leaderboard_visibility: "ANONYMOUS",
      }),
    });
    const resAnon = await createContestRoute(reqAnon);
    testAssert(resAnon.status === 201, "POST /api/admin/contests returns 201 Created for ANONYMOUS contest");
    const dataAnon = await resAnon.json();
    testAssert(dataAnon.contest?.leaderboard_visibility === "ANONYMOUS", "Created contest has leaderboard_visibility = 'ANONYMOUS'");
    createdContestIds.push(dataAnon.contest.id);

    // ── 3. Default Semantics: Omitted leaderboard_visibility defaults to PUBLIC ──
    console.log("\n── 3. POST /api/admin/contests (Default Omitted) ──");
    const reqDef = new Request("http://localhost/api/admin/contests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "API Default Contest",
        passcode: "DEF-TEST-123",
        start_at: new Date(Date.now() + 1000 * 60).toISOString(),
        end_at: new Date(Date.now() + 1000 * 3600).toISOString(),
        duration_minutes: 60,
      }),
    });
    const resDef = await createContestRoute(reqDef);
    testAssert(resDef.status === 201, "POST /api/admin/contests returns 201 for default contest");
    const dataDef = await resDef.json();
    testAssert(dataDef.contest?.leaderboard_visibility === "PUBLIC", "Omitted leaderboard_visibility defaults safely to 'PUBLIC'");
    createdContestIds.push(dataDef.contest.id);

    // ── 4. Verify PATCH /api/admin/contests/[id] Edit Transitions ──
    console.log("\n── 4. PATCH /api/admin/contests/[id] Edit Transitions ──");
    // Transition PUBLIC -> ANONYMOUS
    const reqPatchToAnon = new Request(`http://localhost/api/admin/contests/${dataPub.contest.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ leaderboard_visibility: "ANONYMOUS" }),
    });
    const resPatchToAnon = await updateContestRoute(reqPatchToAnon, { params: Promise.resolve({ id: dataPub.contest.id }) });
    testAssert(resPatchToAnon.status === 200, "PATCH returns 200 OK for PUBLIC -> ANONYMOUS transition");
    const dataPatchToAnon = await resPatchToAnon.json();
    testAssert(dataPatchToAnon.contest?.leaderboard_visibility === "ANONYMOUS", "Contest leaderboard_visibility successfully changed to ANONYMOUS");

    // Transition ANONYMOUS -> PUBLIC
    const reqPatchToPub = new Request(`http://localhost/api/admin/contests/${dataPub.contest.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ leaderboard_visibility: "PUBLIC" }),
    });
    const resPatchToPub = await updateContestRoute(reqPatchToPub, { params: Promise.resolve({ id: dataPub.contest.id }) });
    testAssert(resPatchToPub.status === 200, "PATCH returns 200 OK for ANONYMOUS -> PUBLIC transition");
    const dataPatchToPub = await resPatchToPub.json();
    testAssert(dataPatchToPub.contest?.leaderboard_visibility === "PUBLIC", "Contest leaderboard_visibility successfully changed back to PUBLIC");

    // ── 5. Student Privacy in Anonymous Contest ──
    console.log("\n── 5. Privacy Verification: Student Access to Anonymous Contest ──");
    const studentToken = createStudentSessionToken({
      sub: "student-anon-probe-01",
      email: "anon_student@university.edu",
    });

    // Register student
    await registerContestParticipant({
      contest_id: dataAnon.contest.id,
      user_id: "student-anon-probe-01",
      passcode: "ANON-TEST-123",
    });

    // Call student leaderboard route
    const reqLead = new Request(`http://localhost/api/contest/${dataAnon.contest.slug}/leaderboard`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resLead = await studentLeaderboardRoute(reqLead, { params: Promise.resolve({ slug: dataAnon.contest.slug }) });
    testAssert(resLead.status === 200, "Student leaderboard request returns 200");
    const dataLead = await resLead.json();
    testAssert(dataLead.leaderboard_visibility === "ANONYMOUS", "Leaderboard response marks visibility as ANONYMOUS");
    testAssert(Array.isArray(dataLead.leaderboard) && dataLead.leaderboard.length === 0, "Student receives EMPTY leaderboard array in anonymous contest");
    testAssert(dataLead.currentUserScore === null, "Student receives null currentUserScore in anonymous contest");
    testAssert(dataLead.currentUserRank === null, "Student receives null currentUserRank in anonymous contest");
    testAssert(dataLead.totalParticipants === 0, "Student receives totalParticipants = 0 in anonymous contest");

    // Call finish route
    const reqFinish = new Request(`http://localhost/api/contest/${dataAnon.contest.slug}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ submission_reason: "manual" }),
    });
    const resFinish = await finishContestRoute(reqFinish, { params: Promise.resolve({ slug: dataAnon.contest.slug }) });
    testAssert(resFinish.status === 200, "Finish contest returns 200 OK");
    const dataFinish = await resFinish.json();
    testAssert(dataFinish.score === undefined, "Finish response strictly omits score field in anonymous mode");
    testAssert(dataFinish.participant?.score === undefined, "Finish response strictly omits participant.score field in anonymous mode");

    // Call results route
    const reqResults = new Request(`http://localhost/api/contest/${dataAnon.contest.slug}/results`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resResults = await resultsRoute(reqResults, { params: Promise.resolve({ slug: dataAnon.contest.slug }) });
    testAssert(resResults.status === 200, "Results request returns 200 OK");
    const dataResults = await resResults.json();
    testAssert(dataResults.total_score === undefined, "Results response strictly omits total_score in anonymous mode");
    testAssert(dataResults.rank === undefined, "Results response strictly omits rank in anonymous mode");
    testAssert(dataResults.percentile === undefined, "Results response strictly omits percentile in anonymous mode");

    // ── 6. Admin retains full visibility in Anonymous Contest ──
    console.log("\n── 6. Admin Full Visibility in Anonymous Contest ──");
    const reqAdminLead = new Request(`http://localhost/api/contest/${dataAnon.contest.slug}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resAdminLead = await studentLeaderboardRoute(reqAdminLead, { params: Promise.resolve({ slug: dataAnon.contest.slug }) });
    testAssert(resAdminLead.status === 200, "Admin leaderboard access returns 200");
    const dataAdminLead = await resAdminLead.json();
    testAssert(Array.isArray(dataAdminLead.leaderboard), "Admin receives array of leaderboard entries");

    console.log(`\n==================================================`);
    console.log(`🎉 ALL ${passed} LEADERBOARD VISIBILITY ASSERTIONS PASSED!`);
    console.log(`==================================================`);
  } finally {
    // ── 7. Safe Cleanup of All Test Contests ──
    console.log("\n── 7. Cleaning up test contests ──");
    for (const contestId of createdContestIds) {
      try {
        await deleteContest(contestId, { force: true });
        console.log(`  Cleaned up contest: ${contestId}`);
      } catch (err: any) {
        console.warn(`  Cleanup warning for ${contestId}:`, err.message);
      }
    }
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
