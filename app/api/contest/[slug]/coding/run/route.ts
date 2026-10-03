import { NextResponse } from "next/server";
import { getContestBySlug, getCodingQuestionRaw, getParticipant, getEffectiveAttemptDeadline } from "@/lib/contest/service";
import { judgeWorkerClient, JudgeUnavailableError } from "@/lib/judge/service";
import { JUDGE_RESOURCE_LIMITS } from "@/lib/judge/config";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";
import type { CodingLanguage } from "@/types/contest";
import type { JudgeTestCase } from "@/lib/judge/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to run code." }, { status: 401 });
  }

  const participant = await getParticipant(contest.id, authUser.userId);
  const deadline = getEffectiveAttemptDeadline(contest, participant);
  if (deadline.isExpired) {
    return NextResponse.json(
      { error: "Exam time has expired. Submissions are closed." },
      { status: 403 }
    );
  }

  let body: {
    question_id?: string;
    code?: string;
    language?: CodingLanguage;
    custom_input?: string;
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

  const rawQuestion = await getCodingQuestionRaw(body.question_id);
  if (!rawQuestion) {
    return NextResponse.json({ error: "Coding question not found." }, { status: 404 });
  }

  // Filter ONLY public sample test cases for student interactive "Run"
  const sampleTestCases: JudgeTestCase[] = (rawQuestion.test_cases || [])
    .filter((tc) => tc.is_sample)
    .map((tc) => ({
      id: tc.id,
      input: tc.input,
      expected_output: tc.expected_output || "",
      weight: tc.weight || 1,
      is_sample: true,
      is_hidden: false,
    }));

  // If user provided custom input, evaluate custom input as well
  if (body.custom_input !== undefined && body.custom_input.trim().length > 0) {
    sampleTestCases.push({
      id: "custom-input-case",
      input: body.custom_input,
      expected_output: "",
      weight: 0,
      is_sample: true,
      is_hidden: false,
    });
  }

  const jobId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const jobResponse = await judgeWorkerClient.executeJob({
      job_id: jobId,
      submission_id: `run-sub-${jobId}`,
      contest_id: contest.id,
      question_id: body.question_id,
      language: body.language,
      source_code: body.code,
      execution_mode: "run",
      test_cases: sampleTestCases,
      time_limit_ms: rawQuestion.time_limit_ms,
      memory_limit_mb: rawQuestion.memory_limit_mb,
      total_marks: 0, // Interactive Run has no impact on contest marks
    });

    return NextResponse.json({
      success: true,
      summary: {
        verdict: jobResponse.verdict,
        score: 0,
        test_cases_passed: jobResponse.passed_tests,
        total_test_cases: jobResponse.total_tests,
        execution_time_ms: jobResponse.execution_time_ms,
        memory_kb: jobResponse.memory_used_mb * 1024,
        compile_output: jobResponse.compile_output || "",
        test_case_results: jobResponse.test_results,
      },
    });
  } catch (err: unknown) {
    if (err instanceof JudgeUnavailableError || (err as any)?.code === "JUDGE_UNAVAILABLE") {
      return NextResponse.json(
        {
          code: "JUDGE_UNAVAILABLE",
          error: "Code execution service is temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        code: "SYSTEM_ERROR",
        error: "Code execution service is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
