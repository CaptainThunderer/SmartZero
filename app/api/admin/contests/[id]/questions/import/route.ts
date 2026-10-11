import { NextResponse } from "next/server";
import {
  detectFormat,
  parseRawFile,
  validateImportQuestions,
  persistImportedQuestions,
  detectDuplicatesWithExisting,
} from "@/lib/contest/importer";
import { getContestById, getContestQuestions } from "@/lib/contest/service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth/studentSession";

async function verifyAdminAuth(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (authUser && authUser.role !== "student") return true;

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthorized = await verifyAdminAuth(req);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
  }

  const { id: contest_id } = await params;

  const contentType = req.headers.get("content-type") || "";

  // 1. Commit action (persist pre-validated questions)
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      if (!Array.isArray(body.questions) || body.questions.length === 0) {
        return NextResponse.json(
          { error: "Invalid payload. 'questions' array is required." },
          { status: 400 }
        );
      }

      const mode = body.mode === "replace" ? "replace" : "append";
      const deduplicate = Boolean(body.deduplicate);

      const result = await persistImportedQuestions(contest_id, body.questions, {
        mode,
        deduplicate,
      });

      return NextResponse.json({
        success: true,
        importedCount: result.importedCount,
        linkedQuestions: result.linkedQuestions,
        mode: result.mode,
        replacedCount: result.replacedCount,
        skippedDuplicatesCount: result.skippedDuplicatesCount,
      });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to persist questions." },
        { status: 500 }
      );
    }
  }

  // 2. Parse & Validate file upload (Preview mode)
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string" || !(file instanceof Blob)) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }

      const filename = file.name || "questions.json";
      const format = detectFormat(filename);

      if (format === "unsupported") {
        return NextResponse.json(
          { error: "Unsupported file extension. Only .json, .csv, .xlsx, and .xls are supported." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const rawRows = parseRawFile(format, buffer);
      const validationResult = validateImportQuestions(rawRows, format);

      const contest = await getContestById(contest_id);
      const existingQuestions = await getContestQuestions(contest_id, "admin");
      const duplicatesWithExisting = detectDuplicatesWithExisting(
        existingQuestions,
        validationResult.validQuestions
      );

      return NextResponse.json({
        preview: validationResult,
        contestName: contest?.title || "Contest",
        existingCount: existingQuestions.length,
        duplicatesWithExisting,
      });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to parse file." },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: "Unsupported Content-Type. Send multipart/form-data or application/json." },
    { status: 400 }
  );
}
