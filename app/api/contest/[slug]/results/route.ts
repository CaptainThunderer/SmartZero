import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getStudentContestResult } from "@/lib/contest/analytics";
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
    return NextResponse.json({ error: "Authentication required to view results." }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("user_id");

  const identityCheck = validateStudentIdentity(authUser, requestedUserId);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

  const result = await getStudentContestResult(contest.id, userId);

  if (!result) {
    return NextResponse.json(
      { error: "No participation record found for this contest." },
      { status: 404 }
    );
  }

  const isAnonymous = contest.leaderboard_visibility === "ANONYMOUS";
  const isAdmin = authUser.role === "admin" || authUser.role === "super_admin" || authUser.role === "contest_admin";

  if (isAnonymous && !isAdmin) {
    const {
      rank: _rank,
      percentile: _percentile,
      total_score: _total_score,
      mcq_score: _mcq_score,
      coding_score: _coding_score,
      question_performance,
      ...safeResult
    } = result;

    const sanitizedPerformance = (question_performance || []).map((qp) => {
      const { earned_marks: _em, ...restQp } = qp;
      return restQp;
    });

    return NextResponse.json({
      success: true,
      result: {
        ...safeResult,
        question_performance: sanitizedPerformance,
      },
    });
  }

  return NextResponse.json({
    success: true,
    result,
  });
}
