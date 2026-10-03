import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getStudentSubmissions } from "@/lib/judge/service";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";

export async function GET(
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
    return NextResponse.json({ error: "Authentication required to view submissions." }, { status: 401 });
  }

  const url = new URL(req.url);
  const questionId = url.searchParams.get("question_id") || undefined;
  const requestedUserId = url.searchParams.get("user_id");

  const identityCheck = validateStudentIdentity(authUser, requestedUserId);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;
  const submissions = await getStudentSubmissions(contest.id, userId, questionId);

  const isAnonymous = contest.leaderboard_visibility === "ANONYMOUS";
  const isAdmin = authUser.role === "admin" || authUser.role === "super_admin" || authUser.role === "contest_admin";

  const sanitizedSubmissions = (isAnonymous && !isAdmin)
    ? submissions.map((s) => {
        const { score: _score, ...rest } = s;
        return rest;
      })
    : submissions;

  return NextResponse.json({
    success: true,
    submissions: sanitizedSubmissions,
  });
}
