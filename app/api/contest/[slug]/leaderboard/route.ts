import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getContestLeaderboard } from "@/lib/contest/leaderboard";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";

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
  const isAdmin = !!(authUser && (authUser.role === "admin" || authUser.role === "super_admin" || authUser.role === "contest_admin"));
  const isAnonymous = contest.leaderboard_visibility === "ANONYMOUS";

  if (isAnonymous && !isAdmin) {
    return NextResponse.json({
      contest_id: contest.id,
      title: contest.title,
      status: contest.status,
      leaderboard_visibility: "ANONYMOUS",
      message: "This contest has an anonymous leaderboard. Scores and rankings are hidden from contestants.",
      leaderboard: [],
      currentUserRank: null,
      currentUserScore: null,
      totalParticipants: 0,
      updated_at: new Date().toISOString(),
    });
  }

  const userId = authUser?.userId || "";
  const data = await getContestLeaderboard(contest.id, userId, isAdmin ? "admin" : "student");

  return NextResponse.json({
    contest_id: contest.id,
    title: contest.title,
    status: contest.status,
    leaderboard_visibility: contest.leaderboard_visibility || "PUBLIC",
    ...data,
    updated_at: new Date().toISOString(),
  });
}
