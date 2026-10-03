import { NextResponse } from "next/server";
import { getContestBySlug, registerContestParticipant } from "@/lib/contest/service";
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

  let body: { passcode?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.passcode) {
    return NextResponse.json({ error: "Contest passcode is required." }, { status: 400 });
  }

  // Authoritative identity resolution
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required to join contest. Please sign in." },
      { status: 401 }
    );
  }

  const identityCheck = validateStudentIdentity(authUser, body.user_id);
  if (!identityCheck.authorized) {
    return NextResponse.json({ error: identityCheck.error }, { status: identityCheck.status || 403 });
  }

  const userId = identityCheck.authoritativeUserId;


  const result = await registerContestParticipant({
    contest_id: contest.id,
    user_id: userId,
    passcode: body.passcode,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    participant: result.participant,
    status: contest.status,
    server_time: new Date().toISOString(),
  });
}
