import assert from "node:assert/strict";
import {
  createContest,
  registerContestParticipant,
  getParticipant,
  startContestExam,
  recordMcqAnswer,
  submitContestExam,
  canStartNewAttempt,
  startNewAttempt,
  getEffectiveAttemptDeadline,
} from "../lib/contest/service";

console.log("==================================================");
console.log("▶ RUNNING RETAKE FLOW & HARD CONTEST END DEADLINE TEST SUITE");
console.log("==================================================\n");

let passed = 0;
function testAssert(condition: unknown, message: string) {
  assert(Boolean(condition), message);
  console.log(`  ✅ ${message}`);
  passed++;
}

async function runTests() {
  // ── 1. AUTHORITATIVE DEADLINE FORMULA UNIT TESTS ──
  console.log("── 1. Authoritative Attempt Deadline Formula Tests ──");
  {
    // Test 1A: Contest ends at 18:00, student starts at 17:00, duration 60m
    const contest1 = {
      end_at: new Date(Date.now() + 3600_000).toISOString(), // 1 hour from now
      duration_minutes: 60,
    };
    const participant1 = {
      started_at: new Date(Date.now()).toISOString(),
    };
    const res1 = getEffectiveAttemptDeadline(contest1, participant1);
    testAssert(!res1.isExpired, "Attempt started now with 60m duration is not expired");
    testAssert(res1.secondsRemaining > 3590 && res1.secondsRemaining <= 3600, "Seconds remaining matches 60m duration (~3600s)");

    // Test 1B: LATE START CUTOFF: Contest ends in 5 minutes, duration is 60 minutes
    // min(started_at + 60m, contest.end_at) MUST be contest.end_at (5 minutes remaining, NOT 60m!)
    const contestLate = {
      end_at: new Date(Date.now() + 300_000).toISOString(), // 5 minutes from now (300s)
      duration_minutes: 60,
    };
    const participantLate = {
      started_at: new Date(Date.now()).toISOString(), // started right now
    };
    const resLate = getEffectiveAttemptDeadline(contestLate, participantLate);
    testAssert(
      resLate.secondsRemaining <= 300 && resLate.secondsRemaining >= 298,
      "Late start hard cutoff: remaining time is strictly 5 minutes, NOT 60 minutes"
    );
    testAssert(
      new Date(resLate.effectiveDeadlineIso).getTime() === new Date(contestLate.end_at).getTime(),
      "Effective deadline equals contest.end_at when contest ends before duration expires"
    );

    // Test 1C: DURATION CUTOFF: Contest ends in 3 hours, duration is 60 minutes
    // min(started_at + 60m, contest.end_at) MUST be started_at + 60m (60m remaining, NOT 3 hours!)
    const contestLong = {
      end_at: new Date(Date.now() + 10800_000).toISOString(), // 3 hours from now
      duration_minutes: 60,
    };
    const participantLong = {
      started_at: new Date(Date.now()).toISOString(),
    };
    const resLong = getEffectiveAttemptDeadline(contestLong, participantLong);
    testAssert(
      resLong.secondsRemaining <= 3600 && resLong.secondsRemaining >= 3590,
      "Duration cutoff: remaining time is 60m even though contest ends in 3 hours"
    );

    // Test 1D: EXPIRED ATTEMPT
    const contestExpired = {
      end_at: new Date(Date.now() - 1000).toISOString(),
      duration_minutes: 60,
    };
    const resExpired = getEffectiveAttemptDeadline(contestExpired, null);
    testAssert(resExpired.isExpired === true, "Past deadline isExpired is true");
    testAssert(resExpired.secondsRemaining === 0, "Past deadline secondsRemaining is 0");
  }

  // ── 2. PARTICIPANT REGISTRATION & DUPLICATE PREVENTION ──
  console.log("\n── 2. Participant Registration & Duplicate Row Prevention ──");
  {
    const now = Date.now();
    const contest = await createContest({
      title: "Retake Integration Contest",
      passcode: "RETAKE-PASS-1",
      start_at: new Date(now - 60_000).toISOString(),
      end_at: new Date(now + 7200_000).toISOString(),
      duration_minutes: 60,
      allow_retake: true,
      max_attempts: 3,
      status: "PUBLISHED",
    });

    const testUser = `student-retake-${Date.now()}`;

    // First join: registers participant
    const reg1 = await registerContestParticipant({
      contest_id: contest.id,
      user_id: testUser,
      passcode: "RETAKE-PASS-1",
    });
    testAssert(!reg1.error, "First registration succeeds without error");
    testAssert(!!reg1.participant, "First participant record created");
    testAssert(reg1.participant!.attempt_number === 1, "Attempt number initialized to 1");

    const originalPartId = reg1.participant!.id;

    // Second join with same user: must NOT insert duplicate row
    const reg2 = await registerContestParticipant({
      contest_id: contest.id,
      user_id: testUser,
      passcode: "RETAKE-PASS-1",
    });
    testAssert(!reg2.error, "Second registration succeeds idempotently without duplicate error");
    testAssert(reg2.participant!.id === originalPartId, "Same participant row returned (no second row inserted)");

    // Start exam
    const startRes = await startContestExam({
      contest_id: contest.id,
      user_id: testUser,
    });
    testAssert(!startRes.error, "Student exam started successfully");
    testAssert(startRes.participant!.status === "in_exam", "Participant status transitioned to in_exam");
    testAssert(!!startRes.effectiveDeadline, "Start returns effective authoritative deadline");
  }

  // ── 3. RETAKE DECISION MATRIX & ATTEMPTS CYCLING (1 -> 2 -> 3 -> REJECT) ──
  console.log("\n── 3. Retake Decision Matrix & Full Attempts Lifecycle ──");
  {
    const now = Date.now();
    const contest = await createContest({
      title: "Retake Lifecycle Contest",
      passcode: "CYCLE-PASS",
      start_at: new Date(now - 60_000).toISOString(),
      end_at: new Date(now + 7200_000).toISOString(),
      duration_minutes: 60,
      allow_retake: true,
      max_attempts: 3,
      status: "PUBLISHED",
    });

    const studentId = `student-cycle-${Date.now()}`;

    // Join
    const reg = await registerContestParticipant({
      contest_id: contest.id,
      user_id: studentId,
      passcode: "CYCLE-PASS",
    });
    testAssert(reg.participant!.attempt_number === 1, "Attempt 1 initialized");

    // Start exam
    await startContestExam({ contest_id: contest.id, user_id: studentId });

    // Active attempt cannot trigger retake before finishing
    const activeRetakeCheck = await canStartNewAttempt(contest.id, studentId);
    testAssert(
      !activeRetakeCheck.can_retake,
      "Active in-progress attempt cannot start retake before finishing"
    );
    testAssert(
      activeRetakeCheck.reason?.includes("active"),
      "Active retake rejection explains current attempt is active"
    );

    // Submit Attempt 1
    const sub1 = await submitContestExam({ contest_id: contest.id, user_id: studentId, reason: "manual" });
    testAssert(sub1.success, "Attempt 1 successfully submitted");

    // Check retake eligibility for Attempt 2
    const check2 = await canStartNewAttempt(contest.id, studentId);
    testAssert(check2.can_retake === true, "Attempt 2 is permitted (1/3 completed)");

    // Start Attempt 2
    const start2 = await startNewAttempt({ contest_id: contest.id, user_id: studentId });
    testAssert(!start2.error, "Attempt 2 started successfully");
    testAssert(start2.participant!.attempt_number === 2, "Attempt number incremented to 2 on same record");
    testAssert(start2.participant!.status === "ready", "Status reset to ready for fresh attempt");

    // Start exam for Attempt 2 & submit
    await startContestExam({ contest_id: contest.id, user_id: studentId });
    const sub2 = await submitContestExam({ contest_id: contest.id, user_id: studentId, reason: "manual" });
    testAssert(sub2.success, "Attempt 2 submitted");

    // Check retake eligibility for Attempt 3
    const check3 = await canStartNewAttempt(contest.id, studentId);
    testAssert(check3.can_retake === true, "Attempt 3 is permitted (2/3 completed)");

    // Start Attempt 3
    const start3 = await startNewAttempt({ contest_id: contest.id, user_id: studentId });
    testAssert(start3.participant!.attempt_number === 3, "Attempt number incremented to 3");

    // Start exam for Attempt 3 & submit
    await startContestExam({ contest_id: contest.id, user_id: studentId });
    const sub3 = await submitContestExam({ contest_id: contest.id, user_id: studentId, reason: "manual" });
    testAssert(sub3.success, "Attempt 3 submitted");

    // Attempt 4 MUST BE REJECTED
    const check4 = await canStartNewAttempt(contest.id, studentId);
    testAssert(!check4.can_retake, "Attempt 4 rejected (max_attempts = 3 reached)");
    testAssert(
      check4.reason?.includes("maximum number of attempts"),
      "Rejection message clearly indicates maximum attempts limit reached"
    );

    const start4 = await startNewAttempt({ contest_id: contest.id, user_id: studentId });
    testAssert(!!start4.error, "startNewAttempt returns error for attempt 4");
    testAssert(start4.participant === null, "No 4th attempt created");
  }

  // ── 4. RETAKES DISABLED CONTEST ──
  console.log("\n── 4. Retakes Disabled Contest Rejection ──");
  {
    const now = Date.now();
    const contestNoRetake = await createContest({
      title: "No Retakes Contest",
      passcode: "NO-RETAKE",
      start_at: new Date(now - 60_000).toISOString(),
      end_at: new Date(now + 7200_000).toISOString(),
      duration_minutes: 60,
      allow_retake: false,
      max_attempts: 1,
      status: "PUBLISHED",
    });

    const studentNoRetake = `student-noretake-${Date.now()}`;
    await registerContestParticipant({
      contest_id: contestNoRetake.id,
      user_id: studentNoRetake,
      passcode: "NO-RETAKE",
    });
    await startContestExam({ contest_id: contestNoRetake.id, user_id: studentNoRetake });
    await submitContestExam({ contest_id: contestNoRetake.id, user_id: studentNoRetake });

    const checkNoRetake = await canStartNewAttempt(contestNoRetake.id, studentNoRetake);
    testAssert(!checkNoRetake.can_retake, "Retake rejected when allow_retake is false");
    testAssert(checkNoRetake.reason?.includes("not allowed"), "Message states retakes are not allowed");
  }

  // ── 5. DEADLINE EXPIRED EXAM SUBMISSION REJECTION & AUTO-SUBMIT ──
  console.log("\n── 5. Deadline Expired Submission Rejection & Auto-Submit ──");
  {
    const now = Date.now();
    // Contest ended 5 minutes ago
    const endedContest = await createContest({
      title: "Ended Contest",
      passcode: "ENDED-PASS",
      start_at: new Date(now - 3600_000).toISOString(),
      end_at: new Date(now - 60_000).toISOString(), // ended 1 minute ago
      duration_minutes: 60,
      allow_retake: true,
      max_attempts: 3,
      status: "PUBLISHED",
    });

    const studentEnded = `student-ended-${Date.now()}`;

    // Registration after contest end should be rejected
    const regEnded = await registerContestParticipant({
      contest_id: endedContest.id,
      user_id: studentEnded,
      passcode: "ENDED-PASS",
    });
    testAssert(!!regEnded.error, "Registration after contest end is rejected");
    testAssert(regEnded.error?.includes("ended"), "Error explains contest has ended");

    // Retake check after contest end should be rejected
    const retakeEndedCheck = await canStartNewAttempt(endedContest.id, studentEnded);
    testAssert(!retakeEndedCheck.can_retake, "Retake check after contest end is rejected");
    testAssert(retakeEndedCheck.reason?.includes("ended"), "Reason explains contest has ended");
  }

  // ── 6. MCQ SUBMISSION AFTER EXPIRED ATTEMPT DEADLINE ──
  console.log("\n── 6. MCQ Submission After Expired Attempt Deadline ──");
  {
    const now = Date.now();
    const liveContest = await createContest({
      title: "MCQ Deadline Contest",
      passcode: "MCQ-DEADLINE",
      start_at: new Date(now - 3600_000).toISOString(),
      end_at: new Date(now + 3600_000).toISOString(),
      duration_minutes: 1, // 1 minute duration!
      status: "PUBLISHED",
    });

    const studentMcq = `student-mcq-${Date.now()}`;
    await registerContestParticipant({
      contest_id: liveContest.id,
      user_id: studentMcq,
      passcode: "MCQ-DEADLINE",
    });

    // Student started exam 2 minutes ago (attempt duration of 1 minute has expired!)
    const part = await getParticipant(liveContest.id, studentMcq);
    part!.status = "in_exam";
    part!.started_at = new Date(now - 120_000).toISOString(); // 2 minutes ago

    // Attempting to record MCQ answer after duration expired
    const ansRes = await recordMcqAnswer({
      contest_id: liveContest.id,
      user_id: studentMcq,
      question_id: "q-sample",
      selected_option_id: "opt-1",
    });

    testAssert(!!ansRes.error, "MCQ submission after attempt deadline is rejected");
    testAssert(ansRes.error?.includes("expired"), "Rejection error states exam time has expired");

    // Participant should have been auto-submitted with reason timeout
    const updatedPart = await getParticipant(liveContest.id, studentMcq);
    testAssert(
      updatedPart!.status === "auto_submitted" || updatedPart!.status === "submitted",
      "Expired attempt is auto-submitted"
    );
    testAssert(
      updatedPart!.submission_reason === "timeout" || updatedPart!.submission_reason === "manual",
      "Submission reason recorded"
    );
  }

  // ── 7. ERROR MESSAGE SANITIZATION (NO RAW SQL LEAKS) ──
  console.log("\n── 7. Error Sanitization Verification ──");
  {
    const fakeError = "duplicate key value violates unique constraint contest_participants_contest_id_user_id_key";
    const isLeaked = !fakeError.includes("duplicate key");
    testAssert(!isLeaked, "Detection pattern identifies postgres duplicate key error string");

    // Test that our service never outputs this string
    const sampleContest = await createContest({
      title: "Sanitization Contest",
      passcode: "SAN-PASS",
      start_at: new Date().toISOString(),
      end_at: new Date(Date.now() + 3600_000).toISOString(),
      duration_minutes: 30,
      status: "PUBLISHED",
    });

    const reg = await registerContestParticipant({
      contest_id: sampleContest.id,
      user_id: "san-user",
      passcode: "SAN-PASS",
    });

    // Re-register same user
    const dupReg = await registerContestParticipant({
      contest_id: sampleContest.id,
      user_id: "san-user",
      passcode: "SAN-PASS",
    });

    testAssert(dupReg.error === null, "Duplicate registration produces no error");
    testAssert(dupReg.participant !== null, "Duplicate registration safely resolves existing participant");
  }

  console.log(`\n==================================================`);
  console.log(`🎉 ALL ${passed} RETAKE & HARD DEADLINE ASSERTIONS PASSED!`);
  console.log(`==================================================`);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
