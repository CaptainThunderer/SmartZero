export type UserRole = "student" | "admin" | "super_admin" | "contest_admin";
export type AccountStatus = "pending" | "verified" | "suspended" | "disabled";

export interface UserProfile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  college: string | null;
  avatar_url: string | null;
  account_status?: AccountStatus;
  created_at?: string;
  updated_at?: string;
  role: UserRole;
}

export interface AuthState {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  profile: UserProfile | null;
  role: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
}
