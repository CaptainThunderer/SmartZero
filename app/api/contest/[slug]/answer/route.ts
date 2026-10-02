import { NextResponse } from "next/server";
import { getContestBySlug, recordMcqAnswer } from "@/lib/contest/service";
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

  let body: {
    question_id?: string;
    selected_option_id?: string | null;
    is_marked_for_review?: boolean;
    user_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.question_id) {
    return NextResponse.json({ error: "question_id is required." }, { status: 400 });
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

  const result = await recordMcqAnswer({
    contest_id: contest.id,
    user_id: userId,
    question_id: body.question_id,
    selected_option_id: body.selected_option_id ?? null,
    is_marked_for_review: body.is_marked_for_review,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    answer: result.answer,
  });
}
