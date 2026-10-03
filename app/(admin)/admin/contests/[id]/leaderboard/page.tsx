"use client";

import React, { useEffect, useState, use, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Clock,
  Radio,
  RefreshCw,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  Medal,
  Users,
  Target,
  Flame,
  CheckCircle2,
} from "lucide-react";
import type { LeaderboardEntry } from "@/types/contest";
import { getSupabaseBrowser } from "@/lib/supabase";

interface ContestInfo {
  id: string;
  slug: string;
  title: string;
  status: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  remaining_seconds: number;
  is_live: boolean;
  server_time: string;
}

export default function AdminLiveLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [contest, setContest] = useState<ContestInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Realtime & Connection Status
  const [connectionState, setConnectionState] = useState<"LIVE" | "POLLING" | "CONNECTING">("CONNECTING");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Server-authoritative remaining time countdown
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const remainingSecRef = useRef<number>(0);

  const fetchLeaderboard = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        const res = await fetch(`/api/admin/contests/${id}/leaderboard`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to load admin live leaderboard.");
          return;
        }

        setContest(data.contest);
        setLeaderboard(data.leaderboard || []);
        setTotalParticipants(data.totalParticipants || (data.leaderboard ? data.leaderboard.length : 0));
        setErrorMsg(null);
        setLastUpdated(new Date());

        if (data.contest?.remaining_seconds !== undefined) {
          setRemainingSec(data.contest.remaining_seconds);
          remainingSecRef.current = data.contest.remaining_seconds;
        }
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Error connecting to leaderboard service.");
      } finally {
        setLoading(false);
        if (isManualRefresh) setRefreshing(false);
      }
    },
    [id]
  );

  // 1. Initial Load
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // 2. Countdown clock ticked every second
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSec((prev) => {
        const next = Math.max(0, prev - 1);
        remainingSecRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Supabase Realtime Subscription with Polling Fallback
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;
    let channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowser>>["channel"]> | null = null;

    const supabase = getSupabaseBrowser();
    if (supabase) {
      try {
        channel = supabase
          .channel(`admin-live-leaderboard-${id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "contest_participants",
              filter: `contest_id=eq.${id}`,
            },
            () => {
              fetchLeaderboard();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "mcq_answers",
              filter: `contest_id=eq.${id}`,
            },
            () => {
              fetchLeaderboard();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "submissions",
              filter: `contest_id=eq.${id}`,
            },
            () => {
              fetchLeaderboard();
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setConnectionState("LIVE");
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setConnectionState("POLLING");
            }
          });
      } catch {
        setConnectionState("POLLING");
      }
    } else {
      setConnectionState("POLLING");
    }

    // Always keep safety polling every 3 seconds to guarantee freshness
    pollingInterval = setInterval(() => {
      fetchLeaderboard();
    }, 3000);

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [id, fetchLeaderboard]);

  // Format remaining time into HH:MM:SS
  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return "00:00:00 (Time Ended)";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Filtered leaderboard entries
  const filteredEntries = leaderboard.filter((entry) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      entry.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.email && entry.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.student_id && entry.student_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (entry.college && entry.college.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ||
      entry.submission_status?.toUpperCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Aggregate stats
  const topScore = leaderboard.length > 0 ? leaderboard[0].total_score : 0;
  const averageScore =
    leaderboard.length > 0
      ? Math.round(
          leaderboard.reduce((acc, curr) => acc + curr.total_score, 0) /
            leaderboard.length
        )
      : 0;

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
        <span className="text-xs text-[#A0A6C2]">Loading Live Contest Leaderboard...</span>
      </div>
    );
  }

  if (errorMsg && !contest) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-[#181824] border border-red-900/40 text-center space-y-4">
        <AlertCircle size={32} className="mx-auto text-red-400" />
        <h2 className="text-base font-bold text-white">Live Monitoring Unavailable</h2>
        <p className="text-xs text-[#A0A6C2]">{errorMsg}</p>
        <Link
          href={`/admin/contests/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5B5FEF] text-xs font-semibold text-white"
        >
          <ArrowLeft size={14} />
          <span>Back to Contest Management</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── TOP BREADCRUMB & HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#27273D]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/contests/${id}`}
              className="inline-flex items-center gap-1 text-xs text-[#A0A6C2] hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Contest Details</span>
            </Link>
            <span className="text-[#6B6F8A]">/</span>
            <span className="text-xs font-semibold text-[#A5B4FC]">Live Monitoring</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Trophy size={20} className="text-amber-400" />
              <span>SMARTZERO LIVE LEADERBOARD</span>
            </h1>

            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{contest?.status || "LIVE"}</span>
            </span>
          </div>

          <p className="text-xs text-[#A0A6C2]">
            Contest: <strong className="text-white">{contest?.title}</strong> ({contest?.slug}) • Server Authoritative Realtime Monitoring
          </p>
        </div>

        {/* Realtime Status Indicator & Manual Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#12121A] border border-[#27273D] text-[11px]">
            <Radio
              size={13}
              className={
                connectionState === "LIVE"
                  ? "text-emerald-400 animate-pulse"
                  : "text-amber-400 animate-bounce"
              }
            />
            <span className="text-[#A0A6C2]">Realtime:</span>
            <span
              className={`font-semibold ${
                connectionState === "LIVE" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {connectionState === "LIVE" ? "LIVE (Connected)" : "POLLING (3s)"}
            </span>
          </div>

          <button
            onClick={() => fetchLeaderboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27273D] bg-[#181824] hover:bg-[#1E1E2E] text-xs font-semibold text-white transition-colors disabled:opacity-50"
            title="Fetch latest rankings"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── KEY METRICS STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="flex items-center gap-1.5 text-[#A0A6C2]">
            <Users size={14} className="text-[#5B5FEF]" />
            <span className="font-semibold">Participants</span>
          </div>
          <div className="text-xl font-bold text-white">{totalParticipants}</div>
          <div className="text-[10px] text-[#6B6F8A]">Joined contestants</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="flex items-center gap-1.5 text-[#A0A6C2]">
            <Flame size={14} className="text-amber-400" />
            <span className="font-semibold">Top Score</span>
          </div>
          <div className="text-xl font-bold text-amber-400">{topScore} pts</div>
          <div className="text-[10px] text-[#6B6F8A]">Current #1 rank</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="flex items-center gap-1.5 text-[#A0A6C2]">
            <Target size={14} className="text-emerald-400" />
            <span className="font-semibold">Average Score</span>
          </div>
          <div className="text-xl font-bold text-white">{averageScore} pts</div>
          <div className="text-[10px] text-[#6B6F8A]">Across all candidates</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="flex items-center gap-1.5 text-[#A0A6C2]">
            <Clock size={14} className="text-rose-400" />
            <span className="font-semibold">Time Remaining</span>
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {formatRemainingTime(remainingSec)}
          </div>
          <div className="text-[10px] text-[#6B6F8A]">Server authoritative</div>
        </div>
      </div>

      {/* ── SEARCH & FILTERS BAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#181824] border border-[#27273D] p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6F8A]" />
          <input
            type="text"
            placeholder="Search by participant name, email, or Student ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-[#27273D] bg-[#12121A] text-xs text-white placeholder-[#6B6F8A] focus:outline-none focus:border-[#5B5FEF]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          {["ALL", "IN_PROGRESS", "SUBMITTED", "REGISTERED"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors shrink-0 ${
                statusFilter === st
                  ? "bg-[#252646] text-[#A5B4FC] border border-[#5B5FEF]/40"
                  : "text-[#A0A6C2] hover:bg-[#1E1E2E] hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIVE LEADERBOARD TABLE ── */}
      <div className="bg-[#181824] border border-[#27273D] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#27273D] bg-[#12121A]/70 text-[#A0A6C2] uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Participant</th>
                <th className="py-3 px-4">Student ID / College</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">Problems Solved</th>
                <th className="py-3 px-4 text-center">Effective Time</th>
                <th className="py-3 px-4 text-right">Status / Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27273D] text-white">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#A0A6C2]">
                    <Trophy size={28} className="mx-auto text-[#6B6F8A] mb-2" />
                    <div className="text-sm font-semibold">No participants found</div>
                    <div className="text-xs text-[#6B6F8A]">
                      {searchQuery
                        ? "Try clearing your search query."
                        : "Waiting for student activity or submissions..."}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr
                    key={entry.participant_id}
                    className="hover:bg-[#1E1E2E]/60 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center font-bold">
                        {entry.rank === 1 ? (
                          <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
                            🥇 1
                          </span>
                        ) : entry.rank === 2 ? (
                          <span className="w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/40 flex items-center justify-center font-bold">
                            🥈 2
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/40 flex items-center justify-center font-bold">
                            🥉 3
                          </span>
                        ) : (
                          <span className="text-[#A0A6C2] font-mono">#{entry.rank}</span>
                        )}
                      </div>
                    </td>

                    {/* Participant Name & Email */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-white leading-snug">
                          {entry.display_name}
                        </div>
                        {entry.email && (
                          <div className="text-[11px] text-[#A0A6C2] font-mono">
                            {entry.email}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Student ID & College */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-indigo-300">
                          {entry.student_id || "—"}
                        </div>
                        {entry.college && (
                          <div className="text-[11px] text-[#6B6F8A] truncate max-w-[180px]">
                            {entry.college}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold font-mono">
                        {entry.total_score} pts
                      </span>
                    </td>

                    {/* Problems Solved */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-white">
                          {entry.solved_count} / {entry.total_questions}
                        </span>
                        <div className="w-16 h-1.5 bg-[#12121A] rounded-full overflow-hidden mt-1 border border-[#27273D]">
                          <div
                            className="h-full bg-[#5B5FEF]"
                            style={{
                              width: `${
                                entry.total_questions > 0
                                  ? Math.min(
                                      100,
                                      (entry.solved_count / entry.total_questions) * 100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Effective Time / Penalty */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-xs text-[#A0A6C2]">
                        {entry.formatted_time}
                      </span>
                    </td>

                    {/* Status & Last Activity */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            entry.submission_status === "submitted"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : entry.submission_status === "in_progress"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {entry.submission_status}
                        </span>
                        {entry.last_activity && (
                          <span className="text-[10px] text-[#6B6F8A]">
                            {new Date(entry.last_activity).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        {filteredEntries.length > pageSize && (
          <div className="p-3 border-t border-[#27273D] bg-[#12121A]/50 flex items-center justify-between text-xs text-[#A0A6C2]">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredEntries.length)} of{" "}
              {filteredEntries.length} contestants
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-[#27273D] hover:bg-[#1E1E2E] disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-white">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-[#27273D] hover:bg-[#1E1E2E] disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER BAR ── */}
      <div className="flex items-center justify-between text-[11px] text-[#6B6F8A] pt-2">
        <div>
          Last updated: {lastUpdated.toLocaleTimeString()} • Ranking algorithm: Score (DESC) → Effective Time (ASC) → Problems Solved (DESC)
        </div>
        <Link
          href={`/admin/contests/${id}`}
          className="text-[#5B5FEF] hover:underline flex items-center gap-1 font-semibold"
        >
          <span>Return to Contest Management</span>
          <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}
