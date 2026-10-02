import { create } from "zustand";
import { getSupabaseBrowser } from "../lib/supabase";
import type { AuthState, UserProfile, UserRole } from "../types/auth";

interface AuthActions {
  initialize: () => Promise<void>;
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
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      set({ isLoading: false, isAuthenticated: false, user: null, profile: null, role: "student" });
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
      } else {
        set({ user: null, profile: null, role: "student", isAuthenticated: false, isLoading: false });
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

  signOut: async () => {
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
    const supabase = getSupabaseBrowser();
    const currentUser = get().user;
    if (!supabase || !currentUser) {
      return { error: "User is not logged in." };
    }

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
  },
}));
