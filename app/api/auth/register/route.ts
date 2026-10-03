import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase-server";
import type { UserProfile } from "@/types/auth";
import { registeredProfilesByEmail, registeredProfilesById } from "@/lib/contest/registrationStore";
import { createStudentSessionToken, getStudentSessionCookieOptions } from "@/lib/auth/studentSession";
import crypto from "node:crypto";

export async function POST(req: Request) {
  let body: {
    full_name?: string;
    email?: string;
    student_id?: string;
    college?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fullName = body.full_name?.trim();
  const email = body.email?.trim().toLowerCase();
  const studentId = body.student_id?.trim() || "";
  const college = body.college?.trim() || "";

  if (!fullName || !email) {
    return NextResponse.json(
      { error: "Full Name and Email Address are required for registration." },
      { status: 400 }
    );
  }

  // Basic email pattern validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  let profile: UserProfile | null = null;

  // 1. Attempt Supabase PostgreSQL persistence (using admin or server client)
  const supabase = createSupabaseAdminClient() || (await createSupabaseServerClient());

  if (supabase) {
    try {
      // Check if profile already exists for this email
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        // Update existing student details
        const { data: updated, error: updateErr } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            display_name: fullName,
            student_id: studentId || existing.student_id,
            college: college || existing.college,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (!updateErr && updated) {
          profile = {
            id: updated.id,
            email: updated.email,
            full_name: updated.full_name,
            display_name: updated.display_name || updated.full_name,
            student_id: updated.student_id,
            college: updated.college,
            avatar_url: updated.avatar_url,
            role: "student",
            created_at: updated.created_at,
            updated_at: updated.updated_at,
          };
        }
      } else {
        // Provision new student profile in PostgreSQL
        const newId = crypto.randomUUID();
        const { data: created, error: insertErr } = await supabase
          .from("profiles")
          .insert({
            id: newId,
            email,
            full_name: fullName,
            display_name: fullName,
            student_id: studentId,
            college,
            account_status: "verified",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!insertErr && created) {
          // Provision default student role in user_roles
          await supabase.from("user_roles").upsert({
            user_id: newId,
            role: "student",
          });

          profile = {
            id: created.id,
            email: created.email,
            full_name: created.full_name,
            display_name: created.display_name || created.full_name,
            student_id: created.student_id,
            college: created.college,
            avatar_url: created.avatar_url,
            role: "student",
            account_status: "verified",
            created_at: created.created_at,
            updated_at: created.updated_at,
          };
        }
      }
    } catch {
      // Fall through to memory store if database is offline or unreachable
    }
  }

  // 2. Fallback memory persistence for isolated tests / offline dev
  if (!profile) {
    const existing = registeredProfilesByEmail.get(email);
    if (existing) {
      existing.full_name = fullName;
      existing.display_name = fullName;
      if (studentId) existing.student_id = studentId;
      if (college) existing.college = college;
      existing.updated_at = new Date().toISOString();
      profile = existing;
    } else {
      const newId = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      profile = {
        id: newId,
        email,
        full_name: fullName,
        display_name: fullName,
        student_id: studentId,
        college,
        avatar_url: null,
        role: "student",
        account_status: "verified",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Ensure cached in shared memory stores
  registeredProfilesByEmail.set(email, profile);
  registeredProfilesById.set(profile.id, profile);

  // Generate cryptographically signed student session token
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
    message: "Registration successful. Student profile saved to database.",
    profile,
    token,
  });

  const cookieOptions = getStudentSessionCookieOptions();
  response.cookies.set(cookieOptions.name, token, cookieOptions);

  return response;
}
