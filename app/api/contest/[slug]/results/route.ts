import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { getStudentContestResult } from "@/lib/contest/analytics";
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

  const result = await getStudentContestResult(contest.id, userId);

  if (!result) {
    return NextResponse.json(
      { error: "No participation record found for this contest." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    result,
  });
}
