import { NextResponse } from "next/server";
import {
  detectFormat,
  parseRawFile,
  validateImportQuestions,
  persistImportedQuestions,
} from "@/lib/contest/importer";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function verifyAdminAuth() {
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
  const isAuthorized = await verifyAdminAuth();
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

      const result = await persistImportedQuestions(contest_id, body.questions);
      return NextResponse.json({
        success: true,
        importedCount: result.importedCount,
        linkedQuestions: result.linkedQuestions,
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
          { error: "Unsupported file extension. Only .json, .csv, and .xlsx are supported." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const rawRows = parseRawFile(format, buffer);
      const validationResult = validateImportQuestions(rawRows, format);

      return NextResponse.json({ preview: validationResult });
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
