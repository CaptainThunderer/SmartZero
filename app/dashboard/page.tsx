"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Code2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  LayoutDashboard,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface DashboardData {
  profile: {
    id: string;
    full_name: string;
    email: string;
    student_id?: string;
    college?: string;
    account_status?: string;
  };
  stats: {
    total_contests_available: number;
    contests_participated: number;
    contests_completed: number;
    average_score: number;
    highest_score: number;
    total_submissions: number;
    accepted_solutions: number;
    acceptance_rate: number;
  };
  language_breakdown: Record<string, number>;
  recent_contests: Array<{
    contest_id: string;
    title: string;
    slug: string;
    status: string;
    score: number;
    attempt_number: number;
    completed_at: string | null;
    violations_count: number;
    contest_status: string;
  }>;
  recommendations: Array<{
    title: string;
    difficulty: string;
    reason: string;
    actionUrl: string;
  }>;
}

export default function StudentDashboardPage() {
  const { user, initialize } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    fetch(`/api/student/dashboard${user?.id ? `?user_id=${user.id}` : ""}`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
          <span className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const stats = data?.stats;
  const isVerified = (profile?.account_status || "verified") === "verified";

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] transition-colors pb-16">
      {/* ── TOP NAV HEADER ── */}
      <header className="h-16 border-b border-[#E7E7E2] dark:border-[#27273D] bg-white dark:bg-[#181824] px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center font-bold text-xs shadow-md">
            SZ
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-[#232946] dark:text-white">
              Student Dashboard
            </span>
            <span className="hidden sm:inline-block text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] ml-2 font-mono">
              SmartZero Assessment & Analytics
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#27273D] hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors"
          >
            SmartZero Learn
          </Link>
          <Link
            href="/contests"
            className="px-3 py-1.5 rounded-lg bg-[#5B5FEF]/10 text-[#5B5FEF] dark:text-[#A5B4FC] hover:bg-[#5B5FEF]/20 font-semibold transition-colors"
          >
            Contest Hub
          </Link>
          <Link
            href="/profile"
            className="w-8 h-8 rounded-lg bg-[#27273D] text-white flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-[#5B5FEF] transition-all"
            title="Profile & Settings"
          >
            <User size={15} />
          </Link>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-900/20 via-purple-900/10 to-transparent border border-indigo-500/20 dark:border-indigo-500/30 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-[#232946] dark:text-white">
                Welcome back, {profile?.full_name || "Student"}!
              </h1>
              <div
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border ${
                  isVerified
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                }`}
              >
                {isVerified ? (
                  <>
                    <ShieldCheck size={12} />
                    <span>Verified Account</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={12} />
                    <span>Pending Verification</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] max-w-xl">
              Track your institutional exam readiness, algorithmic coding statistics, and upcoming challenge milestones.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/contests"
              className="px-5 py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-[#5B5FEF]/20 transition-all shrink-0"
            >
              <Trophy size={14} />
              <span>Browse Active Contests</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6B6F8A] dark:text-[#A0A6C2]">
              <span className="text-xs font-semibold uppercase tracking-wider">Contests</span>
              <Trophy size={16} className="text-[#5B5FEF]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#232946] dark:text-white">
              {stats?.contests_completed || 0}
              <span className="text-xs font-normal text-[#6B6F8A] dark:text-[#A0A6C2] ml-1.5">
                completed
              </span>
            </div>
            <p className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2]">
              {stats?.contests_participated || 0} participated total
            </p>
          </div>

          <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6B6F8A] dark:text-[#A0A6C2]">
              <span className="text-xs font-semibold uppercase tracking-wider">Performance</span>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#232946] dark:text-white">
              {stats?.average_score || 0}
              <span className="text-xs font-normal text-[#6B6F8A] dark:text-[#A0A6C2] ml-1">
                avg pts
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Best score: {stats?.highest_score || 0} pts
            </p>
          </div>

          <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6B6F8A] dark:text-[#A0A6C2]">
              <span className="text-xs font-semibold uppercase tracking-wider">Coding Submissions</span>
              <Code2 size={16} className="text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#232946] dark:text-white">
              {stats?.accepted_solutions || 0}
              <span className="text-xs font-normal text-[#6B6F8A] dark:text-[#A0A6C2] ml-1.5">
                accepted
              </span>
            </div>
            <p className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2]">
              {stats?.total_submissions || 0} total submissions ({stats?.acceptance_rate || 0}% rate)
            </p>
          </div>

          <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[#6B6F8A] dark:text-[#A0A6C2]">
              <span className="text-xs font-semibold uppercase tracking-wider">Integrity Status</span>
              <ShieldCheck size={16} className="text-purple-400" />
            </div>
            <div className="text-xl font-bold capitalize text-[#232946] dark:text-white">
              {profile?.account_status || "Verified"}
            </div>
            <p className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2]">
              Full access to proctored assessments
            </p>
          </div>
        </div>

        {/* ── TWO COLUMN MAIN SECTION ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT 2 COLUMNS: RECENT CONTESTS & PRACTICE */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Contests Card */}
            <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-[#5B5FEF]" />
                  <h2 className="text-sm font-bold tracking-tight text-[#232946] dark:text-white">
                    Recent Assessments & Contests
                  </h2>
                </div>
                <Link
                  href="/contests"
                  className="text-xs font-semibold text-[#5B5FEF] dark:text-[#A5B4FC] hover:underline flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              {(!data?.recent_contests || data.recent_contests.length === 0) ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-[#5B5FEF] flex items-center justify-center mx-auto">
                    <Trophy size={20} />
                  </div>
                  <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
                    You haven’t participated in any assessments yet.
                  </p>
                  <Link
                    href="/contests"
                    className="inline-flex px-4 py-2 rounded-xl bg-[#5B5FEF] text-white text-xs font-semibold shadow-xs"
                  >
                    Explore Contests
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recent_contests.map((item, idx) => (
                    <div
                      key={item.contest_id || idx}
                      className="p-4 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#232946] dark:text-white">
                            {item.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.status === "auto_submitted"
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                                : item.status === "submitted"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                                : "bg-blue-500/10 text-blue-500 border border-blue-500/30"
                            }`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] flex items-center gap-3 font-mono">
                          <span>Attempt #{item.attempt_number}</span>
                          <span>•</span>
                          <span>Score: {item.score} pts</span>
                          {item.violations_count > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-500">
                                {item.violations_count} events
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/contest/${item.slug}`}
                          className="px-3 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#27273D] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span>Contest Details</span>
                          <ExternalLink size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations Card */}
            <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <h2 className="text-sm font-bold tracking-tight text-[#232946] dark:text-white">
                  Personalized Practice Recommendations
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data?.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#5B5FEF]/15 text-[#5B5FEF]">
                          {rec.difficulty}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[#232946] dark:text-white leading-snug">
                        {rec.title}
                      </h3>
                      <p className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>

                    <Link
                      href={rec.actionUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B5FEF] dark:text-[#A5B4FC] hover:underline pt-2"
                    >
                      <span>Practice Now</span>
                      <ArrowRight size={11} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: LANGUAGE BREAKDOWN & ACTIONS */}
          <div className="space-y-6">
            {/* Language Breakdown Card */}
            <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-[#5B5FEF]" />
                <h2 className="text-sm font-bold tracking-tight text-[#232946] dark:text-white">
                  Coding Language Distribution
                </h2>
              </div>

              {Object.keys(data?.language_breakdown || {}).length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
                  No coding submissions submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data?.language_breakdown || {}).map(([lang, count]) => {
                    const total = stats?.total_submissions || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={lang} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold uppercase text-xs">{lang}</span>
                          <span className="font-mono text-[#6B6F8A] dark:text-[#A0A6C2]">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E7E7E2] dark:bg-[#27273D] overflow-hidden">
                          <div
                            className="h-full bg-[#5B5FEF] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Profile Quick Links */}
            <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-6 space-y-4 shadow-xs">
              <h2 className="text-sm font-bold tracking-tight text-[#232946] dark:text-white">
                Account & Security
              </h2>
              <div className="space-y-2 text-xs">
                <Link
                  href="/profile"
                  className="w-full p-3 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between transition-colors font-medium"
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#5B5FEF]" />
                    <span>Edit Profile Details</span>
                  </div>
                  <ArrowRight size={13} className="text-[#6B6F8A] dark:text-[#A0A6C2]" />
                </Link>

                <Link
                  href="/profile#security"
                  className="w-full p-3 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between transition-colors font-medium"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>Change Password</span>
                  </div>
                  <ArrowRight size={13} className="text-[#6B6F8A] dark:text-[#A0A6C2]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
