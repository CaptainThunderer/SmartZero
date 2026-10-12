import fs from "node:fs";
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
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  createContest,
  deleteContest,
  registerContestParticipant,
  startContestExam,
  recordMcqAnswer,
  getStudentAnswers,
  calculateStudentMcqScore,
  calculateStudentCodingScore,
  submitContestExam,
  getParticipant,
  addMcqQuestion,
  linkQuestionToContest,
} from "../lib/contest/service";
import {
  saveCodingSubmission,
  saveCodingDraft,
  getStudentSubmissions,
} from "../lib/judge/service";
import { getContestLeaderboard } from "../lib/contest/leaderboard";

let testCount = 0;
function pass(msg: string) {
  testCount++;
  console.log(`  ✅ [${testCount}] ${msg}`);
}

async function runE2ETests() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("================================================================================");
  console.log("SMARTZERO 2.0 — FINAL CONSOLIDATED END-TO-END RELEASE TEST");
  console.log("================================================================================\n");

  // ─────────────────────────────────────────────────────────────
  // PHASE A: Historical Beta Score Invariant Check
  // ─────────────────────────────────────────────────────────────
  console.log("── Invariant Check: Historical Beta Contest Scores ──");
  const betaContestId = "53ddc9ea-6672-434d-9933-22c83f8ebd65";
  const { data: betaParts } = await supabase
    .from("contest_participants")
    .select("user_id, contest_id, score, status, user_profile:profiles(*)")
    .eq("contest_id", betaContestId);

  const thunderer = betaParts?.find((p: any) => (Array.isArray(p.user_profile) ? p.user_profile[0]?.email : p.user_profile?.email) === "captainthunderer@gmail.com");
  const sushma = betaParts?.find((p: any) => (Array.isArray(p.user_profile) ? p.user_profile[0]?.email : p.user_profile?.email) === "24311a6710@ds.sreenidhi.edu.in");
  assert.equal(thunderer?.score, 46, "Captain Thunderer score must be strictly preserved at 46");
  assert.equal(sushma?.score, 51, "Sushma Gopireddy score must be strictly preserved at 51");
  pass("Captain Thunderer frozen score (46) is verified intact");
  pass("Sushma Gopireddy frozen score (51) is verified intact");

  // ─────────────────────────────────────────────────────────────
  // PHASE B: Setup Ephemeral Isolated Test Contest in Live DB
  // ─────────────────────────────────────────────────────────────
  console.log("\n── Test 1: Database & Submission Persistence (Live Supabase) ──");
  (process.env as Record<string, string | undefined>).NODE_ENV = "production"; // Enforce strict production fail-closed database mode
  const now = Date.now();
  const contestStartTime = new Date(now - 3600_000).toISOString();
  const contestEndTime = new Date(now + 7200_000).toISOString();

  const testContest = await createContest({
    title: `E2E Release Test Contest ${now}`,
    description: "Automated end-to-end verification contest",
    start_at: contestStartTime,
    end_at: contestEndTime,
    duration_minutes: 120,
    passcode: "E2E-RELEASE",
    status: "PUBLISHED",
  });
  assert(testContest?.id, "Failed to create isolated test contest");
  pass(`Created isolated test contest in live DB (ID: ${testContest.id})`);

  try {
    // 1. Provision Questions: 1 real MCQ, 1 real Python, 1 real SQL
    const { data: sampleMcq } = await supabase
      .from("mcq_questions")
      .select("id, options:mcq_options(id, is_correct)")
      .limit(1)
      .single();
    assert(sampleMcq?.id, "Need at least 1 MCQ in question bank");
    const correctOpt = sampleMcq.options?.find((o: any) => o.is_correct) || sampleMcq.options?.[0];
    assert(correctOpt?.id, "MCQ must have options in database");

    await linkQuestionToContest({
      contest_id: testContest.id,
      question_id: sampleMcq.id,
      question_type: "mcq",
      sort_order: 1,
      marks: 4,
    });
    pass("Linked real MCQ question with authoritative correct option");

    // Link real Python question and real SQL question from question banks
    const { data: sampleCodingQ } = await supabase.from("coding_questions").select("id").limit(1).single();
    const { data: sampleSqlQ } = await supabase.from("sql_questions").select("id").limit(1).single();
    assert(sampleCodingQ?.id, "Need at least 1 coding question in question bank");
    assert(sampleSqlQ?.id, "Need at least 1 sql question in question bank");

    await linkQuestionToContest({
      contest_id: testContest.id,
      question_id: sampleCodingQ.id,
      question_type: "coding",
      sort_order: 2,
      marks: 10,
    });
    await linkQuestionToContest({
      contest_id: testContest.id,
      question_id: sampleSqlQ.id,
      question_type: "sql",
      sort_order: 3,
      marks: 10,
    });
    pass("Linked Python and SQL questions to test contest");

    // 2. Register Dedicated Test Student
    const testUserId = thunderer!.user_id; // Use existing auth profile ID
    const reg = await registerContestParticipant({
      contest_id: testContest.id,
      user_id: testUserId,
      passcode: "E2E-RELEASE",
    });
    assert(reg.participant, "Participant registration failed");
    pass("Registered dedicated test student in test contest");

    await startContestExam({ contest_id: testContest.id, user_id: testUserId });
    pass("Student started contest exam (status: in_exam)");

    // 3. Submit MCQ Answer
    const mcqRes = await recordMcqAnswer({
      contest_id: testContest.id,
      user_id: testUserId,
      question_id: sampleMcq.id,
      selected_option_id: correctOpt.id,
    });
    assert.equal(mcqRes.error, null, "MCQ submission failed: " + mcqRes.error);
    pass("Submitted correct MCQ option");

    // Verify row in Supabase table mcq_answers
    const { data: mcqDbRow } = await supabase
      .from("mcq_answers")
      .select("*")
      .eq("contest_id", testContest.id)
      .eq("user_id", testUserId)
      .eq("question_id", sampleMcq.id)
      .single();
    assert(mcqDbRow, "MCQ answer was not found in Supabase mcq_answers table");
    assert.equal(mcqDbRow.selected_option_id, correctOpt.id);
    pass("Empirically verified MCQ row stored persistently in Supabase mcq_answers");

    // 4. Submit Python Coding Answer
    const pySub = await saveCodingSubmission({
      contest_id: testContest.id,
      user_id: testUserId,
      question_id: sampleCodingQ.id,
      language: "python",
      code: "print('E2E_PYTHON_PASSED')",
      summary: {
        verdict: "Accepted",
        score: 10,
        test_cases_passed: 4,
        total_test_cases: 4,
        execution_time_ms: 120,
        memory_kb: 512,
        test_case_results: [],
      },
    });
    assert(pySub.id, "Python submission failed to return ID");
    pass("Python submission recorded via saveCodingSubmission");

    // Verify row in Supabase table coding_submissions
    const { data: pyDbRow } = await supabase
      .from("coding_submissions")
      .select("*")
      .eq("id", pySub.id)
      .single();
    assert(pyDbRow, "Python submission not found in Supabase coding_submissions table");
    assert.equal(pyDbRow.verdict, "Accepted");
    assert.equal(pyDbRow.score, 10);
    assert.equal(pyDbRow.language, "python");
    assert.equal(pyDbRow.code, "print('E2E_PYTHON_PASSED')");
    pass("Empirically verified Python submission persistently in Supabase coding_submissions");

    // 5. Submit SQL Coding Answer (Referencing real sql_questions row)
    const sqlSub = await saveCodingSubmission({
      contest_id: testContest.id,
      user_id: testUserId,
      question_id: sampleSqlQ.id,
      language: "sql",
      code: "SELECT department, COUNT(*) FROM employees GROUP BY department;",
      summary: {
        verdict: "Accepted",
        score: 10,
        test_cases_passed: 5,
        total_test_cases: 5,
        execution_time_ms: 45,
        memory_kb: 256,
        test_case_results: [],
      },
    });
    assert(sqlSub.id, "SQL submission failed to return ID");
    pass("SQL submission recorded referencing sql_questions row");

    // Verify row in Supabase table coding_submissions
    const { data: sqlDbRow } = await supabase
      .from("coding_submissions")
      .select("*")
      .eq("id", sqlSub.id)
      .single();
    assert(sqlDbRow, "SQL submission not found in Supabase coding_submissions table");
    assert.equal(sqlDbRow.verdict, "Accepted");
    assert.equal(sqlDbRow.score, 10);
    assert.equal(sqlDbRow.language, "sql");
    assert.equal(sqlDbRow.question_id, sampleSqlQ.id);
    pass("Empirically verified SQL submission persistently in Supabase coding_submissions (Polymorphic FK active)");

    // 6. Simulate Refresh & Retrieve Submissions
    const rehydratedAnswers = await getStudentAnswers(testContest.id, testUserId);
    assert.equal(rehydratedAnswers.length, 1);
    assert.equal(rehydratedAnswers[0].selected_option_id, correctOpt.id);
    pass("Re-opened contest retrieved persistent MCQ answers directly from Supabase");

    const rehydratedCoding = await getStudentSubmissions(testContest.id, testUserId);
    assert.equal(rehydratedCoding.length, 2);
    const rehydratedPy = rehydratedCoding.find((s) => s.language === "python");
    const rehydratedSql = rehydratedCoding.find((s) => s.language === "sql");
    assert(rehydratedPy && rehydratedPy.verdict === "Accepted" && rehydratedPy.score === 10);
    assert(rehydratedSql && rehydratedSql.verdict === "Accepted" && rehydratedSql.score === 10);
    pass("Re-opened contest retrieved persistent Python and SQL submissions from Supabase");

    // ─────────────────────────────────────────────────────────────
    // PHASE C: Test 2 — Grading & Marks Calculation
    // ─────────────────────────────────────────────────────────────
    console.log("\n── Test 2: Grading Correctness ──");
    const mcqScore = await calculateStudentMcqScore(testContest.id, testUserId);
    assert.equal(mcqScore.totalScore, 4, "MCQ score should be exactly 4");
    assert.equal(mcqScore.correctCount, 1);
    assert.equal(mcqScore.incorrectCount, 0);
    pass("MCQ grading awarded exactly 4 marks for correct choice");

    const codingScore = await calculateStudentCodingScore(testContest.id, testUserId);
    assert.equal(codingScore.totalScore, 20, "Coding score should be 10 (Python) + 10 (SQL) = 20");
    assert.equal(codingScore.submittedCount, 2);
    pass("Coding grading awarded exactly 20 marks (10 Python + 10 SQL)");

    // Partial marks test: Submit partial score for Python
    const partialSub = await saveCodingSubmission({
      contest_id: testContest.id,
      user_id: testUserId,
      question_id: sampleCodingQ.id,
      language: "python",
      code: "print('PARTIAL')",
      summary: {
        verdict: "Partial Accepted",
        score: 5,
        test_cases_passed: 2,
        total_test_cases: 4,
        execution_time_ms: 100,
        memory_kb: 512,
        test_case_results: [],
      },
    });
    // Max score per question should preserve the earlier Accepted (10)
    const codingScoreAfterPartial = await calculateStudentCodingScore(testContest.id, testUserId);
    assert.equal(codingScoreAfterPartial.totalScore, 20, "Best-of score must retain 10 marks instead of demoting to 5");
    pass("Best-of grading preserves higher Accepted score (10) over subsequent lower attempt (5)");

    // ─────────────────────────────────────────────────────────────
    // PHASE D: Test 3 & 4 — Realtime Leaderboard & Score Integrity
    // ─────────────────────────────────────────────────────────────
    console.log("\n── Test 3 & 4: Real-time Leaderboard & Score Integrity ──");

    // Leaderboard calculation
    const lb = await getContestLeaderboard(testContest.id, "admin");
    assert.equal(lb.leaderboard.length, 1);
    const entry = lb.leaderboard[0];
    assert.equal(entry.total_score, 24, "Total score must be 4 MCQ + 20 Coding = 24");
    assert.equal(entry.solved_count, 3, "Solved count must be 1 MCQ + 2 Coding = 3");
    pass("Leaderboard reflects exact authoritative sum: 24 points, 3 solved questions");

    // Draft exclusion
    await saveCodingDraft({
      contest_id: testContest.id,
      user_id: testUserId,
      question_id: sampleCodingQ.id,
      language: "python",
      code: "# In-progress draft",
    });
    const lbAfterDraft = await getContestLeaderboard(testContest.id, "admin");
    assert.equal(lbAfterDraft.leaderboard[0].total_score, 24, "Draft submission must not alter leaderboard score");
    pass("Draft submissions are strictly excluded from leaderboard score");

    // Finalize Exam
    const finalization1 = await submitContestExam({ contest_id: testContest.id, user_id: testUserId, reason: "manual" });
    assert.equal(finalization1.success, true);
    assert.equal(finalization1.score?.totalScore, 24);
    pass("Finalization evaluates authoritative total score: 24 points");

    // Repeat finalization (Idempotency)
    const finalization2 = await submitContestExam({ contest_id: testContest.id, user_id: testUserId, reason: "manual" });
    assert.equal(finalization2.score?.totalScore, 24, "Repeat finalization must not duplicate score");
    pass("Repeat finalization is idempotent and does not duplicate score");

    // Verify participant score in Supabase
    const { data: participantDbRow } = await supabase
      .from("contest_participants")
      .select("score, status")
      .eq("contest_id", testContest.id)
      .eq("user_id", testUserId)
      .single();
    assert.equal(participantDbRow?.score, 24, "Participant score in Supabase must be 24");
    assert.equal(participantDbRow?.status, "submitted", "Participant status in Supabase must be submitted");
    pass("Empirically verified final participant record in Supabase (score: 24, status: submitted)");

  } finally {
    // Clean up isolated test contest completely
    console.log("\n── Cleanup: Removing isolated test contest ──");
    await deleteContest(testContest.id, { force: true });
    pass("Cleaned up isolated test contest and its test submissions from live database");
  }

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${testCount} END-TO-END RELEASE ASSERTIONS PASSED!`);
  console.log("================================================================================\n");
}

runE2ETests().catch((err) => {
  console.error("E2E Release Test Failed:", err);
  process.exit(1);
});
