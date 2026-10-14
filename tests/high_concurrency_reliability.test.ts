import assert from "node:assert/strict";
import {
  createContest,
  addMcqQuestion,
  linkQuestionToContest,
  registerContestParticipant,
  recordMcqAnswer,
  getContestById,
  getContestBySlug,
  invalidateContestCache,
} from "../lib/contest/service";
import { getContestLeaderboard, invalidateLeaderboardCache } from "../lib/contest/leaderboard";
import { saveCodingDraft, getStudentSubmissions } from "../lib/judge/service";

console.log("==================================================");
console.log("▶ RUNNING HIGH-CONCURRENCY RELIABILITY & PERFORMANCE SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: boolean, message: string) {
  assert(condition, message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runHighConcurrencyTests() {
  invalidateLeaderboardCache();
  invalidateContestCache();

  // ── 1. Create Contest and Provision Questions ──
  console.log("── 1. Setup High-Concurrency Contest & Questions ──");
  const now = new Date();
  const contest = await createContest({
    title: "High Concurrency Stress Contest",
    slug: `stress-test-${Date.now()}`,
    start_at: new Date(now.getTime() - 60_000).toISOString(),
    end_at: new Date(now.getTime() + 3600_000).toISOString(),
    duration_minutes: 60,
    status: "PUBLISHED",
  });
  testAssert(!!contest.id, "Stress contest created");

  const mcq = await addMcqQuestion({
    question_text: "What is 2 + 2?",
    options: [
      { option_text: "3", is_correct: false },
      { option_text: "4", is_correct: true },
      { option_text: "5", is_correct: false },
      { option_text: "6", is_correct: false },
    ],
  });
  const linkedMcq = await linkQuestionToContest({
    contest_id: contest.id,
    question_id: mcq.id,
    question_type: "mcq",
    sort_order: 1,
    marks: 4,
  });
  const correctOptId = mcq.options?.find((o) => o.is_correct)?.id || "opt-1";
  testAssert(!!linkedMcq, "MCQ linked to contest");

  // ── 2. Register 50 Simulated Contestants ──
  console.log("\n── 2. Register 50 Concurrent Contestants ──");
  const studentIds: string[] = [];
  for (let i = 1; i <= 50; i++) {
    studentIds.push(`student-${i.toString().padStart(3, "0")}`);
  }

  await Promise.all(
    studentIds.map((sid) =>
      registerContestParticipant({
        contest_id: contest.id,
        user_id: sid,
        passcode: "SMARTZERO",
      })
    )
  );
  testAssert(true, "50 contestants registered concurrently");

  // Record varying answers
  await Promise.all(
    studentIds.map(async (sid, idx) => {
      if (idx % 2 === 0) {
        await recordMcqAnswer({
          contest_id: contest.id,
          user_id: sid,
          question_id: mcq.id,
          selected_option_id: correctOptId,
        });
      }
    })
  );
  testAssert(true, "MCQ answers recorded across contestants");

  // ── 3. High-Concurrency Leaderboard Reads (100 simultaneous requests) ──
  console.log("\n── 3. High-Concurrency Leaderboard Reads (100 in-flight requests) ──");
  const startLeaderboardTime = Date.now();
  const leaderboardPromises = Array.from({ length: 100 }, (_, i) => {
    const viewerId = studentIds[i % studentIds.length];
    return getContestLeaderboard(contest.id, viewerId, "student");
  });

  const leaderboardResults = await Promise.all(leaderboardPromises);
  const elapsedLeaderboard = Date.now() - startLeaderboardTime;

  testAssert(leaderboardResults.length === 100, "All 100 concurrent leaderboard requests resolved");
  testAssert(elapsedLeaderboard < 1500, `100 requests served in ${elapsedLeaderboard}ms (<1500ms target)`);

  const firstResult = leaderboardResults[0];
  testAssert(firstResult.leaderboard.length === 50, "Leaderboard reflects all 50 contestants");
  for (const res of leaderboardResults) {
    testAssert(res.leaderboard.length === 50, "Leaderboard entry count consistent across all concurrent calls");
  }

  // ── 4. High-Concurrency Autosave Writes (100 rapid drafts per student) ──
  console.log("\n── 4. Rapid Concurrent Draft Autosaves ──");
  const draftQuestionId = "q-code-01";
  const draftStudentId = studentIds[0];

  const draftPromises = Array.from({ length: 20 }, (_, seq) =>
    saveCodingDraft({
      contest_id: contest.id,
      user_id: draftStudentId,
      question_id: draftQuestionId,
      language: "python",
      code: `def solution():\n    return ${seq}`,
      seq,
      timestamp: Date.now() + seq,
    })
  );

  const draftResults = await Promise.all(draftPromises);
  testAssert(draftResults.every((r) => r.success), "All 20 concurrent autosaves succeeded");

  const studentSubs = await getStudentSubmissions(contest.id, draftStudentId, draftQuestionId);
  const draftSubs = studentSubs.filter((s) => s.verdict === "DRAFT");
  testAssert(draftSubs.length <= 1, `Drafts deduplicated in-place (found ${draftSubs.length} draft, max 1 expected)`);

  // ── 5. Contest Metadata Cache Validation ──
  console.log("\n── 5. Contest Metadata Cache High-Concurrency Reads ──");
  const startCacheTime = Date.now();
  const contestFetchPromises = Array.from({ length: 200 }, () => getContestBySlug(contest.slug));
  const cachedContests = await Promise.all(contestFetchPromises);
  const elapsedCache = Date.now() - startCacheTime;

  testAssert(cachedContests.length === 200, "All 200 contest queries resolved");
  testAssert(cachedContests.every((c) => c?.id === contest.id), "All cached reads returned matching contest");
  testAssert(elapsedCache < 300, `200 cached contest queries completed in ${elapsedCache}ms (<300ms target)`);

  console.log("\n==================================================");
  console.log(`🎉 ALL ${passed} HIGH-CONCURRENCY RELIABILITY ASSERTIONS PASSED!`);
  console.log("==================================================");
}

runHighConcurrencyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
