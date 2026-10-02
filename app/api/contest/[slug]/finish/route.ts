import { NextResponse } from "next/server";
import { getContestBySlug, submitContestExam } from "@/lib/contest/service";
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
    // Empty body is acceptable
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

  const result = await submitContestExam({
    contest_id: contest.id,
    user_id: userId,
  });

  if (!result.success && result.error && result.error !== "Exam has already been submitted.") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    score: result.score,
    participant: result.participant,
    already_submitted: result.error === "Exam has already been submitted.",
  });
}
