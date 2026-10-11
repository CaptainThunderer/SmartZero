import { NextResponse } from "next/server";
import { deleteContest, canUserManageContest } from "@/lib/contest/service";
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

async function handleBulkDelete(req: Request) {
  const { isAuthorized, role, userId } = await verifyAdminAuth(req);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  let body: { contest_ids?: string[]; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const contestIds = body.contest_ids;
  if (!Array.isArray(contestIds) || contestIds.length === 0) {
    return NextResponse.json(
      { error: "contest_ids array is required and must contain at least one contest ID." },
      { status: 400 }
    );
  }

  const force = Boolean(body.force);
  const deleted: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of contestIds) {
    if (typeof id !== "string" || !id.trim()) continue;

    // Scoped check for contest_admin
    if (role === "contest_admin" && userId) {
      const canManage = await canUserManageContest(id, userId, role);
      if (!canManage) {
        failed.push({ id, error: "Not authorized to manage this contest." });
        continue;
      }
    }

    try {
      const result = await deleteContest(id, { force });
      if (result.success) {
        deleted.push(id);
      } else {
        failed.push({ id, error: result.error || "Failed to delete contest." });
      }
    } catch (err: unknown) {
      failed.push({ id, error: err instanceof Error ? err.message : "Error deleting contest." });
    }
  }

  return NextResponse.json({
    success: failed.length === 0,
    deleted,
    failed,
    totalRequested: contestIds.length,
    totalDeleted: deleted.length,
  });
}

export async function POST(req: Request) {
  return handleBulkDelete(req);
}

export async function DELETE(req: Request) {
  return handleBulkDelete(req);
}
