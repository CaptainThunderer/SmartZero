"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Trophy, Plus, ArrowLeft, Shield } from "lucide-react";
import { AuthGuard } from "../../../components/auth/AuthGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/admin", label: "Overview", icon: Shield },
    { href: "/admin/contests", label: "Contests", icon: Trophy },
    { href: "/admin/contests/new", label: "New Contest", icon: Plus },
  ];

  return (
    <AuthGuard allowedRoles={["admin", "super_admin", "contest_admin"]}>
      <div className="min-h-screen bg-[#12121A] text-[#F1F5F9] flex flex-col font-sans">
        {/* Top Header */}
        <header className="h-14 border-b border-[#27273D] bg-[#181824]/95 px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-sm">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="font-bold tracking-tight text-[15px]">
                  Smart<span className="text-[#5B5FEF]">Zero</span>
                </span>
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#5B5FEF]/20 text-[#A5B4FC] font-semibold uppercase">
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
                        ? "bg-[#252646] text-[#A5B4FC]"
                        : "text-[#A0A6C2] hover:bg-[#1E1E2E] hover:text-white"
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
            <Link
              href="/contests"
              className="text-xs text-[#A0A6C2] hover:text-[#A5B4FC] flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#1E1E2E] transition-colors"
              title="View student-facing Contest Hub"
            >
              <Trophy size={13} className="text-[#FBBF24]" />
              <span>Contest Hub</span>
            </Link>
            <Link
              href="/"
              className="text-xs text-[#A0A6C2] hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[#1E1E2E] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Learning</span>
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
