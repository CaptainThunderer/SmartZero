import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserRole, AccountStatus } from "@/types/auth";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      users: [
        {
          id: "demo-student-user",
          email: "student@smartzero.edu",
          full_name: "Demo Student",
          role: "student",
          account_status: "verified",
          created_at: new Date().toISOString(),
        },
      ],
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Check admin role
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const callerRole = roleRow?.role as UserRole | undefined;
  if (callerRole !== "admin" && callerRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }

  // Fetch profiles and user_roles
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, display_name, student_id, college, account_status, created_at");

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

  const users = (profiles || []).map((p) => ({
    ...p,
    account_status: (p.account_status as AccountStatus) || "verified",
    role: (roleMap.get(p.id) as UserRole) || "student",
  }));

  return NextResponse.json({ users, callerRole });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const callerRole = roleRow?.role as UserRole | undefined;
  if (callerRole !== "admin" && callerRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }

  let body: {
    target_user_id: string;
    account_status?: AccountStatus;
    role?: UserRole;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.target_user_id) {
    return NextResponse.json({ error: "target_user_id is required." }, { status: 400 });
  }

  // Enforce role hierarchy: only super_admin can set admin or super_admin
  if (body.role && (body.role === "admin" || body.role === "super_admin")) {
    if (callerRole !== "super_admin") {
      return NextResponse.json(
        { error: "Only Super Administrators can promote users to Admin or Super Admin." },
        { status: 403 }
      );
    }
  }

  // Update profile account status if requested
  if (body.account_status) {
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ account_status: body.account_status })
      .eq("id", body.target_user_id);

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
  }

  // Update role if requested
  if (body.role) {
    const { error: roleErr } = await supabase.from("user_roles").upsert({
      user_id: body.target_user_id,
      role: body.role,
    });

    if (roleErr) {
      return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    target_user_id: body.target_user_id,
    account_status: body.account_status,
    role: body.role,
  });
}
