import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";

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

  // Prevent anonymous users from accessing DRAFT contests
  if (contest.status === "DRAFT") {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || (authUser.role !== "admin" && authUser.role !== "super_admin")) {
      return NextResponse.json({ error: "Contest not found." }, { status: 404 });
    }
  }

  // Sanitize public payload: NEVER send passcode or passcode_hash
  const publicData = {
    id: contest.id,
    title: contest.title,
    description: contest.description,
    slug: contest.slug,
    start_at: contest.start_at,
    end_at: contest.end_at,
    duration_minutes: contest.duration_minutes,
    status: contest.status,
    instructions: contest.instructions,
    negative_marking: contest.negative_marking,
    default_negative_mark: contest.default_negative_mark,
    fullscreen_required: contest.fullscreen_required ?? true,
    auto_submit_on_violation: contest.auto_submit_on_violation ?? true,
    max_violations: contest.max_violations ?? 1,
    allow_retake: contest.allow_retake ?? false,
    max_attempts: contest.max_attempts ?? 1,
    server_time: new Date().toISOString(),
  };

  return NextResponse.json({ contest: publicData });
}
