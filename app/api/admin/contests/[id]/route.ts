import { NextResponse } from "next/server";
import { getContestById, updateContest, deleteContest, computeContestStatus, canUserManageContest } from "../../../../../lib/contest/service";
import { getAuthenticatedUser } from "../../../../../lib/auth/studentSession";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (authUser.role === "student") {
    return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;

  // contest_admin scoped check
  if (authUser.role === "contest_admin") {
    const canManage = await canUserManageContest(id, authUser.userId, authUser.role);
    if (!canManage) {
      return NextResponse.json({ error: "You are not authorized to manage this contest." }, { status: 403 });
    }
  }

  const contest = await getContestById(id);
  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  return NextResponse.json({ contest });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (authUser.role === "student") {
    return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;

  // contest_admin scoped check
  if (authUser.role === "contest_admin") {
    const canManage = await canUserManageContest(id, authUser.userId, authUser.role);
    if (!canManage) {
      return NextResponse.json({ error: "You are not authorized to edit this contest." }, { status: 403 });
    }
  }

  const contest = await getContestById(id);
  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  try {
    const body = await req.json();
    const currentStatus = computeContestStatus(contest);
    const now = Date.now();

    // Whitelist editable fields — never trust arbitrary client keys
    const safeUpdates: Record<string, unknown> = {};

    // ── Basic Info (always editable) ──
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      safeUpdates.title = body.title.trim();
    }
    if (body.description !== undefined) {
      safeUpdates.description = String(body.description || "").trim();
    }
    if (body.instructions !== undefined) {
      safeUpdates.instructions = String(body.instructions || "");
    }

    // ── Schedule Fields ──
    if (body.start_at !== undefined || body.end_at !== undefined || body.duration_minutes !== undefined) {
      const newStartAt = body.start_at || contest.start_at;
      const newEndAt = body.end_at || contest.end_at;
      const newDuration = body.duration_minutes !== undefined ? Number(body.duration_minutes) : contest.duration_minutes;

      const startMs = new Date(newStartAt).getTime();
      const endMs = new Date(newEndAt).getTime();

      if (isNaN(startMs) || isNaN(endMs)) {
        return NextResponse.json({ error: "Invalid date format for start or end time." }, { status: 400 });
      }
      if (endMs <= startMs) {
        return NextResponse.json({ error: "End time must be strictly after start time." }, { status: 400 });
      }
      if (newDuration <= 0 || newDuration > 1440) {
        return NextResponse.json({ error: "Duration must be between 1 and 1440 minutes." }, { status: 400 });
      }

      // ── LIVE Contest Schedule Safety ──
      if (currentStatus === "LIVE") {
        // Cannot change start_at on a LIVE contest
        if (body.start_at !== undefined && new Date(body.start_at).getTime() !== new Date(contest.start_at).getTime()) {
          return NextResponse.json(
            { error: "Cannot change the start time of a LIVE contest. Participants have already started." },
            { status: 400 }
          );
        }
        // Cannot shorten end time below current server time
        if (endMs <= now) {
          return NextResponse.json(
            { error: "Cannot set the end time to before the current server time on a LIVE contest." },
            { status: 400 }
          );
        }
      }

      // ── ENDED Contest Schedule Safety ──
      if (currentStatus === "ENDED" || currentStatus === "FINAL_RESULTS") {
        if (body.start_at !== undefined || body.end_at !== undefined || body.duration_minutes !== undefined) {
          return NextResponse.json(
            { error: "Cannot modify the schedule of an ended contest. Historical timing is immutable." },
            { status: 400 }
          );
        }
      }

      if (body.start_at !== undefined) safeUpdates.start_at = newStartAt;
      if (body.end_at !== undefined) safeUpdates.end_at = newEndAt;
      if (body.duration_minutes !== undefined) safeUpdates.duration_minutes = newDuration;
    }

    // ── Contest Policies (editable for DRAFT / UPCOMING / LIVE) ──
    if (currentStatus !== "ENDED" && currentStatus !== "FINAL_RESULTS") {
      if (body.fullscreen_required !== undefined) safeUpdates.fullscreen_required = !!body.fullscreen_required;
      if (body.auto_submit_on_violation !== undefined) safeUpdates.auto_submit_on_violation = !!body.auto_submit_on_violation;
      if (body.max_violations !== undefined) {
        const mv = Number(body.max_violations);
        if (mv >= 1 && mv <= 10) safeUpdates.max_violations = mv;
      }
      if (body.allow_retake !== undefined) safeUpdates.allow_retake = !!body.allow_retake;
      if (body.max_attempts !== undefined) {
        const ma = Number(body.max_attempts);
        if (ma >= 1 && ma <= 10) safeUpdates.max_attempts = ma;
      }
      if (body.negative_marking !== undefined) safeUpdates.negative_marking = !!body.negative_marking;
      if (body.default_negative_mark !== undefined) {
        const dnm = Number(body.default_negative_mark);
        if (dnm >= 0 && dnm <= 5) safeUpdates.default_negative_mark = dnm;
      }
    }

    // ── Status Changes (publish) ──
    if (body.status !== undefined) {
      const allowedStatuses = ["DRAFT", "PUBLISHED"];
      if (allowedStatuses.includes(body.status)) {
        safeUpdates.status = body.status;
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    safeUpdates.updated_at = new Date().toISOString();

    const updated = await updateContest(id, safeUpdates as Partial<typeof contest>);
    if (!updated) {
      return NextResponse.json({ error: "Contest not found." }, { status: 404 });
    }

    return NextResponse.json({ contest: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update contest." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (authUser.role === "student") {
    return NextResponse.json({ error: "Forbidden. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;
  let force = false;
  try {
    const body = await req.json();
    force = !!body?.force;
  } catch {
    // optional
  }

  const result = await deleteContest(id, { force });
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to delete contest." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
