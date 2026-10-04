import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  createStudentSessionToken,
  getStudentSessionCookieOptions,
} from "@/lib/auth/studentSession";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import {
  registeredProfilesById,
  registeredProfilesByEmail,
} from "@/lib/contest/registrationStore";
import type { UserProfile, AccountStatus } from "@/types/auth";

export async function GET(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // Authoritative identity derived strictly from session
  const userId = authUser.userId;

  let profile: UserProfile | null = null;
  const supabase = createSupabaseAdminClient() || (await createSupabaseServerClient());

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        profile = {
          id: data.id,
          email: data.email || authUser.email,
          full_name: data.full_name || authUser.fullName,
          display_name: data.display_name || data.full_name || authUser.fullName,
          student_id: data.student_id || authUser.profile?.student_id || "",
          college: data.college || authUser.profile?.college || "",
          avatar_url: data.avatar_url || null,
          role: authUser.role,
          account_status: (data.account_status as AccountStatus) || "verified",
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }
    } catch {
      // Database fallback
    }
  }

  if (!profile) {
    const memoryProfile =
      registeredProfilesById.get(userId) ||
      registeredProfilesByEmail.get(authUser.email.toLowerCase());
    if (memoryProfile) {
      profile = {
        ...memoryProfile,
        role: authUser.role,
      };
    }
  }

  if (!profile) {
    profile = {
      id: authUser.userId,
      email: authUser.email,
      full_name: authUser.fullName,
      display_name: authUser.fullName,
      student_id: authUser.profile?.student_id || "",
      college: authUser.profile?.college || "",
      avatar_url: null,
      role: authUser.role,
      account_status: authUser.profile?.account_status || "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return NextResponse.json({ profile }, { status: 200 });
}

export async function PATCH(req: Request) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Cross-user modification defense: student cannot modify another student's data
  if (body.id && body.id !== authUser.userId) {
    return NextResponse.json(
      { error: "Forbidden. Cross-user modification rejected." },
      { status: 403 }
    );
  }
  if (body.user_id && body.user_id !== authUser.userId) {
    return NextResponse.json(
      { error: "Forbidden. Cross-user modification rejected." },
      { status: 403 }
    );
  }
  // Role escalation defense: student cannot modify role
  if (body.role && body.role !== authUser.role) {
    return NextResponse.json(
      { error: "Forbidden. Role escalation rejected." },
      { status: 403 }
    );
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : undefined;
  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : undefined;
  const college = typeof body.college === "string" ? body.college.trim() : undefined;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (fullName !== undefined) {
    if (fullName.length > 100) {
      return NextResponse.json({ error: "Full name must be under 100 characters." }, { status: 400 });
    }
    updates.full_name = fullName;
    updates.display_name = fullName;
  }
  if (studentId !== undefined) {
    if (studentId.length > 50) {
      return NextResponse.json({ error: "Student ID must be under 50 characters." }, { status: 400 });
    }
    updates.student_id = studentId;
  }
  if (college !== undefined) {
    if (college.length > 100) {
      return NextResponse.json({ error: "College must be under 100 characters." }, { status: 400 });
    }
    updates.college = college;
  }

  const supabase = createSupabaseAdminClient() || (await createSupabaseServerClient());
  if (supabase) {
    try {
      await supabase
        .from("profiles")
        .update(updates)
        .eq("id", authUser.userId);
    } catch {
      // Non-blocking
    }
  }

  // Update in-memory fallback stores
  const memoryProfile =
    registeredProfilesById.get(authUser.userId) ||
    registeredProfilesByEmail.get(authUser.email.toLowerCase());
  if (memoryProfile) {
    if (fullName !== undefined) {
      memoryProfile.full_name = fullName;
      memoryProfile.display_name = fullName;
    }
    if (studentId !== undefined) memoryProfile.student_id = studentId;
    if (college !== undefined) memoryProfile.college = college;
    memoryProfile.updated_at = new Date().toISOString();
  }

  const updatedProfile: UserProfile = {
    id: authUser.userId,
    email: authUser.email,
    full_name: fullName !== undefined ? fullName : authUser.fullName,
    display_name: fullName !== undefined ? fullName : authUser.fullName,
    student_id: studentId !== undefined ? studentId : (authUser.profile?.student_id || ""),
    college: college !== undefined ? college : (authUser.profile?.college || ""),
    avatar_url: null,
    role: authUser.role,
    account_status: authUser.profile?.account_status || "verified",
    updated_at: new Date().toISOString(),
  };

  const response = NextResponse.json({ success: true, profile: updatedProfile }, { status: 200 });

  // If student session, re-issue synchronized cookie
  if (authUser.source === "student_session") {
    try {
      const newToken = createStudentSessionToken({
        sub: authUser.userId,
        email: authUser.email,
        full_name: updatedProfile.full_name || undefined,
        student_id: updatedProfile.student_id || undefined,
        college: updatedProfile.college || undefined,
        account_status: updatedProfile.account_status,
      });
      const cookieOpts = getStudentSessionCookieOptions();
      response.cookies.set(cookieOpts.name, newToken, cookieOpts);
    } catch {
      // Non-blocking
    }
  }

  return response;
}
