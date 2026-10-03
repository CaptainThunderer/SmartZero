import { NextResponse } from "next/server";
import { getContestBySlug, getParticipant } from "@/lib/contest/service";
import {
  recordSecurityEvent,
  getParticipantSecurityEvents,
} from "@/lib/contest/security";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";
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

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to log security events." }, { status: 401 });
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;
  const participant = await getParticipant(contest.id, userId);

  // Cross-user participant manipulation guard
  if (body.participant_id && participant && body.participant_id !== participant.id && authUser.role === "student") {
    return NextResponse.json(
      { error: "Forbidden. Cross-user participant manipulation detected." },
      { status: 403 }
    );
  }

  const participantId = participant?.id || body.participant_id || `part-${userId}`;

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

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to view security events." }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedParticipantId = url.searchParams.get("participant_id") || "";

  // If user is student, they may only view their own participant security events
  if (authUser.role === "student") {
    const ownParticipant = await getParticipant(contest.id, authUser.userId);
    if (requestedParticipantId && ownParticipant && requestedParticipantId !== ownParticipant.id) {
      return NextResponse.json(
        { error: "Forbidden. You cannot view security events for other participants." },
        { status: 403 }
      );
    }
  }

  const events = await getParticipantSecurityEvents(contest.id, requestedParticipantId);

  return NextResponse.json({
    success: true,
    events,
  });
}
