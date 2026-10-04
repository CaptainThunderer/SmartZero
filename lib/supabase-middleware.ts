import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabaseResponse = NextResponse.next({
    request,
  });

  let user: any = null;
  let supabase: any = null;

  if (url && key) {
    supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refresh auth token only when Supabase auth cookies are present
    const hasSupabaseCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
    if (hasSupabaseCookie) {
      try {
        const { data } = await supabase.auth.getUser();
        user = data?.user || null;
      } catch {
        user = null;
      }
    }
  }

  const pathname = request.nextUrl.pathname;

  // Check for authenticated student session cookie
  const studentSessionCookie = request.cookies.get("smartzero_student_session")?.value;
  let hasValidStudentCookie = false;
  if (studentSessionCookie) {
    try {
      const parts = studentSessionCookie.split(".");
      if (parts.length === 3) {
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        const payload = JSON.parse(atob(base64));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp > now && payload.sub && payload.email) {
          hasValidStudentCookie = true;
        }
      }
    } catch {
      hasValidStudentCookie = false;
    }
  }

  // Protect /profile: require either Supabase Auth user or valid student session
  if (pathname.startsWith("/profile") && !user && !hasValidStudentCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check admin or super_admin role
    if (supabase) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = roleData?.role;
      if (role !== "admin" && role !== "super_admin" && role !== "contest_admin") {
        // Forbidden: redirect to home or unauthorized message
        return NextResponse.redirect(new URL("/?error=unauthorized_admin", request.url));
      }
    }
  }

  return supabaseResponse;
}
