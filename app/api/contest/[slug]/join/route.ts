import { NextResponse } from "next/server";
import { getContestBySlug, registerContestParticipant } from "@/lib/contest/service";
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
  let userId = body.user_id;
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required to join contest. Please sign in." },
      { status: 401 }
    );
  }


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
