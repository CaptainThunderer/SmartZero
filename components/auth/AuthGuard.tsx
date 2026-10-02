"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../stores/authStore";
import type { UserRole } from "../../types/auth";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export function AuthGuard({
  children,
  allowedRoles,
  redirectTo = "/login",
}: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, role, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push(redirectTo);
      } else if (allowedRoles && allowedRoles.length > 0) {
        // If user is super_admin, they have access to admin pages as well
        const hasAccess =
          allowedRoles.includes(role) ||
          (allowedRoles.includes("admin") && role === "super_admin");

        if (!hasAccess) {
          router.push("/?error=insufficient_role");
        }
      }
    }
  }, [isLoading, isAuthenticated, role, allowedRoles, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
          <p className="text-sm font-medium text-[#6B6F8A] dark:text-[#A0A6C2]">
            Verifying SmartZero session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess =
      allowedRoles.includes(role) ||
      (allowedRoles.includes("admin") && role === "super_admin");
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
