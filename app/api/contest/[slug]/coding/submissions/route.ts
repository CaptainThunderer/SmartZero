import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getStudentSubmissions } from "@/lib/judge/service";
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
  const questionId = url.searchParams.get("question_id") || undefined;
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

  const submissions = await getStudentSubmissions(contest.id, userId, questionId);

  return NextResponse.json({
    success: true,
    submissions,
  });
}
