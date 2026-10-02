"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Sparkles,
  Clock,
  Calendar,
  Layers,
  Code2,
  Users,
  ArrowRight,
  Shield,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { PublicContestSummary, ContestStatus } from "@/types/contest";

export default function ContestHubPage() {
  const { isAuthenticated, profile, role, initialize: initAuth } = useAuthStore();
  const [contests, setContests] = useState<PublicContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Initialize auth
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Fetch contests from public API
  useEffect(() => {
    let isMounted = true;
    async function loadContests() {
      try {
        const res = await fetch("/api/contest");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (isMounted) {
          setContests(data.contests || []);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : "Failed to load contests.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadContests();
    const refreshInterval = setInterval(loadContests, 15000);
    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  // 1-second ticker for live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Classify contests dynamically based on current server/client clock
  const { liveContests, upcomingContests, endedContests } = useMemo(() => {
    const live: PublicContestSummary[] = [];
    const upcoming: PublicContestSummary[] = [];
    const ended: PublicContestSummary[] = [];

    contests.forEach((c) => {
      const startTime = new Date(c.start_at).getTime();
      const endTime = new Date(c.end_at).getTime();

      let dynamicStatus: ContestStatus = c.status;
      if (c.status !== "DRAFT" && c.status !== "FINAL_RESULTS") {
        if (now < startTime) {
          dynamicStatus = "UPCOMING";
        } else if (now >= startTime && now < endTime) {
          dynamicStatus = "LIVE";
        } else {
          dynamicStatus = "ENDED";
        }
      }

      const contestWithDynamicStatus = { ...c, status: dynamicStatus };

      if (dynamicStatus === "LIVE") {
        live.push(contestWithDynamicStatus);
      } else if (dynamicStatus === "UPCOMING") {
        upcoming.push(contestWithDynamicStatus);
      } else {
        ended.push(contestWithDynamicStatus);
      }
    });

    return {
      liveContests: live,
      upcomingContests: upcoming,
      endedContests: ended,
    };
  }, [contests, now]);

  const totalPublished = contests.length;
  const isStateA = liveContests.length > 0;
  const isStateB = liveContests.length === 0 && upcomingContests.length > 0;
  const isStateC = liveContests.length === 0 && upcomingContests.length === 0 && endedContests.length > 0;
  const isStateD = totalPublished === 0;

  function formatTimeRemaining(endTimeStr: string): string {
    const msRemaining = Math.max(0, new Date(endTimeStr).getTime() - now);
    const totalSec = Math.floor(msRemaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  }

  function formatTimeUntilStart(startTimeStr: string): string {
    const msToStart = Math.max(0, new Date(startTimeStr).getTime() - now);
    const totalSec = Math.floor(msToStart / 1000);
    const days = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (days > 0) {
      return `${days}d ${h}h ${m}m`;
    }
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  }

  function formatDateTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="min-h-screen bg-[#12121A] text-[#F1F5F9] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-14 shrink-0 border-b border-[#27273D] bg-[#181824]/95 px-4 md:px-8 flex items-center justify-between z-20 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="font-bold tracking-tight text-[15px] leading-tight text-white">
                Smart<span className="text-[#5B5FEF]">Zero</span>
              </div>
              <div className="text-[8px] text-[#9498B3] font-medium tracking-wider uppercase">
                Interactive DSA Platform
              </div>
            </div>
          </Link>

          {/* Main Navigation */}
          <nav className="flex items-center gap-1 text-[12px]">
            <Link
              href="/?mode=learn"
              className="px-3 py-1.5 rounded-lg font-medium text-[#A0A6C2] hover:bg-[#1E1E2E] hover:text-white transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/?mode=teach"
              className="px-3 py-1.5 rounded-lg font-medium text-[#A0A6C2] hover:bg-[#1E1E2E] hover:text-white transition-colors"
            >
              Teach
            </Link>
            <Link
              href="/contests"
              className="px-3 py-1.5 rounded-lg font-semibold bg-[#252646] text-[#A5B4FC] transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Trophy size={13} className="text-[#FBBF24]" />
              <span>Contests</span>
            </Link>
          </nav>
        </div>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated && (role === "admin" || role === "super_admin") && (
            <Link
              href="/admin"
              className="h-8 px-2.5 rounded-xl border border-[#373A58] bg-[#1E1E2E] text-[#A5B4FC] hover:bg-[#282942] flex items-center gap-1.5 text-[11.5px] font-medium transition-colors"
              title="Open Admin Dashboard"
            >
              <Shield size={13} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {isAuthenticated ? (
            <Link
              href="/profile"
              title={`Signed in as ${profile?.full_name || profile?.email || "Student"} (${role})`}
              className="h-8 px-3 rounded-xl bg-[#1E1E2E] border border-[#27273D] text-[#E0E7FF] hover:border-[#5B5FEF] flex items-center gap-2 text-xs font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="max-w-[120px] truncate">{profile?.display_name || profile?.full_name || "Profile"}</span>
            </Link>
          ) : (
            <Link
              href="/login?redirect=/contests"
              className="h-8 px-3.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Hub Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-10">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#27273D]/60 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#5B5FEF]/15 border border-[#5B5FEF]/30 text-[#A5B4FC] text-[11px] font-medium uppercase tracking-wider">
              <Trophy size={11} className="text-[#FBBF24]" />
              <span>Real-Time Assessments</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              SMARTZERO CONTESTS
            </h1>
            <p className="text-xs sm:text-sm text-[#A0A6C2] max-w-2xl">
              Compete under proctored, real-time conditions. Solve algorithmic coding problems and conceptual computer science questions with deterministic testing and zero data leakage.
            </p>
          </div>

          {isAuthenticated && (role === "admin" || role === "super_admin") && (
            <Link
              href="/admin/contests/new"
              className="h-9 px-4 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0 shadow-sm"
            >
              <span>+ Create Contest</span>
            </Link>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
            <p className="text-xs text-[#A0A6C2]">Loading available contests...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && errorMsg && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STATE D: ZERO CONTESTS AT ALL */}
        {!loading && !errorMsg && isStateD && (
          <div className="py-16 px-6 max-w-xl mx-auto rounded-2xl border border-[#27273D] bg-[#181824] text-center space-y-4 shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-[#5B5FEF]/10 border border-[#5B5FEF]/20 text-[#5B5FEF] flex items-center justify-center mx-auto">
              <Trophy size={28} className="text-[#A5B4FC]" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white tracking-tight">
                NO LIVE CONTESTS
              </h2>
              <p className="text-xs sm:text-sm text-[#A0A6C2] leading-relaxed">
                There are currently no contests available. Check back soon for the next SmartZero contest.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/?mode=learn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#252646] hover:bg-[#2F3056] text-[#A5B4FC] text-xs font-medium transition-colors"
              >
                <span>Back to Learning</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* STATE A, B, C: CONTEST CONTENT */}
        {!loading && !errorMsg && !isStateD && (
          <div className="space-y-10">
            {/* ── SECTION 1: LIVE NOW ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  {isStateA && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isStateA ? "bg-emerald-500" : "bg-[#373A58]"
                    }`}
                  ></span>
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>LIVE NOW</span>
                  {isStateA && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                      {liveContests.length} Active
                    </span>
                  )}
                </h2>
              </div>

              {/* State A: Live contest cards */}
              {isStateA ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {liveContests.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-emerald-500/40 bg-[#181824] p-5 flex flex-col justify-between space-y-4 shadow-lg hover:border-emerald-500/70 hover:shadow-emerald-950/20 transition-all relative overflow-hidden group"
                    >
                      {/* Subtle green ambient accent */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>

                      <div className="space-y-3">
                        {/* Header: Status & Duration */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>LIVE</span>
                          </span>
                          <span className="text-[11px] text-[#A0A6C2] flex items-center gap-1">
                            <Clock size={12} className="text-[#5B5FEF]" />
                            <span>{c.duration_minutes} mins</span>
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                            {c.title}
                          </h3>
                          {c.description && (
                            <p className="text-xs text-[#A0A6C2] line-clamp-2 mt-1">
                              {c.description}
                            </p>
                          )}
                        </div>

                        {/* Question Breakdown & Time Remaining */}
                        <div className="space-y-1.5 pt-1 text-xs">
                          <div className="flex items-center justify-between text-[#CBD5E1]">
                            <span className="text-[#9498B3] flex items-center gap-1.5">
                              <Layers size={13} className="text-[#A5B4FC]" />
                              <span>Questions:</span>
                            </span>
                            <span className="font-semibold text-white">
                              {c.question_counts.total} Total ({c.question_counts.mcq} MCQ · {c.question_counts.coding} Coding)
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[#CBD5E1]">
                            <span className="text-[#9498B3] flex items-center gap-1.5">
                              <Clock size={13} className="text-emerald-400" />
                              <span>Time Remaining:</span>
                            </span>
                            <span className="font-mono font-bold text-emerald-400">
                              {formatTimeRemaining(c.end_at)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[#9498B3] text-[11px]">
                            <span>Ends:</span>
                            <span>{formatDateTime(c.end_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Prominent CTA */}
                      <Link
                        href={`/contest/${c.slug}`}
                        className="w-full h-10 rounded-xl bg-gradient-to-r from-[#5B5FEF] to-[#4D51E0] hover:from-[#4D51E0] hover:to-[#3F43CE] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-[#5B5FEF]/20 hover:shadow-lg hover:shadow-[#5B5FEF]/30"
                      >
                        <span>Join Contest</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                /* State B or C: Empty state in LIVE NOW section */
                <div className="p-6 rounded-2xl border border-[#27273D] bg-[#181824] flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 rounded-xl bg-[#252646] text-[#A5B4FC] flex items-center justify-center shrink-0">
                    <Radio size={22} className="text-[#A0A6C2]" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      NO LIVE CONTESTS
                    </h3>
                    <p className="text-xs text-[#A0A6C2]">
                      {isStateB
                        ? "There are no live contests right now. Check back soon for the next contest."
                        : "There are no active contests at this time."}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* ── SECTION 2: UPCOMING CONTESTS ── */}
            {upcomingContests.length > 0 && (
              <section className="space-y-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <Calendar size={18} className="text-[#818CF8]" />
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>UPCOMING CONTESTS</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E1B4B] text-[#818CF8] font-semibold border border-[#3730A3]">
                      {upcomingContests.length} Scheduled
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {upcomingContests.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-[#27273D] bg-[#181824] p-5 flex flex-col justify-between space-y-4 hover:border-[#373A58] transition-all group"
                    >
                      <div className="space-y-3">
                        {/* Header: Status & Starts In */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1E1B4B] border border-[#3730A3] text-[#818CF8] text-[11px] font-semibold">
                            <Clock size={11} />
                            <span>UPCOMING</span>
                          </span>
                          <span className="text-[11px] font-medium text-[#818CF8]">
                            Starts in: {formatTimeUntilStart(c.start_at)}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-base font-bold text-white tracking-tight group-hover:text-[#A5B4FC] transition-colors">
                            {c.title}
                          </h3>
                          {c.description && (
                            <p className="text-xs text-[#A0A6C2] line-clamp-2 mt-1">
                              {c.description}
                            </p>
                          )}
                        </div>

                        {/* Schedule & Question Details */}
                        <div className="space-y-1.5 pt-1 text-xs">
                          <div className="flex items-center justify-between text-[#CBD5E1]">
                            <span className="text-[#9498B3] flex items-center gap-1.5">
                              <Calendar size={13} className="text-[#818CF8]" />
                              <span>Start Time:</span>
                            </span>
                            <span className="font-semibold text-white">
                              {formatDateTime(c.start_at)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[#CBD5E1]">
                            <span className="text-[#9498B3] flex items-center gap-1.5">
                              <Clock size={13} className="text-[#818CF8]" />
                              <span>Duration:</span>
                            </span>
                            <span className="font-semibold text-white">
                              {c.duration_minutes} minutes
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[#CBD5E1]">
                            <span className="text-[#9498B3] flex items-center gap-1.5">
                              <Layers size={13} className="text-[#A5B4FC]" />
                              <span>Questions:</span>
                            </span>
                            <span className="font-semibold text-white">
                              {c.question_counts.total} Questions
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CTA */}
                      <Link
                        href={`/contest/${c.slug}`}
                        className="w-full h-9 rounded-xl bg-[#252646] hover:bg-[#2F3056] text-[#A5B4FC] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>View Details / Register</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── SECTION 3: RECENT / ENDED CONTESTS ── */}
            {endedContests.length > 0 && (
              <section className="space-y-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-[#9CA3AF]" />
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span>RECENT / ENDED CONTESTS</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1F2937] text-[#9CA3AF] font-semibold border border-[#374151]">
                      {endedContests.length} Completed
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {endedContests.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-[#27273D]/70 bg-[#181824]/70 p-5 flex flex-col justify-between space-y-4 hover:border-[#373A58] transition-all"
                    >
                      <div className="space-y-3">
                        {/* Header: Status */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1F2937] border border-[#374151] text-[#9CA3AF] text-[11px] font-semibold">
                            <span>ENDED</span>
                          </span>
                          <span className="text-[11px] text-[#6B7280]">
                            Ended: {formatDateTime(c.end_at)}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-base font-bold text-[#E2E8F0] tracking-tight">
                            {c.title}
                          </h3>
                          {c.description && (
                            <p className="text-xs text-[#6B7280] line-clamp-2 mt-1">
                              {c.description}
                            </p>
                          )}
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 pt-1 text-xs">
                          <div className="flex items-center justify-between text-[#9498B3]">
                            <span>Questions:</span>
                            <span className="text-[#CBD5E1]">
                              {c.question_counts.total} Total ({c.question_counts.mcq} MCQ · {c.question_counts.coding} Coding)
                            </span>
                          </div>

                          {c.participant_count !== undefined && c.participant_count > 0 && (
                            <div className="flex items-center justify-between text-[#9498B3]">
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                <span>Participants:</span>
                              </span>
                              <span className="text-[#CBD5E1]">
                                {c.participant_count}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Links: View Results & Leaderboard (NOT joinable live) */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Link
                          href={`/contest/${c.slug}/results`}
                          className="h-8.5 rounded-xl border border-[#27273D] bg-[#1E1E2E] hover:bg-[#282942] text-[#CBD5E1] text-[11.5px] font-medium flex items-center justify-center transition-colors"
                        >
                          View Results
                        </Link>
                        <Link
                          href={`/contest/${c.slug}/leaderboard`}
                          className="h-8.5 rounded-xl border border-[#27273D] bg-[#1E1E2E] hover:bg-[#282942] text-[#A5B4FC] text-[11.5px] font-medium flex items-center justify-center gap-1 transition-colors"
                        >
                          <Trophy size={11} className="text-[#FBBF24]" />
                          <span>Leaderboard</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27273D]/60 py-6 px-4 md:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <div>
            Smart<span className="text-[#5B5FEF]">Zero</span> Assessment Engine · Deterministic & Proctored
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors">
              Learn DSA
            </Link>
            <Link href="/contests" className="hover:text-white transition-colors">
              Contest Hub
            </Link>
            {isAuthenticated && (role === "admin" || role === "super_admin") && (
              <Link href="/admin" className="hover:text-white transition-colors">
                Admin Console
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
