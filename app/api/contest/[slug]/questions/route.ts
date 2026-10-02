import { NextResponse } from "next/server";
import {
  getContestBySlug,
  getContestQuestions,
  getStudentAnswers,
  computeContestStatus,
  getParticipant,
} from "@/lib/contest/service";
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

  // Determine user identity
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

  const status = computeContestStatus(contest);
  if (status === "DRAFT") {
    return NextResponse.json({ error: "Contest is in draft mode." }, { status: 403 });
  }

  // Get sanitized questions for student role: answers stripped!
  const questions = await getContestQuestions(contest.id, "student");

  // Get student's previously saved answers (resilience against refresh)
  const answers = await getStudentAnswers(contest.id, userId);

  // Get participant record
  const participant = await getParticipant(contest.id, userId);

  return NextResponse.json({
    contest_id: contest.id,
    title: contest.title,
    duration_minutes: contest.duration_minutes,
    negative_marking: contest.negative_marking,
    default_negative_mark: contest.default_negative_mark,
    fullscreen_required: contest.fullscreen_required ?? true,
    auto_submit_on_violation: contest.auto_submit_on_violation ?? false,
    max_violations: contest.max_violations ?? 5,
    allow_retake: contest.allow_retake ?? false,
    max_attempts: contest.max_attempts ?? 1,
    status,
    questions,
    answers,
    participant: participant
      ? {
          id: participant.id,
          status: participant.status,
          attempt_number: participant.attempt_number || 1,
          started_at: participant.started_at,
          completed_at: participant.completed_at,
          score: participant.score,
          violations_count: participant.violations_count || 0,
          submission_reason: participant.submission_reason,
        }
      : null,
  });
}
