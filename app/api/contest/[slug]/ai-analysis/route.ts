import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { generateStudentPostContestAnalysis } from "@/lib/contest/postContestAI";
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

  let userId = "demo-student-user";
  try {
    const body = await req.json();
    if (body.user_id) userId = body.user_id;
  } catch {
    // Body optional
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  try {
    const analysis = await generateStudentPostContestAnalysis(contest.id, userId);
    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to generate post-contest AI analysis.";
    const status = message.includes("Live AI is strictly disabled")
      ? 403
      : message.includes("not found") || message.includes("No participation record")
      ? 404
      : 400;

    return NextResponse.json({ error: message }, { status });
  }
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

  try {
    const analysis = await generateStudentPostContestAnalysis(contest.id, userId);
    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to generate post-contest AI analysis.";
    const status = message.includes("Live AI is strictly disabled")
      ? 403
      : message.includes("not found") || message.includes("No participation record")
      ? 404
      : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
