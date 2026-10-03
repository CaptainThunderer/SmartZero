import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import type { UserProfile, UserRole } from "@/types/auth";
import { registeredProfilesByEmail } from "@/lib/contest/registrationStore";
import { createStudentSessionToken, getStudentSessionCookieOptions } from "@/lib/auth/studentSession";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body.", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "Please enter your email address.", code: "EMAIL_REQUIRED" },
      { status: 400 }
    );
  }

  // Basic email pattern validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address.", code: "INVALID_EMAIL" },
      { status: 400 }
    );
  }

  let profile: UserProfile | null = null;
  const supabase = createSupabaseAdminClient() || (await createSupabaseServerClient());
  let rpcFailed = false;

  if (supabase) {
    try {
      // Use Security Definer RPC get_student_by_email (accessible to anon and authenticated)
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_student_by_email", {
        p_email: email,
      });

      if (rpcErr) {
        console.warn("[Student Access RPC Notice]", rpcErr.message);
        rpcFailed = true;
      } else if (rpcData && rpcData.id) {
        const role = (rpcData.role || "student").toLowerCase();

        // WRONG FLOW DEFENSE: Staff/Admins cannot authenticate as students
        if (role === "admin" || role === "super_admin" || role === "contest_admin") {
          return NextResponse.json(
            {
              error: "No student profile found for this email. Staff accounts must sign in using the Admin / Staff portal.",
              code: "STAFF_ACCOUNT_DETECTED",
            },
            { status: 404 }
          );
        }

        profile = {
          id: rpcData.id,
          email: rpcData.email,
          full_name: rpcData.full_name || "",
          display_name: rpcData.display_name || rpcData.full_name || "Student",
          student_id: rpcData.student_id || "",
          college: rpcData.college || "",
          avatar_url: rpcData.avatar_url || null,
          role: "student",
          account_status: rpcData.account_status || "verified",
          created_at: rpcData.created_at || new Date().toISOString(),
          updated_at: rpcData.updated_at || new Date().toISOString(),
        };
      }
    } catch (err: unknown) {
      console.warn("[Student Access Exception]", err instanceof Error ? err.message : err);
      rpcFailed = true;
    }
  }

  // Fallback to shared in-memory registration store (for offline dev/tests)
  if (!profile) {
    const localProfile = registeredProfilesByEmail.get(email);
    if (localProfile) {
      if (
        localProfile.role === "admin" ||
        localProfile.role === "super_admin" ||
        localProfile.role === "contest_admin"
      ) {
        return NextResponse.json(
          {
            error: "No student profile found for this email. Staff accounts must sign in using the Admin / Staff portal.",
            code: "STAFF_ACCOUNT_DETECTED",
          },
          { status: 404 }
        );
      }
      profile = localProfile;
    }
  }

  if (!profile) {
    // If the database RPC completely failed and no local profile exists, inform user of service error
    if (rpcFailed) {
      return NextResponse.json(
        {
          error: "Authentication service temporarily unreachable. Please try again later.",
          code: "SERVICE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "No student profile found for this email. Please register an account first.",
        code: "STUDENT_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  // Issue server-signed student session token
  let token: string;
  try {
    token = createStudentSessionToken({
      sub: profile.id,
      email: profile.email || email,
      full_name: profile.full_name || undefined,
      student_id: profile.student_id || undefined,
      college: profile.college || undefined,
    });
  } catch (err: unknown) {
    console.error("[Session Configuration Error]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: "Authentication service configuration error. Please contact the platform administrator.",
        code: "SESSION_CONFIG_ERROR",
      },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    success: true,
    profile,
    token,
  });

  const cookieOptions = getStudentSessionCookieOptions();
  response.cookies.set(cookieOptions.name, token, cookieOptions);

  return response;
}
