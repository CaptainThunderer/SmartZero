import { NextResponse } from "next/server";
import {
  getContestAdminIds,
  assignContestAdmin,
  removeContestAdmin,
  canUserManageContest,
} from "@/lib/contest/service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserRole } from "@/types/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminIds = await getContestAdminIds(id);
  return NextResponse.json({ contest_id: id, admins: adminIds });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { admin_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.admin_id) {
    return NextResponse.json({ error: "admin_id is required." }, { status: 400 });
  }

  // Caller authorization
  let callerId = "demo-admin";
  let callerRole: UserRole = "admin";
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      callerId = user.id;
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (roleRow) {
        callerRole = roleRow.role as UserRole;
      }
    }
  }

  const allowed = await canUserManageContest(id, callerId, callerRole);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden: Not permitted to manage this contest." }, { status: 403 });
  }

  await assignContestAdmin({
    contest_id: id,
    admin_id: body.admin_id,
    assigned_by: callerId,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { admin_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.admin_id) {
    return NextResponse.json({ error: "admin_id is required." }, { status: 400 });
  }

  // Caller authorization
  let callerId = "demo-admin";
  let callerRole: UserRole = "admin";
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      callerId = user.id;
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (roleRow) {
        callerRole = roleRow.role as UserRole;
      }
    }
  }

  const allowed = await canUserManageContest(id, callerId, callerRole);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden: Not permitted to manage this contest." }, { status: 403 });
  }

  await removeContestAdmin(id, body.admin_id);

  return NextResponse.json({ success: true });
}
