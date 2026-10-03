import { NextResponse } from "next/server";
import { getContestBySlug, computeContestStatus, getParticipant, getEffectiveAttemptDeadline } from "@/lib/contest/service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest || contest.status === "DRAFT") {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("user_id");

  let participant = null;
  if (requestedUserId) {
    participant = await getParticipant(contest.id, requestedUserId);
  }

  const now = Date.now();
  const startTime = new Date(contest.start_at).getTime();
  const status = computeContestStatus(contest);
  const secondsToStart = Math.max(0, Math.floor((startTime - now) / 1000));

  const deadline = getEffectiveAttemptDeadline(contest, participant);

  return NextResponse.json({
    status,
    server_time: new Date().toISOString(),
    start_at: contest.start_at,
    end_at: contest.end_at,
    seconds_to_start: secondsToStart,
    seconds_remaining: deadline.secondsRemaining,
    effective_deadline: deadline.effectiveDeadlineIso,
    is_expired: deadline.isExpired,
    duration_minutes: contest.duration_minutes,
  });
}
