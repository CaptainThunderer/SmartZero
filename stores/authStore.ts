import { create } from "zustand";
import { getSupabaseBrowser } from "../lib/supabase";
import type { AuthState, UserProfile, UserRole } from "../types/auth";

interface AuthActions {
  initialize: () => Promise<void>;
  registerStudent: (details: {
    full_name: string;
    email: string;
    student_id?: string;
    college?: string;
  }) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signInWithRegisteredEmail: (
    email: string
  ) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    metadata?: { full_name?: string; student_id?: string; college?: string }
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  role: "student",
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    // Validate server session first (prevents stale or manipulated localStorage)
    if (typeof window !== "undefined") {
      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.authenticated && sessionData.user) {
            const serverUser = sessionData.user;
            const verifiedProfile: UserProfile = {
              id: serverUser.id,
              email: serverUser.email,
              full_name: serverUser.full_name || null,
              display_name: serverUser.full_name || null,
              student_id: serverUser.student_id || null,
              college: serverUser.college || null,
              avatar_url: null,
              role: (serverUser.role as UserRole) || "student",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            set({
              user: {
                id: serverUser.id,
                email: serverUser.email,
                user_metadata: { full_name: serverUser.full_name },
              },
              profile: verifiedProfile,
              role: (serverUser.role as UserRole) || "student",
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } else {
            // Server has no active session; clear local cache
            localStorage.removeItem("smartzero_student_profile");
          }
        }
      } catch {
        // Non-blocking
      }
    }

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      if (!get().isAuthenticated) {
        set({ isLoading: false, isAuthenticated: false, user: null, profile: null, role: "student" });
      } else {
        set({ isLoading: false });
      }
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          },
          isAuthenticated: true,
        });
        await get().refreshProfile();
      } else if (!get().isAuthenticated) {
        set({ user: null, profile: null, role: "student", isAuthenticated: false, isLoading: false });
      } else {
        set({ isLoading: false });
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event: string, newSession: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null } | null) => {
        if (newSession?.user) {
          set({
            user: {
              id: newSession.user.id,
              email: newSession.user.email,
              user_metadata: newSession.user.user_metadata,
            },
            isAuthenticated: true,
          });
          await get().refreshProfile();
        } else {
          set({
            user: null,
            profile: null,
            role: "student",
            isAuthenticated: false,
            isLoading: false,
          });
        }
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null, profile: null, role: "student" });
    }
  },

  refreshProfile: async () => {
    const supabase = getSupabaseBrowser();
    const currentUser = get().user;
    if (!supabase || !currentUser) {
      set({ isLoading: false });
      return;
    }

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      const userRole: UserRole = (roleData?.role as UserRole) || "student";

      const mergedProfile: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || profileData?.email || "",
        display_name: profileData?.display_name || currentUser.user_metadata?.full_name || "Student",
        full_name: profileData?.full_name || currentUser.user_metadata?.full_name || "",
        student_id: profileData?.student_id || currentUser.user_metadata?.student_id || "",
        college: profileData?.college || currentUser.user_metadata?.college || "",
        avatar_url: profileData?.avatar_url || currentUser.user_metadata?.avatar_url || null,
        created_at: profileData?.created_at,
        updated_at: profileData?.updated_at,
        role: userRole,
      };

      set({
        profile: mergedProfile,
        role: userRole,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  signInWithPassword: async (email, password) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      return { error: "Authentication service unavailable. Please check configuration." };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        set({
          user: {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata,
          },
          isAuthenticated: true,
        });
        await get().refreshProfile();
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "An unexpected error occurred." };
    }
  },

  signUpWithPassword: async (email, password, metadata) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      return { error: "Authentication service unavailable. Please check configuration." };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: metadata?.full_name || "",
            student_id: metadata?.student_id || "",
            college: metadata?.college || "",
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // Explicitly create/upsert profile row if needed
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: metadata?.full_name || "",
            student_id: metadata?.student_id || "",
            college: metadata?.college || "",
            updated_at: new Date().toISOString(),
          });

          await supabase.from("user_roles").upsert({
            user_id: data.user.id,
            role: "student",
          });
        } catch {
          // Triggers may handle this on backend
        }

        set({
          user: {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata,
          },
          isAuthenticated: true,
        });
        await get().refreshProfile();
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "An unexpected error occurred." };
    }
  },

  registerStudent: async (details) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || "Failed to register student." };
      }

      const prof: UserProfile = data.profile;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("smartzero_student_profile", JSON.stringify(prof));
        } catch {
          // Non-blocking
        }
      }

      set({
        user: {
          id: prof.id,
          email: prof.email || undefined,
          user_metadata: {
            full_name: prof.full_name || undefined,
            student_id: prof.student_id || undefined,
            college: prof.college || undefined,
          },
        },
        profile: prof,
        role: (prof.role as UserRole) || "student",
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, profile: prof };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error during registration.",
      };
    }
  },

  signInWithRegisteredEmail: async (email) => {
    try {
      const res = await fetch("/api/auth/student-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || "No student record found for this email." };
      }

      const prof: UserProfile = data.profile;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("smartzero_student_profile", JSON.stringify(prof));
        } catch {
          // Non-blocking
        }
      }

      set({
        user: {
          id: prof.id,
          email: prof.email || undefined,
          user_metadata: {
            full_name: prof.full_name || undefined,
            student_id: prof.student_id || undefined,
            college: prof.college || undefined,
          },
        },
        profile: prof,
        role: (prof.role as UserRole) || "student",
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, profile: prof };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error during sign in.",
      };
    }
  },

  signOut: async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("smartzero_student_profile");
      } catch {
        // Non-blocking
      }
    }
    // Invalidate server session cookie
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Non-blocking
    }
    const supabase = getSupabaseBrowser();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Continue clearing client state
      }
    }
    set({
      user: null,
      profile: null,
      role: "student",
      isAuthenticated: false,
      isLoading: false,
    });
  },

  updateProfile: async (updates) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: "User is not logged in." };
    }

    // Sync localStorage if database-registered student profile exists
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("smartzero_student_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          const updated = { ...parsed, ...updates, updated_at: new Date().toISOString() };
          localStorage.setItem("smartzero_student_profile", JSON.stringify(updated));
          set({
            profile: updated,
            user: {
              ...currentUser,
              user_metadata: {
                ...currentUser.user_metadata,
                full_name: updated.full_name,
                student_id: updated.student_id,
                college: updated.college,
              },
            },
          });
        }
      } catch {
        // Non-blocking
      }
    }

    const supabase = getSupabaseBrowser();
    if (supabase) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentUser.id);

        if (error) {
          return { error: error.message };
        }

        await get().refreshProfile();
        return { error: null };
      } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Failed to update profile." };
      }
    }

    return { error: null };
  },
}));
