import { NextResponse } from "next/server";
import { getContestBySlug, getParticipant, computeContestStatus, getEffectiveAttemptDeadline } from "@/lib/contest/service";
import { saveCodingDraft } from "@/lib/judge/service";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";
import { JUDGE_RESOURCE_LIMITS } from "@/lib/judge/config";
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
    return NextResponse.json({ error: "Contest has ended." }, { status: 403 });
  }

  let body: {
    question_id?: string;
    code?: string;
    language?: CodingLanguage;
    user_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.question_id || body.code === undefined || !body.language) {
    return NextResponse.json(
      { error: "question_id, code, and language are required." },
      { status: 400 }
    );
  }

  if (Buffer.byteLength(body.code, "utf-8") > JUDGE_RESOURCE_LIMITS.MAX_SOURCE_CODE_BYTES) {
    return NextResponse.json({ error: "Code exceeds size limits." }, { status: 400 });
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
    return NextResponse.json({ error: "Exam already submitted." }, { status: 403 });
  }

  const deadline = getEffectiveAttemptDeadline(contest, participant);
  if (deadline.isExpired) {
    return NextResponse.json({ error: "Exam deadline expired." }, { status: 403 });
  }

  const result = await saveCodingDraft({
    contest_id: contest.id,
    user_id: userId,
    question_id: body.question_id,
    language: body.language,
    code: body.code,
  });

  return NextResponse.json({
    success: result.success,
    saved_at: new Date().toISOString(),
  });
}
