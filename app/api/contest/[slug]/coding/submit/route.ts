import { NextResponse } from "next/server";
import {
  getContestBySlug,
  getCodingQuestionRaw,
  getContestQuestions,
  computeContestStatus,
  getParticipant,
} from "@/lib/contest/service";
import {
  defaultJudgeWorker,
  saveCodingSubmission,
  judgeQueue,
  judgeObservability,
} from "@/lib/judge/service";
import { JUDGE_RESOURCE_LIMITS } from "@/lib/judge/config";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";
import type { CodingLanguage } from "@/types/contest";

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

  const participant = await getParticipant(contest.id, userId);
  if (participant?.status === "submitted") {
    return NextResponse.json(
      { error: "Exam has already been finalized and submitted." },
      { status: 403 }
    );
  }

  // Authoritative question verification: confirm question exists
  const rawQuestion = await getCodingQuestionRaw(body.question_id);
  if (!rawQuestion) {
    return NextResponse.json({ error: "Coding question not found." }, { status: 404 });
  }

  // Idempotency token from headers or body
  const idempotencyKey =
    req.headers.get("x-idempotency-key") ||
    body.idempotency_key ||
    `idem-${contest.id}-${userId}-${body.question_id}-${Date.now()}`;

  const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  judgeObservability.recordJobEnqueued();

  // Enqueue submission job into durable queue
  const job = await judgeQueue.enqueue({
    jobId,
    submissionId,
    contestId: contest.id,
    questionId: body.question_id,
    userId,
    language: body.language,
    code: body.code,
    priority: 10,
    idempotencyKey,
  });

  // Authoritative Worker Execution:
  // Dequeue and process job with authoritative DB test case retrieval
  const dequeuedJob = await judgeQueue.dequeue();
  const targetJob = dequeuedJob && dequeuedJob.jobId === job.jobId ? dequeuedJob : job;

  const judgeSummary = await defaultJudgeWorker.processJob(targetJob);

  // Save submission record to Supabase / memory store
  const submission = await saveCodingSubmission({
    contest_id: contest.id,
    user_id: userId,
    question_id: body.question_id,
    language: body.language,
    code: body.code,
    summary: judgeSummary,
  });

  // Update participant status & score if in exam
  if (participant) {
    if (participant.status === "registered") {
      participant.status = "in_exam";
    }
    // Update participant score with submission score if higher
    participant.score = (participant.score || 0) + judgeSummary.score;
  }

  return NextResponse.json({
    success: true,
    submission,
  });
}
