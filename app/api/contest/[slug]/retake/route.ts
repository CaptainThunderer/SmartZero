import { NextResponse } from "next/server";
import { getContestBySlug, startNewAttempt, canStartNewAttempt } from "@/lib/contest/service";
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
    // optional body
  }

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to trigger a retake." }, { status: 401 });
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

  const eligibility = await canStartNewAttempt(contest.id, userId);
  if (!eligibility.can_retake) {
    return NextResponse.json(
      { error: eligibility.reason || "Retakes are not permitted for this contest." },
      { status: 403 }
    );
  }

  const result = await startNewAttempt({
    contest_id: contest.id,
    user_id: userId,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    participant: result.participant,
  });
}
