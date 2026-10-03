import { NextResponse } from "next/server";
import { getContestBySlug, submitContestExam } from "@/lib/contest/service";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is acceptable
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to finalize exam." }, { status: 401 });
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

  const result = await submitContestExam({
    contest_id: contest.id,
    user_id: userId,
  });

  if (!result.success && result.error && result.error !== "Exam has already been submitted.") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    score: result.score,
    participant: result.participant,
    already_submitted: result.error === "Exam has already been submitted.",
  });
}
