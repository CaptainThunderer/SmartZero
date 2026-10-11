import { NextResponse } from "next/server";
import { endContestEarly, canUserManageContest } from "@/lib/contest/service";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function verifyAdminAuth(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (authUser) {
    if (authUser.role === "student") {
      return { isAuthorized: false, role: "student", userId: authUser.userId };
    }
    return { isAuthorized: true, role: authUser.role, userId: authUser.userId };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { isAuthorized: true, role: "admin", userId: "admin-demo-user" }; // Local dev fallback

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isAuthorized: false, role: null, userId: null };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role;
  const isAuthorized = role === "admin" || role === "super_admin" || role === "contest_admin";
  return { isAuthorized, role, userId: user.id };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAuthorized, role, userId } = await verifyAdminAuth(req);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  const { id } = await params;

  // contest_admin scoped check
  if (role === "contest_admin" && userId) {
    const canManage = await canUserManageContest(id, userId, role);
    if (!canManage) {
      return NextResponse.json(
        { error: "You are not authorized to manage this contest." },
        { status: 403 }
      );
    }
  }

  const result = await endContestEarly(id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to end contest." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    contest: result.contest,
  });
}
