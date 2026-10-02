import { NextResponse } from "next/server";
import { getAdminContestAnalytics } from "@/lib/contest/analytics";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin authorization if Supabase is connected
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdmin = roleData?.some((r) =>
        ["admin", "super_admin", "contest_admin"].includes(r.role)
      );

      if (!hasAdmin) {
        return NextResponse.json(
          { error: "Unauthorized. Administrator role required." },
          { status: 403 }
        );
      }
    }
  }

  const analytics = await getAdminContestAnalytics(id);

  if (!analytics) {
    return NextResponse.json({ error: "Contest not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    analytics,
  });
}
