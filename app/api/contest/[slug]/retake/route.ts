import { NextResponse } from "next/server";
import { getContestBySlug, startNewAttempt, canStartNewAttempt } from "@/lib/contest/service";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  let userId = body.user_id;
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "User ID required." }, { status: 401 });
  }

  const eligibility = await canStartNewAttempt(contest.id, userId);
  if (!eligibility.can_retake) {
    return NextResponse.json(
      { error: eligibility.reason || "Retakes are not permitted for this contest." },
      { status: 403 }
    );
  }

  const result = await startNewAttempt({
    contest_id: contest.id,
    user_id: userId,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    participant: result.participant,
  });
}
