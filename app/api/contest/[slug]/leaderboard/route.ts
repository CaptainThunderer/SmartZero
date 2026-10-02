import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getContestLeaderboard } from "@/lib/contest/leaderboard";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
  let userId = url.searchParams.get("user_id") || "demo-student-user";

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  const data = await getContestLeaderboard(contest.id, userId);

  return NextResponse.json({
    contest_id: contest.id,
    title: contest.title,
    status: contest.status,
    ...data,
    updated_at: new Date().toISOString(),
  });
}
