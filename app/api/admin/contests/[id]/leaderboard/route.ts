import { NextResponse } from "next/server";
import { getContestById, getContestBySlug, canUserManageContest } from "@/lib/contest/service";
import { getContestLeaderboard } from "@/lib/contest/leaderboard";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Staff Authentication Verification
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Unauthorized. Staff login required." },
      { status: 401 }
    );
  }

  // 2. Strict Role Verification
  if (authUser.role === "student") {
    return NextResponse.json(
      { error: "Forbidden: Administrator privileges required." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const contest = (await getContestById(id)) || (await getContestBySlug(id));

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  // 3. Scoped RBAC Verification for contest_admin
  if (authUser.role === "contest_admin") {
    const allowed = await canUserManageContest(contest.id, authUser.userId, authUser.role);
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden: You are not assigned to manage this contest." },
        { status: 403 }
      );
    }
  } else if (authUser.role !== "admin" && authUser.role !== "super_admin") {
    return NextResponse.json(
      { error: "Forbidden: Administrator privileges required." },
      { status: 403 }
    );
  }

  // 4. Server-Authoritative Live Contest State
  const now = Date.now();
  const startMs = new Date(contest.start_at).getTime();
  const endMs = new Date(contest.end_at).getTime();
  const isLive = contest.status === "LIVE" || (startMs <= now && now <= endMs);
  const remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));

  // 5. Authoritative Ranking & Scored Entries
  const data = await getContestLeaderboard(contest.id, undefined, "admin");

  // 6. Return Safe Admin Monitoring Payload (Never exposes answer keys or hidden tests)
  return NextResponse.json({
    success: true,
    contest: {
      id: contest.id,
      slug: contest.slug,
      title: contest.title,
      status: contest.status,
      start_at: contest.start_at,
      end_at: contest.end_at,
      duration_minutes: contest.duration_minutes,
      remaining_seconds: remainingSeconds,
      is_live: isLive,
      server_time: new Date().toISOString(),
    },
    leaderboard: data.leaderboard,
    totalParticipants: data.totalParticipants,
    updated_at: new Date().toISOString(),
  });
}
