import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";
import { updateUserRoleAndStatus, PRIMARY_SUPER_ADMIN_EMAIL } from "@/lib/auth/roleService";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import type { UserRole } from "@/types/auth";

async function getAdminClient() {
  return createSupabaseAdminClient() || (await createSupabaseServerClient());
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (authUser.role !== "admin" && authUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getAdminClient();

  let role: UserRole = "student";
  let email: string = "";

  if (supabase) {
    try {
      const { data: prof } = await supabase.from("profiles").select("email").eq("id", id).maybeSingle();
      if (prof?.email) email = prof.email;

      const { data: rData } = await supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle();
      if (rData?.role) role = rData.role as UserRole;
    } catch {
      // Fallback
    }
  }

  if (email.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) {
    role = "super_admin";
  }

  return NextResponse.json({
    user_id: id,
    email,
    role,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (authUser.role !== "admin" && authUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;
  let body: { role?: UserRole; contest_ids?: string[] };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await updateUserRoleAndStatus({
    callerUserId: authUser.userId,
    callerRole: authUser.role,
    targetUserId: id,
    newRole: body.role,
    contestIds: body.contest_ids,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    user: result.user,
    provisioned: result.provisioned,
    temporary_password: result.temporary_password,
  });
}
