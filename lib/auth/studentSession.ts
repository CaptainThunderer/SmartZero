import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserRole } from "@/types/auth";

export const STUDENT_SESSION_COOKIE_NAME = "smartzero_student_session";
const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface StudentSessionPayload {
  sub: string; // profile.id
  email: string;
  full_name: string;
  student_id: string;
  college: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  source: "student_session" | "supabase_auth" | "staff_session";
  profile?: {
    student_id?: string;
    college?: string;
  };
}

/**
 * Retrieves the cryptographic signing secret for student sessions.
 *
 * PRODUCTION POLICY:
 * In production (NODE_ENV === "production" or SMARTZERO_ENV === "production"),
 * SMARTZERO_SESSION_SECRET is strictly REQUIRED and must be at least 32 characters long.
 * If missing, empty, or too weak (<32 characters):
 *   - Fails closed immediately by throwing a controlled configuration error.
 *   - Never generates, guesses, or falls back to any default secret.
 *   - The secret is strictly server-only and NEVER printed or logged.
 *
 * LOCAL DEVELOPMENT POLICY:
 * In non-production environments (local development, unit tests), if SMARTZERO_SESSION_SECRET
 * is not configured, a documented deterministic fallback derived from the project environment is permitted.
 */
export function getServerSecret(): string {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.SMARTZERO_ENV === "production";

  const configuredSecret =
    process.env.SMARTZERO_SESSION_SECRET?.trim() ||
    process.env.STUDENT_SESSION_SECRET?.trim();

  if (isProduction) {
    if (!configuredSecret) {
      throw new Error(
        "CRITICAL CONFIGURATION ERROR: SMARTZERO_SESSION_SECRET is required in production. Student session creation rejected."
      );
    }
    if (configuredSecret.length < 32) {
      throw new Error(
        "CRITICAL CONFIGURATION ERROR: SMARTZERO_SESSION_SECRET must be at least 32 characters in production. Student session creation rejected."
      );
    }
    return configuredSecret;
  }

  // Non-production (local development / testing)
  if (configuredSecret && configuredSecret.length >= 16) {
    return configuredSecret;
  }

  // LOCAL DEVELOPMENT ONLY:
  // Fallback secret for local offline testing when SMARTZERO_SESSION_SECRET is not configured in .env.local
  const devSalt = process.env.NEXT_PUBLIC_SUPABASE_URL || "smartzero-local-dev-fallback-salt-2026";
  return crypto.createHash("sha256").update(`smartzero-dev-session-${devSalt}`).digest("hex");
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token for a verified student.
 */
export function createStudentSessionToken(
  data: {
    sub?: string;
    userId?: string;
    email: string;
    full_name?: string;
    fullName?: string;
    student_id?: string;
    studentId?: string;
    college?: string;
  },
  expiresInSeconds: number = DEFAULT_EXPIRATION_SECONDS
): string {
  const secret = getServerSecret();
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const sub = (data.sub || data.userId || "").trim();
  const fullName = (data.full_name || data.fullName || "").trim();
  const studentId = (data.student_id || data.studentId || "").trim();

  const payload: StudentSessionPayload = {
    sub,
    email: data.email.toLowerCase().trim(),
    full_name: fullName,
    student_id: studentId,
    college: (data.college || "").trim(),
    role: "student",
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signatureInput)
    .digest("base64url");

  return `${signatureInput}.${signature}`;
}

/**
 * Validates the HMAC-SHA256 signature and expiration of a student session token.
 * Returns the decoded payload if valid, or null if tampered or expired.
 */
export function verifyStudentSessionToken(token: string): StudentSessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, providedSignature] = parts;
  let secret: string;
  try {
    secret = getServerSecret();
  } catch {
    return null;
  }

  // Verify signature with constant-time comparison
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  const providedBuf = Buffer.from(providedSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload: StudentSessionPayload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null; // Expired
    }

    const validRoles: UserRole[] = ["student", "admin", "super_admin", "contest_admin"];
    if (!validRoles.includes(payload.role) || !payload.sub || !payload.email) {
      return null; // Invalid claims
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token for staff / administrators.
 * Used for server-authoritative staff API access and automated testing.
 */
export function createStaffSessionToken(
  data: {
    userId: string;
    email: string;
    role: "super_admin" | "admin" | "contest_admin";
    fullName?: string;
  },
  expiresInSeconds: number = DEFAULT_EXPIRATION_SECONDS
): string {
  const secret = getServerSecret();
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: StudentSessionPayload = {
    sub: data.userId.trim(),
    email: data.email.toLowerCase().trim(),
    full_name: (data.fullName || "Staff Member").trim(),
    student_id: "",
    college: "",
    role: data.role,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signatureInput)
    .digest("base64url");

  return `${signatureInput}.${signature}`;
}

/**
 * Returns options for setting the secure httpOnly student session cookie.
 */
export function getStudentSessionCookieOptions(maxAge: number = DEFAULT_EXPIRATION_SECONDS) {
  return {
    name: STUDENT_SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Returns options for clearing the student session cookie on sign-out.
 */
export function getStudentLogoutCookieOptions() {
  return {
    name: STUDENT_SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}

/**
 * Authenticates the incoming request against:
 * 1. Cryptographically signed student session cookie or Bearer token.
 * 2. Supabase Auth session (for administrators and staff).
 *
 * Never trusts arbitrary client-supplied body.user_id or localStorage.
 */
export async function getAuthenticatedUser(req?: Request): Promise<AuthenticatedUser | null> {
  if (!req) return null;
  // 1. Check Authorization header
  let token: string | null = null;
  const authHeader = req.headers?.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  // 2. Check httpOnly Cookie header
  if (!token) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${STUDENT_SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  // 3. Verify student token if present
  if (token) {
    const studentSession = verifyStudentSessionToken(token);
    if (studentSession) {
      return {
        userId: studentSession.sub,
        email: studentSession.email,
        fullName: studentSession.full_name,
        role: studentSession.role as UserRole,
        source: studentSession.role === "student" ? "student_session" : "staff_session",
        profile: {
          student_id: studentSession.student_id,
          college: studentSession.college,
        },
      };
    }
  }

  // 4. Verify Supabase Auth session for admins/staff
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const role = (roleData?.role as UserRole) || "admin";
        return {
          userId: user.id,
          email: user.email || "",
          fullName: user.user_metadata?.full_name || user.email || "Admin",
          role,
          source: "supabase_auth",
        };
      }
    }
  } catch {
    // Supabase auth client not initialized or offline
  }

  return null;
}

/**
 * Enforces cross-user impersonation protection.
 * - If client requests an operation for a target user ID, verifies it matches their authenticated identity.
 * - Non-admin users attempting to act on behalf of another user ID are rejected with 403 Forbidden.
 * - Returns the authoritative userId to use for all downstream database/contest queries.
 */
export function validateStudentIdentity(
  authUser: AuthenticatedUser,
  requestedUserId?: string | null
): {
  authorized: boolean;
  error?: string;
  status?: number;
  authoritativeUserId: string;
} {
  const trimmedRequested = requestedUserId?.trim();

  // If no user_id was requested by client, use authenticated userId
  if (!trimmedRequested) {
    return { authorized: true, authoritativeUserId: authUser.userId };
  }

  // If user is admin/super_admin/contest_admin, they have administrative delegation rights
  if (authUser.role === "admin" || authUser.role === "super_admin" || authUser.role === "contest_admin") {
    return { authorized: true, authoritativeUserId: trimmedRequested };
  }

  // For students: requested user_id MUST strictly match their own authenticated user_id
  if (trimmedRequested !== authUser.userId) {
    return {
      authorized: false,
      error: "Forbidden. Cross-user identity manipulation detected. You cannot perform operations as another user.",
      status: 403,
      authoritativeUserId: authUser.userId,
    };
  }

  return { authorized: true, authoritativeUserId: authUser.userId };
}
