import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";
import { assignContestAdmin, removeContestAdmin } from "@/lib/contest/service";
import type { UserRole, AccountStatus } from "@/types/auth";

async function getAdminClient() {
  return createSupabaseAdminClient() || (await createSupabaseServerClient());
}

export async function GET(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (authUser.role !== "admin" && authUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }

  const callerRole = authUser.role;
  const supabase = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({
      users: [
        {
          id: authUser.userId,
          email: authUser.email,
          full_name: authUser.fullName,
          role: authUser.role,
          account_status: "verified",
          created_at: new Date().toISOString(),
          assigned_contests: [],
        },
      ],
      contests: [],
      callerRole,
    });
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

  // Fetch contest admin assignments
  const { data: assignments } = await supabase
    .from("contest_admin_assignments")
    .select("contest_id, admin_id");

  const assignmentsMap = new Map<string, string[]>();
  (assignments || []).forEach((a: { contest_id: string; admin_id: string }) => {
    const list = assignmentsMap.get(a.admin_id) || [];
    list.push(a.contest_id);
    assignmentsMap.set(a.admin_id, list);
  });

  // Fetch available contests for assignment dropdown
  const { data: contestsData } = await supabase
    .from("contests")
    .select("id, title, slug, status")
    .order("created_at", { ascending: false });

  const users = (profiles || []).map((p) => ({
    ...p,
    account_status: (p.account_status as AccountStatus) || "verified",
    role: (roleMap.get(p.id) as UserRole) || "student",
    assigned_contests: assignmentsMap.get(p.id) || [],
  }));

  return NextResponse.json({
    users,
    contests: contestsData || [],
    callerRole,
  });
}

export async function POST(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Only Super Admin can provision staff accounts
  if (authUser.role !== "super_admin") {
    return NextResponse.json(
      { error: "Forbidden: Only Super Administrators can provision staff accounts." },
      { status: 403 }
    );
  }

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    role?: UserRole;
    contest_ids?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const fullName = body.full_name?.trim();
  const role = body.role;

  if (!email || !password || !fullName || !role) {
    return NextResponse.json(
      { error: "Email, password, full name, and role are required." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long." },
      { status: 400 }
    );
  }

  // Allow only staff roles: admin or contest_admin
  if (role !== "admin" && role !== "contest_admin") {
    return NextResponse.json(
      { error: "Invalid staff role. Permitted roles: 'admin' or 'contest_admin'." },
      { status: 400 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  let createdUserId: string;

  if (adminClient) {
    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create Supabase Auth user." },
        { status: 400 }
      );
    }

    createdUserId = authData.user.id;

    // 2. Upsert profile
    await adminClient.from("profiles").upsert({
      id: createdUserId,
      email,
      full_name: fullName,
      display_name: fullName,
      account_status: "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Upsert role
    await adminClient.from("user_roles").upsert({
      user_id: createdUserId,
      role,
    });

    // 4. Assign to specific contests if contest_admin
    if (role === "contest_admin" && Array.isArray(body.contest_ids)) {
      for (const cid of body.contest_ids) {
        await adminClient.from("contest_admin_assignments").upsert(
          {
            contest_id: cid,
            admin_id: createdUserId,
            assigned_by: authUser.userId,
          },
          { onConflict: "contest_id,admin_id" }
        );
      }
    }
  } else {
    // Local fallback for offline unit testing
    createdUserId = `staff-${Date.now()}`;
  }

  return NextResponse.json({
    success: true,
    user: {
      id: createdUserId,
      email,
      full_name: fullName,
      role,
      assigned_contests: body.contest_ids || [],
    },
  });
}

export async function PATCH(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (authUser.role !== "admin" && authUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }

  const callerRole = authUser.role;
  const supabase = await getAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  let body: {
    target_user_id: string;
    account_status?: AccountStatus;
    role?: UserRole;
    contest_ids?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.target_user_id) {
    return NextResponse.json({ error: "target_user_id is required." }, { status: 400 });
  }

  // Enforce role hierarchy: only super_admin can set admin, super_admin, or contest_admin
  if (body.role) {
    if (callerRole !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Administrators can modify administrative roles." },
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

    // Update contest assignments if contest_ids provided
    if (body.role === "contest_admin" && Array.isArray(body.contest_ids)) {
      // Clear existing
      await supabase
        .from("contest_admin_assignments")
        .delete()
        .eq("admin_id", body.target_user_id);

      // Insert new assignments
      for (const cid of body.contest_ids) {
        await supabase.from("contest_admin_assignments").insert({
          contest_id: cid,
          admin_id: body.target_user_id,
          assigned_by: authUser.userId,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    target_user_id: body.target_user_id,
    account_status: body.account_status,
    role: body.role,
  });
}
