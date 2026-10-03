import { NextResponse } from "next/server";
import { getContestBySlug, getCodingQuestionRaw } from "@/lib/contest/service";
import { defaultJudgeWorker } from "@/lib/judge/service";
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

  const judgeSummary = await defaultJudgeWorker.executeTestCases({
    code: body.code,
    language: body.language,
    testCases: sampleTestCases,
    timeLimitMs: rawQuestion.time_limit_ms,
    memoryLimitMb: rawQuestion.memory_limit_mb,
    totalMarks: 0, // Interactive Run has no impact on contest marks
  });

  return NextResponse.json({
    success: true,
    summary: judgeSummary,
  });
}
