import { NextResponse } from "next/server";
import {
  getContestBySlug,
  getCodingQuestionRaw,
  getContestQuestions,
  computeContestStatus,
  getParticipant,
  getEffectiveAttemptDeadline,
  submitContestExam,
} from "@/lib/contest/service";
import {
  saveCodingSubmission,
  judgeWorkerClient,
  JudgeUnavailableError,
  judgeObservability,
} from "@/lib/judge/service";
import { JUDGE_RESOURCE_LIMITS } from "@/lib/judge/config";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";
import type { CodingLanguage } from "@/types/contest";
import type { JudgeExecutionSummary, JudgeTestCase } from "@/lib/judge/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const currentStatus = computeContestStatus(contest);
  if (currentStatus === "ENDED" || currentStatus === "FINAL_RESULTS") {
    return NextResponse.json(
      { error: "Contest has ended. Submissions are closed." },
      { status: 403 }
    );
  }

  let body: {
    question_id?: string;
    code?: string;
    language?: CodingLanguage;
    user_id?: string;
    idempotency_key?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.question_id || !body.code || !body.language) {
    return NextResponse.json(
      { error: "question_id, code, and language are required." },
      { status: 400 }
    );
  }

  // Enforce source code size limits
  if (Buffer.byteLength(body.code, "utf-8") > JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES) {
    return NextResponse.json(
      { error: `Code exceeds maximum allowed size (${JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES} bytes).` },
      { status: 400 }
    );
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to submit code." }, { status: 401 });
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

  const participant = await getParticipant(contest.id, userId, true);
  if (
    participant?.status === "submitted" ||
    participant?.status === "auto_submitted" ||
    participant?.status === "finalized"
  ) {
    return NextResponse.json(
      { error: "Exam has already been finalized and submitted." },
      { status: 403 }
    );
  }

  const deadline = getEffectiveAttemptDeadline(contest, participant);
  if (deadline.isExpired) {
    await submitContestExam({
      contest_id: contest.id,
      user_id: userId,
      reason: "timeout",
    });
    return NextResponse.json(
      { error: "Exam time has expired. Submissions are closed." },
      { status: 403 }
    );
  }

  // Authoritative question verification: confirm question exists
  const rawQuestion = await getCodingQuestionRaw(body.question_id);
  if (!rawQuestion) {
    return NextResponse.json({ error: "Coding question not found." }, { status: 404 });
  }

  // Authoritative marks lookup from contest configuration
  const contestQuestions = await getContestQuestions(contest.id, "admin");
  const contestQLink = contestQuestions.find(
    (cq) => cq.question_id === body.question_id && cq.question_type === "coding"
  );
  const totalMarks = contestQLink ? contestQLink.marks : 20;

  const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  judgeObservability.recordJobEnqueued();

  const testCases: JudgeTestCase[] = (rawQuestion.test_cases || []).map((tc) => ({
    id: tc.id,
    input: tc.input,
    expected_output: tc.expected_output || "",
    weight: tc.weight || 1,
    is_sample: !!tc.is_sample,
    is_hidden: !tc.is_sample,
  }));

  try {
    const jobResponse = await judgeWorkerClient.executeJob({
      job_id: jobId,
      submission_id: submissionId,
      contest_id: contest.id,
      question_id: body.question_id,
      language: body.language,
      source_code: body.code,
      execution_mode: "submit",
      test_cases: testCases,
      time_limit_ms: rawQuestion.time_limit_ms,
      memory_limit_mb: rawQuestion.memory_limit_mb,
      total_marks: totalMarks,
    });

    const judgeSummary: JudgeExecutionSummary = {
      verdict: jobResponse.verdict,
      score: jobResponse.score,
      test_cases_passed: jobResponse.passed_tests,
      total_test_cases: jobResponse.total_tests,
      execution_time_ms: jobResponse.execution_time_ms,
      memory_kb: jobResponse.memory_used_mb * 1024,
      compile_output: jobResponse.compile_output || "",
      test_case_results: jobResponse.test_results.map((tr) => ({
        test_case_id: `tc-${tr.index}`,
        verdict: tr.verdict,
        execution_time_ms: tr.execution_time_ms,
        memory_kb: tr.memory_kb,
        is_sample: tr.is_sample,
        input: tr.input,
        expected_output: tr.expected_output,
        actual_output: tr.actual_output,
        error: tr.error,
      })),
    };

    // Save submission record to Supabase / memory store
    const submission = await saveCodingSubmission({
      contest_id: contest.id,
      user_id: userId,
      question_id: body.question_id,
      language: body.language,
      code: body.code,
      summary: judgeSummary,
    });

    // Update participant status if in exam
    if (participant && participant.status === "registered") {
      participant.status = "in_exam";
    }

    const isAnonymous = contest.leaderboard_visibility === "ANONYMOUS";
    const isAdmin = authUser.role === "admin" || authUser.role === "super_admin" || authUser.role === "contest_admin";

    // In ANONYMOUS mode, sanitize submission to hide awarded contest points/score from student
    let clientSubmission: Partial<typeof submission> = submission;
    if (isAnonymous && !isAdmin) {
      const { score: _score, ...restSubmission } = submission;
      clientSubmission = restSubmission;
    }

    return NextResponse.json({
      success: true,
      submission: clientSubmission,
    });
  } catch (err: unknown) {
    if (err instanceof JudgeUnavailableError || (err as any)?.code === "JUDGE_UNAVAILABLE") {
      return NextResponse.json(
        {
          code: "JUDGE_UNAVAILABLE",
          error: "Judge service is temporarily unavailable. Your submission was not scored. Please try again.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        code: "SYSTEM_ERROR",
        error: "Judge service is temporarily unavailable. Your submission was not scored. Please try again.",
      },
      { status: 500 }
    );
  }
}
