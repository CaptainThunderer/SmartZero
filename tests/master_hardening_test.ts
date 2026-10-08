/**
 * SMARTZERO 2.0 â€” MASTER PRODUCTION HARDENING TEST SUITE
 *
 * Verifies:
 * - Phase 3: Anonymous & Public Leaderboard Server-Side Enforcement
 * - Phase 4: Single-student Coding IDE E2E Flow
 * - Phase 5: Autosave Race Conditions & Latest-Write-Wins Protection
 * - Phase 6: All 5 Language Runtimes Deterministic Execution
 * - Phase 7: Server-Authoritative Deadline & Multi-Attempt Retake Lifecycle
 * - Phase 8: Identity Spoofing & Security Data Leak Protection
 */

import assert from "node:assert/strict";
import {
  createContest,
  registerContestParticipant,
  getParticipant,
  getEffectiveAttemptDeadline,
  startNewAttempt,
  canStartNewAttempt,
  submitContestExam,
  addCodingQuestion,
  linkQuestionToContest,
  getContestQuestions,
} from "../lib/contest/service";
import { saveCodingDraft, getStudentSubmissions } from "../lib/judge/service";
import { createStudentSessionToken, createStaffSessionToken } from "../lib/auth/studentSession";
import { GET as leaderboardRoute } from "../app/api/contest/[slug]/leaderboard/route";
import { POST as codingSubmitRoute } from "../app/api/contest/[slug]/coding/submit/route";
import { POST as codingRunRoute } from "../app/api/contest/[slug]/coding/run/route";
import { GET as codingSubmissionsRoute } from "../app/api/contest/[slug]/coding/submissions/route";
import { POST as finishRoute } from "../app/api/contest/[slug]/finish/route";
import { GET as questionsRoute } from "../app/api/contest/[slug]/questions/route";
import { GET as resultsRoute } from "../app/api/contest/[slug]/results/route";
import { GET as studentDashboardRoute } from "../app/api/student/dashboard/route";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

let passedCount = 0;
function check(condition: boolean, msg: string) {
  assert(condition, msg);
  console.log(`  ✅ ${msg}`);
  passedCount++;
}

async function runMasterHardeningSuite() {
  process.env.JUDGE_WORKER_URL = process.env.JUDGE_WORKER_URL || "http://127.0.0.1:8080";
  process.env.JUDGE_WORKER_SECRET = process.env.JUDGE_WORKER_SECRET || "mock-test-judge-secret-not-for-production";

  console.log("==================================================");
  console.log("SMARTZERO 2.0 â€” MASTER PRODUCTION HARDENING SUITE");
  console.log("==================================================\n");

  const studentAId = `stu-a-${Date.now()}`;
  const studentBId = `stu-b-${Date.now()}`;
  const adminId = `admin-${Date.now()}`;

  const tokenA = createStudentSessionToken({ sub: studentAId, email: "studentA@test.edu" });
  const tokenB = createStudentSessionToken({ sub: studentBId, email: "studentB@test.edu" });
  const tokenAdmin = createStaffSessionToken({ userId: adminId, email: "admin@test.edu", role: "admin" });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 3 â€” ANONYMOUS VS PUBLIC LEADERBOARD SERVER-SIDE ENFORCEMENT
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  console.log("â”€â”€ Phase 3: Anonymous vs Public Leaderboard â”€â”€");

  const pubContest = await createContest({
    title: "Public Leaderboard Contest",
    start_at: new Date(Date.now() - 3600_000).toISOString(),
    end_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_minutes: 60,
    status: "LIVE",
    passcode: "PUB-PASS",
    leaderboard_visibility: "PUBLIC",
  });
  check(pubContest.leaderboard_visibility === "PUBLIC", "Public contest created with leaderboard_visibility=PUBLIC");

  const anonContest = await createContest({
    title: "Anonymous Leaderboard Contest",
    start_at: new Date(Date.now() - 3600_000).toISOString(),
    end_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_minutes: 60,
    status: "LIVE",
    passcode: "ANON-PASS",
    leaderboard_visibility: "ANONYMOUS",
  });
  check(anonContest.leaderboard_visibility === "ANONYMOUS", "Anonymous contest created with leaderboard_visibility=ANONYMOUS");

  // Register participants in both contests
  await registerContestParticipant({ contest_id: pubContest.id, user_id: studentAId, passcode: "PUB-PASS" });
  await registerContestParticipant({ contest_id: anonContest.id, user_id: studentAId, passcode: "ANON-PASS" });

  // 1. Student calls GET /api/contest/[slug]/leaderboard on PUBLIC contest
  const reqPubLead = new Request(`http://localhost/api/contest/${pubContest.slug}/leaderboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const resPubLead = await leaderboardRoute(reqPubLead, { params: Promise.resolve({ slug: pubContest.slug }) });
  const dataPubLead = await resPubLead.json();
  check(resPubLead.status === 200, "Public contest leaderboard returns 200");
  check(dataPubLead.leaderboard_visibility === "PUBLIC", "Public contest reports visibility=PUBLIC");
  check(Array.isArray(dataPubLead.leaderboard), "Public contest returns leaderboard array");

  // 2. Student calls GET /api/contest/[slug]/leaderboard on ANONYMOUS contest
  const reqAnonLeadStudent = new Request(`http://localhost/api/contest/${anonContest.slug}/leaderboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const resAnonLeadStudent = await leaderboardRoute(reqAnonLeadStudent, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataAnonLeadStudent = await resAnonLeadStudent.json();
  check(resAnonLeadStudent.status === 200, "Anonymous contest leaderboard returns 200");
  check(dataAnonLeadStudent.leaderboard_visibility === "ANONYMOUS", "Anonymous contest reports visibility=ANONYMOUS");
  check(dataAnonLeadStudent.leaderboard.length === 0, "Student receives EMPTY leaderboard array in anonymous mode");
  check(dataAnonLeadStudent.currentUserRank === null, "Student receives null currentUserRank in anonymous mode");
  check(dataAnonLeadStudent.currentUserScore === null, "Student receives null currentUserScore in anonymous mode");
  check(dataAnonLeadStudent.totalParticipants === 0, "Student receives totalParticipants=0 in anonymous mode");

  // 3. Admin calls GET /api/contest/[slug]/leaderboard on ANONYMOUS contest
  const reqAnonLeadAdmin = new Request(`http://localhost/api/contest/${anonContest.slug}/leaderboard`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  const resAnonLeadAdmin = await leaderboardRoute(reqAnonLeadAdmin, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataAnonLeadAdmin = await resAnonLeadAdmin.json();
  check(resAnonLeadAdmin.status === 200, "Admin accessing anonymous contest returns 200");
  check(dataAnonLeadAdmin.leaderboard.length >= 1, "Admin receives FULL leaderboard entries for anonymous contest");

  // 4. Create a coding question in anonymous contest
  const codeQ = await addCodingQuestion({
    title: "Add Numbers",
    description: "Read a and b, print sum",
    input_format: "a b",
    output_format: "sum",
    constraints: "1 <= a, b <= 100",
    difficulty: "Easy",
    time_limit_ms: 2000,
    memory_limit_mb: 256,
    test_cases: [
      { input: "3 4\n", expected_output: "7", is_sample: true, is_hidden: false, weight: 1 },
      { input: "10 20\n", expected_output: "30", is_sample: false, is_hidden: true, weight: 2 },
    ],
  });
  await linkQuestionToContest({
    contest_id: anonContest.id,
    question_id: codeQ.id,
    question_type: "coding",
    marks: 30,
    negative_marks: 0,
    sort_order: 1,
  });

  // 5. Student submits code in anonymous contest -> verify awarded points stripped from response
  const reqAnonSub = new Request(`http://localhost/api/contest/${anonContest.slug}/coding/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      question_id: codeQ.id,
      language: "python",
      code: "a,b=map(int,input().split())\nprint(a+b)",
      user_id: studentAId,
    }),
  });
  const resAnonSub = await codingSubmitRoute(reqAnonSub, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataAnonSub = await resAnonSub.json();
  check(resAnonSub.status === 200, "Submission in anonymous contest succeeded (200)");
  check(dataAnonSub.submission.verdict === "Accepted", "Submission verdict is Accepted");
  check(dataAnonSub.submission.score === undefined, "Awarded score is STRICTLY STRIPPED from response in anonymous contest");

  // 6. Student queries submissions list in anonymous contest -> verify score is stripped
  const reqAnonSubList = new Request(`http://localhost/api/contest/${anonContest.slug}/coding/submissions?question_id=${codeQ.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const resAnonSubList = await codingSubmissionsRoute(reqAnonSubList, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataAnonSubList = await resAnonSubList.json();
  check(dataAnonSubList.submissions.length > 0, "Submissions history retrieved");
  check(dataAnonSubList.submissions[0].score === undefined, "Score is STRICTLY STRIPPED from submissions history in anonymous mode");

  // 7. Student finishes exam in anonymous contest -> verify score is stripped
  const reqAnonFinish = new Request(`http://localhost/api/contest/${anonContest.slug}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ user_id: studentAId, reason: "manual" }),
  });
  const resAnonFinish = await finishRoute(reqAnonFinish, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataAnonFinish = await resAnonFinish.json();
  check(dataAnonFinish.score === undefined, "Finish response does not leak final score in anonymous contest");
  check(dataAnonFinish.participant.score === undefined, "Participant score is STRICTLY OMITTED in finish response in anonymous mode");

  // 8. Student queries results API in anonymous contest -> verify score, rank, percentile, marks are stripped
  const reqAnonResults = new Request(`http://localhost/api/contest/${anonContest.slug}/results?user_id=${studentAId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const resAnonResults = await resultsRoute(reqAnonResults, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataAnonResults = await resAnonResults.json();
  check(dataAnonResults.result.total_score === undefined, "Total score strictly omitted from results API in anonymous mode");
  check(dataAnonResults.result.rank === undefined, "Rank strictly omitted from results API in anonymous mode");
  check(dataAnonResults.result.percentile === undefined, "Percentile strictly omitted from results API in anonymous mode");
  check(dataAnonResults.result.question_performance[0]?.earned_marks === undefined, "Earned marks strictly omitted from question performance in anonymous mode");

  // 9. Student dashboard API -> verify recent contests has no score for anonymous contest
  const reqDashboard = new Request(`http://localhost/api/student/dashboard?user_id=${studentAId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const resDashboard = await studentDashboardRoute(reqDashboard);
  const dataDashboard = await resDashboard.json();
  const anonRecent = dataDashboard.recent_contests.find((c: any) => c.contest_id === anonContest.id);
  check(anonRecent !== undefined, "Anonymous contest appears in student dashboard recent contests");
  check(anonRecent.score === undefined, "Score is strictly omitted from recent contests for anonymous contest");

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 4 & 5 â€” CODING IDE AUTOSAVE RACE CONDITIONS & RECOVERY
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  console.log("\nâ”€â”€ Phase 4 & 5: Autosave Race-Safety & Latest-Write-Wins â”€â”€");

  // 1. Normal sequential draft save
  const draft1 = await saveCodingDraft({
    contest_id: pubContest.id,
    user_id: studentAId,
    question_id: codeQ.id,
    language: "python",
    code: "version_1 = True",
    seq: 1,
    timestamp: 1000,
  });
  check(draft1.success, "Draft version 1 saved successfully");

  // 2. Draft version 3 arrives
  const draft3 = await saveCodingDraft({
    contest_id: pubContest.id,
    user_id: studentAId,
    question_id: codeQ.id,
    language: "python",
    code: "version_3 = True",
    seq: 3,
    timestamp: 3000,
  });
  check(draft3.success, "Draft version 3 saved successfully");

  // 3. Delayed draft version 2 arrives LATER (network jitter / out-of-order packet)
  const draft2 = await saveCodingDraft({
    contest_id: pubContest.id,
    user_id: studentAId,
    question_id: codeQ.id,
    language: "python",
    code: "version_2 = True",
    seq: 2,
    timestamp: 2000,
  });
  check(draft2.success, "Stale draft packet handled cleanly without error");

  // 4. Verify in-memory/database store preserved Version 3 (latest-write-wins)
  const storedSubs = await getStudentSubmissions(pubContest.id, studentAId, codeQ.id);
  const draftRecord = storedSubs.find((s) => s.verdict === "DRAFT");
  check(draftRecord !== undefined, "Draft record found in student submissions");
  check(draftRecord?.code === "version_3 = True", "Latest write WON: Version 3 preserved, delayed Version 2 was discarded");

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 6 â€” ALL 5 LANGUAGE RUNTIMES DETERMINISTIC EXECUTION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  console.log("\nâ”€â”€ Phase 6: Deterministic Multi-Language Run & Submit â”€â”€");

  // 1. Python Run
  const pyRunReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ question_id: codeQ.id, language: "python", code: "a,b=map(int,input().split())\nprint(a+b)" }),
  });
  const pyRunRes = await codingRunRoute(pyRunReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const pyRunData = await pyRunRes.json();
  check(pyRunData.summary.verdict === "Accepted", "Python Run: Accepted");
  check(pyRunData.summary.score === 0, "Interactive Run: score is 0 (does not alter contest marks)");

  // 2. JavaScript Run
  const jsRunReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      question_id: codeQ.id,
      language: "javascript",
      code: "const fs=require('fs');const[a,b]=fs.readFileSync(0,'utf-8').trim().split(' ').map(Number);console.log(a+b);",
    }),
  });
  const jsRunRes = await codingRunRoute(jsRunReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const jsRunData = await jsRunRes.json();
  check(jsRunData.summary.verdict === "Accepted", "JavaScript Run: Accepted");

  // 3. TypeScript Run
  const tsRunReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      question_id: codeQ.id,
      language: "typescript",
      code: "import*as fs from'fs';const[a,b]=fs.readFileSync(0,'utf-8').trim().split(' ').map(Number);console.log(a+b);",
    }),
  });
  const tsRunRes = await codingRunRoute(tsRunReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const tsRunData = await tsRunRes.json();
  check(tsRunData.summary.verdict === "Accepted", "TypeScript Run: Accepted");

  // 4. C++ Run
  const cppRunReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      question_id: codeQ.id,
      language: "cpp",
      code: "#include<iostream>\nusing namespace std;int main(){int a,b;cin>>a>>b;cout<<a+b;}",
    }),
  });
  const cppRunRes = await codingRunRoute(cppRunReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const cppRunData = await cppRunRes.json();
  check(cppRunData.summary.verdict === "Accepted", "C++ Run: Accepted");

  // 5. Java Run
  const javaRunReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      question_id: codeQ.id,
      language: "java",
      code: "import java.util.Scanner;public class Main{public static void main(String[]a){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}",
    }),
  });
  const javaRunRes = await codingRunRoute(javaRunReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const javaRunData = await javaRunRes.json();
  check(javaRunData.summary.verdict === "Accepted", "Java Run: Accepted");

  // 6. Python Compilation / Syntax Error detection
  const pyErrReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ question_id: codeQ.id, language: "python", code: "def invalid_syntax(" }),
  });
  const pyErrRes = await codingRunRoute(pyErrReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const pyErrData = await pyErrRes.json();
  check(
    pyErrData.summary.verdict === "Compilation Error" || pyErrData.summary.verdict === "Runtime Error",
    "Python syntax error properly classified without crashing"
  );

  // 7. C++ Compilation Error detection
  const cppErrReq = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ question_id: codeQ.id, language: "cpp", code: "int main(){ invalid_cpp_code; }" }),
  });
  const cppErrRes = await codingRunRoute(cppErrReq, { params: Promise.resolve({ slug: pubContest.slug }) });
  const cppErrData = await cppErrRes.json();
  check(cppErrData.summary.verdict === "Compilation Error", "C++ compile error properly classified with compiler output");

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 7 â€” DEADLINE & MULTI-ATTEMPT RETAKE SERVER AUTHORITY
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  console.log("\nâ”€â”€ Phase 7: Deadline & Multi-Attempt Retake Lifecycle â”€â”€");

  // 1. Effective deadline calculation: min(started_at + duration, contest.end_at)
  const deadContest = {
    end_at: new Date(Date.now() + 600_000).toISOString(), // Ends in 10 minutes
    duration_minutes: 60, // 60-minute duration
  };
  const part1 = { started_at: new Date().toISOString() };
  const d1 = getEffectiveAttemptDeadline(deadContest, part1);
  check(
    Math.abs(d1.effectiveDeadline.getTime() - new Date(deadContest.end_at).getTime()) < 1000,
    "Deadline rule: When contest ends before attempt duration, contest.end_at strictly rules"
  );

  // 2. Attempt duration expires before contest end
  const longContest = {
    end_at: new Date(Date.now() + 7200_000).toISOString(), // Ends in 2 hours
    duration_minutes: 30, // 30-minute duration
  };
  const part2 = { started_at: new Date(Date.now() - 3600_000).toISOString() }; // Started 1 hour ago
  const d2 = getEffectiveAttemptDeadline(longContest, part2);
  check(d2.isExpired === true, "Deadline rule: When attempt duration passes, isExpired is true");

  // 3. Retake Lifecycle: allow_retake=true, max_attempts=3
  const retakeContest = await createContest({
    title: "Retake Lifecycle Contest",
    start_at: new Date(Date.now() - 3600_000).toISOString(),
    end_at: new Date(Date.now() + 3600_000).toISOString(),
    duration_minutes: 30,
    status: "LIVE",
    passcode: "RETAKE-PASS",
    allow_retake: true,
    max_attempts: 3,
  });

  const studentCId = `stu-c-${Date.now()}`;
  await registerContestParticipant({ contest_id: retakeContest.id, user_id: studentCId, passcode: "RETAKE-PASS" });

  // Finish Attempt 1
  await submitContestExam({ contest_id: retakeContest.id, user_id: studentCId, reason: "manual" });
  let part = await getParticipant(retakeContest.id, studentCId, true);
  check(part?.attempt_number === 1, "Attempt 1 completed");

  // Start Attempt 2
  const check2 = await canStartNewAttempt(retakeContest.id, studentCId);
  check(check2.can_retake === true, "canStartNewAttempt allowed for Attempt 2");
  const att2 = await startNewAttempt({ contest_id: retakeContest.id, user_id: studentCId });
  check(att2.participant?.attempt_number === 2, "Attempt 2 started on SAME participant row");
  check(att2.participant?.status === "ready", "Attempt 2 participant status reset to ready");

  // Finish Attempt 2
  await submitContestExam({ contest_id: retakeContest.id, user_id: studentCId, reason: "manual" });

  // Start Attempt 3
  const check3 = await canStartNewAttempt(retakeContest.id, studentCId);
  check(check3.can_retake === true, "canStartNewAttempt allowed for Attempt 3");
  const att3 = await startNewAttempt({ contest_id: retakeContest.id, user_id: studentCId });
  check(att3.participant?.attempt_number === 3, "Attempt 3 started on SAME participant row");

  // Finish Attempt 3
  await submitContestExam({ contest_id: retakeContest.id, user_id: studentCId, reason: "manual" });

  // Attempt 4 must be strictly REJECTED
  const check4 = await canStartNewAttempt(retakeContest.id, studentCId);
  check(check4.can_retake === false, "Attempt 4 REJECTED: reached maximum attempts (3)");
  const att4 = await startNewAttempt({ contest_id: retakeContest.id, user_id: studentCId });
  check(att4.participant === null, "startNewAttempt returns null participant for Attempt 4");
  check(att4.error?.includes("maximum number of attempts") === true, "Clear error message returned for exceeded attempts");

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 8 â€” IDENTITY SPOOFING & DATA LEAKAGE ATTACKS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  console.log("\nâ”€â”€ Phase 8: Identity Spoofing & Security Data Leak Protection â”€â”€");

  // 1. Identity Spoofing: Student A token tries to submit as Student B
  const reqSpoof = new Request(`http://localhost/api/contest/${pubContest.slug}/coding/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      question_id: codeQ.id,
      language: "python",
      code: "print('hacked')",
      user_id: studentBId, // Malicious target ID
    }),
  });
  const resSpoof = await codingSubmitRoute(reqSpoof, { params: Promise.resolve({ slug: pubContest.slug }) });
  check(resSpoof.status === 403, "Impersonation blocked: Student A submitting as Student B receives 403 Forbidden");

  // 2. Secret and Hidden Test Case Protection in Questions API
  const reqQuest = new Request(`http://localhost/api/contest/${anonContest.slug}/questions`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const resQuest = await questionsRoute(reqQuest, { params: Promise.resolve({ slug: anonContest.slug }) });
  const dataQuest = await resQuest.json();
  const qItem = dataQuest.questions.find((q: any) => q.question_id === codeQ.id);
  check(qItem !== undefined, "Question retrieved from questions API");
  const testCasesReturned = qItem?.coding_details?.test_cases || [];
  check(testCasesReturned.every((tc: any) => tc.is_sample && !tc.is_hidden), "Zero hidden test cases leaked to student");

  console.log("\n==================================================");
  console.log(`ðŸŽ‰ ALL ${passedCount} MASTER HARDENING ASSERTIONS PASSED!`);
  console.log("==================================================\n");
}

runMasterHardeningSuite().catch((err) => {
  console.error("Master hardening suite failed:", err);
  process.exit(1);
});
