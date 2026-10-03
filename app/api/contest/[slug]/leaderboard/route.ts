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
  const userId = authUser?.userId || "";

  const data = await getContestLeaderboard(contest.id, userId);

  return NextResponse.json({
    contest_id: contest.id,
    title: contest.title,
    status: contest.status,
    ...data,
    updated_at: new Date().toISOString(),
  });
}
