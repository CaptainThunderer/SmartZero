import { NextResponse } from "next/server";
import { getStudentLogoutCookieOptions } from "@/lib/auth/studentSession";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully." });

  // Clear student session cookie
  const logoutOptions = getStudentLogoutCookieOptions();
  response.cookies.set(logoutOptions.name, "", logoutOptions);

  // Clear Supabase Auth session if active
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // Continue
  }

  return response;
}
