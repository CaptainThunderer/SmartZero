import { NextResponse } from "next/server";
import { analyzeContestCodeSimilarity } from "@/lib/judge/similarity";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Authorization check for admin roles
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
          { error: "Unauthorized. Administrator role required for code similarity analysis." },
          { status: 403 }
        );
      }
    }
  }

  const url = new URL(req.url);
  const questionIdFilter = url.searchParams.get("question_id") || undefined;

  const report = await analyzeContestCodeSimilarity(id, questionIdFilter);

  return NextResponse.json({
    success: true,
    report,
  });
}
