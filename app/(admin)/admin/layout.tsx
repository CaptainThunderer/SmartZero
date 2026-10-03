"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Trophy, Plus, ArrowLeft, Shield, Users, AlertTriangle } from "lucide-react";
import { AuthGuard } from "../../../components/auth/AuthGuard";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useAuthStore } from "../../../stores/authStore";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const mustChangePassword = !!user?.user_metadata?.must_change_password;

  const navLinks = [
    { href: "/admin", label: "Overview", icon: Shield },
    { href: "/admin/contests", label: "Contests", icon: Trophy },
    { href: "/admin/contests/new", label: "New Contest", icon: Plus },
    { href: "/admin/users", label: "Users", icon: Users },
  ];

  return (
    <AuthGuard allowedRoles={["admin", "super_admin", "contest_admin"]}>
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors">
        {/* Top Header */}
        <header className="h-14 border-b border-[#E7E7E2] dark:border-[#27273D] bg-white/95 dark:bg-[#181824]/95 px-6 flex items-center justify-between z-20 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-sm">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="font-bold tracking-tight text-[15px] text-[#232946] dark:text-white">
                  Smart<span className="text-[#5B5FEF]">Zero</span>
                </span>
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#5B5FEF]/15 text-[#5B5FEF] dark:text-[#A5B4FC] font-semibold uppercase">
                  Admin
                </span>
              </div>
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      active
                        ? "bg-[#E0E7FF] dark:bg-[#252646] text-[#4338CA] dark:text-[#A5B4FC] font-semibold shadow-xs"
                        : "text-[#6B6F8A] dark:text-[#A0A6C2] hover:bg-[#F4F4F0] dark:hover:bg-[#1E1E2E] hover:text-[#232946] dark:hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <Link
              href="/contests"
              className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#5B5FEF] dark:hover:text-[#A5B4FC] flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#F4F4F0] dark:hover:bg-[#1E1E2E] transition-colors"
              title="View student-facing Contest Hub"
            >
              <Trophy size={13} className="text-[#FBBF24]" />
              <span>Contest Hub</span>
            </Link>
            <Link
              href="/"
              className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[#F4F4F0] dark:hover:bg-[#1E1E2E] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Learning</span>
            </Link>
          </div>
        </header>

        {/* Temporary Staff Password Notification Banner (Section B8) */}
        {mustChangePassword && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Your account is using the temporary staff password. Please change your password from Profile → Security.
              </span>
            </div>
            <Link
              href="/profile#security"
              className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors shrink-0 ml-4"
            >
              Change Password
            </Link>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
