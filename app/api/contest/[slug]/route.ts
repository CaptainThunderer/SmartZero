import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  // Sanitize public payload: NEVER send passcode_hash
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
    server_time: new Date().toISOString(),
  };

  return NextResponse.json({ contest: publicData });
}
