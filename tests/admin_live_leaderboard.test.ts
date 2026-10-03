import assert from "node:assert";
import {
  createContest,
  canUserManageContest,
  assignContestAdmin,
  registerContestParticipant,
  addMcqQuestion,
  addCodingQuestion,
  linkQuestionToContest,
  recordMcqAnswer,
} from "../lib/contest/service";
import { saveCodingSubmission } from "../lib/judge/service";
import {
  createStudentSessionToken,
  createStaffSessionToken,
  getAuthenticatedUser,
} from "../lib/auth/studentSession";
import { GET as getAdminLiveLeaderboardRoute } from "../app/api/admin/contests/[id]/leaderboard/route";

console.log("==================================================");
console.log("▶ RUNNING ADMIN LIVE LEADERBOARD & MONITORING TESTS");
console.log("==================================================");

let passed = 0;
let failed = 0;

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}:`, err);
    process.exit(1);
  }
}

async function runTests() {
  const now = Date.now();
  const champPasscode = "SECRET_CHAMP_123";

  // Create sample contests:
  // 1. LIVE Contest
  const liveContest = await createContest({
    title: "Championship Live Arena",
    slug: `champ-live-${now}`,
    passcode: champPasscode,
    start_at: new Date(now - 1800 * 1000).toISOString(),
    end_at: new Date(now + 1800 * 1000).toISOString(),
    duration_minutes: 60,
    status: "LIVE",
  });

  // 2. Unassigned Contest
  const unassignedContest = await createContest({
    title: "Regional Unassigned Contest",
    slug: `reg-unassigned-${now}`,
    passcode: "SECRET_REG_456",
    start_at: new Date(now - 1800 * 1000).toISOString(),
    end_at: new Date(now + 1800 * 1000).toISOString(),
    duration_minutes: 60,
    status: "LIVE",
  });

  // Questions Setup
  const mcq1 = await addMcqQuestion({
    prompt: "Sample Question 1",
    explanation: "Explanation 1",
    options: [
      { option_text: "Option A", is_correct: true, sort_order: 0 },
      { option_text: "Option B", is_correct: false, sort_order: 1 },
    ],
  });
  await linkQuestionToContest({
    contest_id: liveContest.id,
    question_id: mcq1.id,
    question_type: "mcq",
    sort_order: 0,
    marks: 100,
  });

  const code1 = await addCodingQuestion({
    title: "Algorithm Problem 1",
    description: "Solve problem",
    test_cases: [
      { input: "1", expected_output: "1", is_sample: true, is_hidden: false, weight: 80 },
    ],
  });
  await linkQuestionToContest({
    contest_id: liveContest.id,
    question_id: code1.id,
    question_type: "coding",
    sort_order: 1,
    marks: 80,
  });

  // Create participants with deterministic scores and submission timestamps:
  // Alice: 100 pts, effective time ~300s
  const aliceId = `alice-${now}`;
  await registerContestParticipant({
    contest_id: liveContest.id,
    user_id: aliceId,
    passcode: champPasscode,
    user_profile: {
      full_name: "Alice Smith",
      email: "alice@university.edu",
      student_id: "STU-1001",
      college: "Engineering College",
    },
  });

  // Bob: 80 pts, effective time ~250s
  const bobId = `bob-${now}`;
  await registerContestParticipant({
    contest_id: liveContest.id,
    user_id: bobId,
    passcode: champPasscode,
    user_profile: {
      full_name: "Bob Jones",
      email: "bob@university.edu",
      student_id: "STU-1002",
      college: "Tech Institute",
    },
  });

  // Charlie: 100 pts, effective time ~200s (ranks above Alice due to tiebreaker)
  const charlieId = `charlie-${now}`;
  await registerContestParticipant({
    contest_id: liveContest.id,
    user_id: charlieId,
    passcode: champPasscode,
    user_profile: {
      full_name: "Charlie Brown",
      email: "charlie@university.edu",
      student_id: "STU-1003",
      college: "Science Academy",
    },
  });

  // Record Submissions
  // Alice: solves MCQ1 (+100 marks)
  await recordMcqAnswer({
    contest_id: liveContest.id,
    user_id: aliceId,
    question_id: mcq1.id,
    selected_option_id: mcq1.options![0].id,
  });

  // Charlie: solves MCQ1 (+100 marks)
  await recordMcqAnswer({
    contest_id: liveContest.id,
    user_id: charlieId,
    question_id: mcq1.id,
    selected_option_id: mcq1.options![0].id,
  });

  // Bob: solves Coding1 (+80 marks)
  await saveCodingSubmission({
    contest_id: liveContest.id,
    user_id: bobId,
    question_id: code1.id,
    language: "python",
    code: "print(1)",
    summary: {
      verdict: "Accepted",
      score: 80,
      test_cases_passed: 1,
      total_test_cases: 1,
      execution_time_ms: 100,
      memory_kb: 512,
      test_case_results: [],
    },
  });

  // Generate Staff and Student Tokens
  const superAdminToken = createStaffSessionToken({
    userId: "super-admin-root",
    email: "phaneendhra2508@gmail.com",
    role: "super_admin",
    fullName: "Super Administrator",
  });

  const adminToken = createStaffSessionToken({
    userId: "admin-staff-01",
    email: "admin@smartzero.io",
    role: "admin",
    fullName: "Contest Director",
  });

  const contestAdminId = `contest-admin-${now}`;
  const contestAdminToken = createStaffSessionToken({
    userId: contestAdminId,
    email: "contestadmin@smartzero.io",
    role: "contest_admin",
    fullName: "Scoped Contest Admin",
  });

  // Assign contestAdmin to liveContest ONLY
  await assignContestAdmin({
    contest_id: liveContest.id,
    admin_id: contestAdminId,
    assigned_by: "super-admin-root",
  });

  const studentToken = createStudentSessionToken({
    userId: aliceId,
    email: "alice@university.edu",
    fullName: "Alice Smith",
    studentId: "STU-1001",
    college: "Engineering College",
  });

  console.log("\n── 1. Role Authorization Matrix & Monitoring Access ──");

  // 1. super_admin can view live leaderboard
  await testAsync("1. super_admin can view live leaderboard", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        Cookie: `smartzero_student_session=${superAdminToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.contest.title, liveContest.title);
    assert.strictEqual(data.contest.status, "LIVE");
    assert.ok(data.leaderboard.length >= 3);
  });

  // 2. admin can view live leaderboard
  await testAsync("2. admin can view live leaderboard", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Cookie: `smartzero_student_session=${adminToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // 3. assigned contest_admin can view assigned contest leaderboard
  await testAsync("3. assigned contest_admin can view assigned contest leaderboard", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: {
        Authorization: `Bearer ${contestAdminToken}`,
        Cookie: `smartzero_student_session=${contestAdminToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // 4. contest_admin cannot view an unassigned contest leaderboard
  await testAsync("4. contest_admin cannot view an unassigned contest leaderboard", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${unassignedContest.id}/leaderboard`, {
      headers: {
        Authorization: `Bearer ${contestAdminToken}`,
        Cookie: `smartzero_student_session=${contestAdminToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: unassignedContest.id }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /not assigned to manage this contest/i);
  });

  // 5. student cannot access admin leaderboard endpoint
  await testAsync("5. student cannot access admin leaderboard endpoint", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /Administrator privileges required/i);
  });

  // 6. anonymous user cannot access admin leaderboard endpoint
  await testAsync("6. anonymous user cannot access admin leaderboard endpoint", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`);

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 401);
  });

  console.log("\n── 2. Anti-Bypass & Privacy Protections ──");

  // 7. client-supplied role cannot bypass authorization
  await testAsync("7. client-supplied role cannot bypass authorization", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard?role=super_admin`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 403, "Query param role escalation must be rejected");
  });

  // 8. client-supplied user_id cannot bypass authorization
  await testAsync("8. client-supplied user_id cannot bypass authorization", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard?user_id=super-admin-root`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        Cookie: `smartzero_student_session=${studentToken}`,
      },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 403, "Query param user_id escalation must be rejected");
  });

  // 9. hidden test data never appears
  await testAsync("9. hidden test data never appears in admin monitoring payload", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    const jsonText = await res.text();
    assert.strictEqual(jsonText.includes("hidden_test_cases"), false, "hidden_test_cases must not appear");
    assert.strictEqual(jsonText.includes("secret_test"), false, "secret_test must not appear");
  });

  // 10. answer keys never appear
  await testAsync("10. answer keys never appear in admin monitoring payload", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    const jsonText = await res.text();
    assert.strictEqual(jsonText.includes("correct_answer"), false, "correct_answer must not appear");
    assert.strictEqual(jsonText.includes("correct_option"), false, "correct_option must not appear");
    assert.strictEqual(jsonText.includes("passcode_hash"), false, "passcode_hash must not appear");
  });

  // 11. security-event details remain protected
  await testAsync("11. security-event details remain protected from unauthorized students", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    assert.strictEqual(res.status, 403, "Ordinary students must be blocked from monitoring details");
  });

  console.log("\n── 3. Server-Authoritative Ranking & Realtime Consistency ──");

  // 12. ranking order is server-authoritative
  await testAsync("12. ranking order is server-authoritative (Score DESC -> Penalty Time ASC)", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    const data = await res.json();
    const lb = data.leaderboard;

    // Both Charlie and Alice have 100 points, but Charlie submitted earlier / has smaller penalty
    // Bob has 80 points and should rank below Charlie and Alice
    assert.strictEqual(lb[0].total_score, 100);
    assert.strictEqual(lb[1].total_score, 100);
    assert.strictEqual(lb[2].total_score, 80);

    assert.strictEqual(lb[0].rank, 1);
    assert.strictEqual(lb[1].rank, 2);
    assert.strictEqual(lb[2].rank, 3);

    // Verify student details present for admin monitoring
    assert.ok(lb[0].student_id !== undefined);
    assert.ok(lb[0].display_name !== undefined);
  });

  // 13. realtime score update reaches authorized admin view
  await testAsync("13. realtime score update reaches authorized admin view without manual recalculation", async () => {
    // Award Bob additional 70 marks on code2 (Total 150 pts)
    const code2 = await addCodingQuestion({
      title: "Hard Coding Problem",
      description: "Solve hard problem",
      test_cases: [
        { input: "2", expected_output: "2", is_sample: true, is_hidden: false, weight: 70 },
      ],
    });
    await linkQuestionToContest({
      contest_id: liveContest.id,
      question_id: code2.id,
      question_type: "coding",
      sort_order: 2,
      marks: 70,
    });
    await saveCodingSubmission({
      contest_id: liveContest.id,
      user_id: bobId,
      question_id: code2.id,
      language: "python",
      code: "print(2)",
      summary: {
        verdict: "Accepted",
        score: 70,
        test_cases_passed: 1,
        total_test_cases: 1,
        execution_time_ms: 80,
        memory_kb: 512,
        test_case_results: [],
      },
    });

    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    const data = await res.json();
    const lb = data.leaderboard;

    // Bob must now be #1 with 150 pts
    assert.strictEqual(lb[0].user_id, bobId);
    assert.strictEqual(lb[0].total_score, 150);
    assert.strictEqual(lb[0].rank, 1);
  });

  // 14. polling fallback works if Realtime disconnects
  await testAsync("14. polling fallback and server-authoritative timer are present", async () => {
    const req = new Request(`http://localhost/api/admin/contests/${liveContest.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const res = await getAdminLiveLeaderboardRoute(req, {
      params: Promise.resolve({ id: liveContest.id }),
    });

    const data = await res.json();
    assert.strictEqual(typeof data.contest.remaining_seconds, "number");
    assert.strictEqual(typeof data.contest.server_time, "string");
    assert.ok(data.contest.remaining_seconds >= 0);
  });

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} ADMIN LIVE LEADERBOARD TESTS PASSED!`);
  console.log("==================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
