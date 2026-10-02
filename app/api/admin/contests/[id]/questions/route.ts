import { NextResponse } from "next/server";
import {
  getContestQuestions,
  linkQuestionToContest,
  addMcqQuestion,
  addCodingQuestion,
  reorderContestQuestions,
} from "@/lib/contest/service";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function verifyAdminAuth() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return true; // Local dev fallback

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role;
  return role === "admin" || role === "super_admin" || role === "contest_admin";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { id } = await params;
  const questions = await getContestQuestions(id, "admin");
  return NextResponse.json({ questions });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { id: contest_id } = await params;
  try {
    const body = await req.json();

    if (body.type === "mcq") {
      const mcq = await addMcqQuestion({
        question_text: body.question_text,
        explanation: body.explanation,
        difficulty: body.difficulty,
        options: body.options || [],
      });

      const linked = await linkQuestionToContest({
        contest_id,
        question_id: mcq.id,
        question_type: "mcq",
        marks: body.marks || 1,
        negative_marks: body.negative_marks || 0,
      });

      return NextResponse.json({ question: linked }, { status: 201 });
    } else if (body.type === "coding") {
      const codeQ = await addCodingQuestion({
        title: body.title,
        description: body.description,
        input_format: body.input_format,
        output_format: body.output_format,
        constraints: body.constraints,
        difficulty: body.difficulty,
        time_limit_ms: body.time_limit_ms,
        memory_limit_mb: body.memory_limit_mb,
        test_cases: body.test_cases || [],
      });

      const linked = await linkQuestionToContest({
        contest_id,
        question_id: codeQ.id,
        question_type: "coding",
        marks: body.marks || 5,
        negative_marks: body.negative_marks || 0,
      });

      return NextResponse.json({ question: linked }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid question type. Expected 'mcq' or 'coding'." }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add question." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { id: contest_id } = await params;
  try {
    const { orderedQuestionIds } = await req.json();
    if (!Array.isArray(orderedQuestionIds)) {
      return NextResponse.json({ error: "orderedQuestionIds array required." }, { status: 400 });
    }

    const reordered = await reorderContestQuestions(contest_id, orderedQuestionIds);
    return NextResponse.json({ questions: reordered });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reorder questions." },
      { status: 500 }
    );
  }
}
