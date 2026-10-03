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
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  let profile: UserProfile | null = null;

  const supabase = createSupabaseAdminClient() || (await createSupabaseServerClient());
  if (supabase) {
    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (!error && profileData) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profileData.id)
          .maybeSingle();

        const role = (roleData?.role as UserRole) || "student";

        profile = {
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          display_name: profileData.display_name || profileData.full_name,
          student_id: profileData.student_id,
          college: profileData.college,
          avatar_url: profileData.avatar_url,
          role,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        };
      }
    } catch {
      // Fall through to memory / offline fallback
    }
  }

  // Fallback to shared in-memory registration store
  if (!profile) {
    const localProfile = registeredProfilesByEmail.get(email);
    if (localProfile) {
      profile = localProfile;
    }
  }

  if (!profile) {
    return NextResponse.json(
      { error: "No student profile found for this email. Please register an account first." },
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
      { error: "Authentication service configuration error. Please contact the platform administrator." },
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
