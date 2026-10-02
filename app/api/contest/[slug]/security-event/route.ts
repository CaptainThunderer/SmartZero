import { NextResponse } from "next/server";
import { getContestBySlug, getParticipant } from "@/lib/contest/service";
import {
  recordSecurityEvent,
  getParticipantSecurityEvents,
} from "@/lib/contest/security";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SecurityEventType, SecurityEventSeverity } from "@/types/contest";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  let body: {
    participant_id?: string;
    event_type?: SecurityEventType;
    severity?: SecurityEventSeverity;
    metadata?: Record<string, unknown>;
    user_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.event_type) {
    return NextResponse.json({ error: "event_type is required." }, { status: 400 });
  }

  // Determine user
  let userId = body.user_id || "demo-student-user";
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  const participant = await getParticipant(contest.id, userId);
  const participantId = body.participant_id || participant?.id || `part-${userId}`;

  const result = await recordSecurityEvent({
    contest_id: contest.id,
    participant_id: participantId,
    user_id: userId,
    event_type: body.event_type,
    severity: body.severity,
    metadata: body.metadata,
    policy: {
      violation_threshold: contest.max_violations ?? 5,
      auto_submit_on_violation: contest.auto_submit_on_violation ?? false,
      action_on_violation: contest.auto_submit_on_violation ? "auto_submit" : "lock",
    },
  });

  return NextResponse.json({
    success: true,
    ...result,
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  const url = new URL(req.url);
  const participantId = url.searchParams.get("participant_id") || "";

  const events = await getParticipantSecurityEvents(contest.id, participantId);

  return NextResponse.json({
    success: true,
    events,
  });
}
