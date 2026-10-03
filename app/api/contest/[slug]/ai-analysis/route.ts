import { NextResponse } from "next/server";
import { getContestBySlug } from "@/lib/contest/service";
import { generateStudentPostContestAnalysis } from "@/lib/contest/postContestAI";
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

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to generate AI analysis." }, { status: 401 });
  }

  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body optional
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

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

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required to view AI analysis." }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedUserId = url.searchParams.get("user_id");

  const identityCheck = validateStudentIdentity(authUser, requestedUserId);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;

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
