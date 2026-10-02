import { NextResponse } from "next/server";
import { createContest, listContests } from "../../../../lib/contest/service";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";

async function verifyAdminAuth() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { isAuthorized: true, userId: "admin-demo-user" }; // Local dev fallback

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isAuthorized: false, userId: null };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role;
  const isAuthorized = role === "admin" || role === "super_admin" || role === "contest_admin";
  return { isAuthorized, userId: user.id };
}

export async function GET() {
  const { isAuthorized } = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  const contests = await listContests();
  return NextResponse.json({ contests });
}

export async function POST(req: Request) {
  const { isAuthorized, userId } = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.title || !body.passcode || !body.start_at || !body.end_at) {
      return NextResponse.json(
        { error: "Title, passcode, start_at, and end_at are required." },
        { status: 400 }
      );
    }

    const contest = await createContest({
      title: body.title,
      description: body.description,
      slug: body.slug,
      passcode: body.passcode,
      start_at: body.start_at,
      end_at: body.end_at,
      duration_minutes: body.duration_minutes || 60,
      instructions: body.instructions,
      negative_marking: body.negative_marking,
      default_negative_mark: body.default_negative_mark,
      created_by: userId,
    });

    return NextResponse.json({ contest }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create contest." },
      { status: 500 }
    );
  }
}
