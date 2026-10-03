import { NextResponse } from "next/server";
import { getContestBySlug, recordMcqAnswer } from "@/lib/contest/service";
import { getAuthenticatedUser, validateStudentIdentity } from "@/lib/auth/studentSession";

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

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to submit answers." }, { status: 401 });
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

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
