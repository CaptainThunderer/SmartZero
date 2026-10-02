import { NextResponse } from "next/server";
import { getContestById, updateContest, deleteContest } from "../../../../../lib/contest/service";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";

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
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;
  const contest = await getContestById(id);
  if (!contest) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  return NextResponse.json({ contest });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const updated = await updateContest(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Contest not found." }, { status: 404 });
    }

    return NextResponse.json({ contest: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update contest." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = await verifyAdminAuth();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;
  let force = false;
  try {
    const body = await req.json();
    force = !!body?.force;
  } catch {
    // optional
  }

  const result = await deleteContest(id, { force });
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to delete contest." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
