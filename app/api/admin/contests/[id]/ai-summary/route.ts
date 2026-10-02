import { NextResponse } from "next/server";
import { generateAdminContestAISummary } from "@/lib/contest/postContestAI";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(
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

  try {
    const summary = await generateAdminContestAISummary(id);
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to generate cohort AI summary.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

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

  try {
    const summary = await generateAdminContestAISummary(id);
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to generate cohort AI summary.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
