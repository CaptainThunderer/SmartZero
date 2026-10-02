import { NextResponse } from "next/server";
import { getContestBySlug, computeContestStatus } from "@/lib/contest/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const now = Date.now();
  const startTime = new Date(contest.start_at).getTime();
  const endTime = new Date(contest.end_at).getTime();

  const status = computeContestStatus(contest);
  const secondsToStart = Math.max(0, Math.floor((startTime - now) / 1000));
  const secondsRemaining = Math.max(0, Math.floor((endTime - now) / 1000));

  return NextResponse.json({
    status,
    server_time: new Date().toISOString(),
    start_at: contest.start_at,
    end_at: contest.end_at,
    seconds_to_start: secondsToStart,
    seconds_remaining: secondsRemaining,
    duration_minutes: contest.duration_minutes,
  });
}
