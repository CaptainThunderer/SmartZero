"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Trophy, X, RefreshCw, User, Flame, Clock } from "lucide-react";
import type { LeaderboardEntry } from "@/types/contest";
import { getSupabaseBrowser } from "@/lib/supabase";

interface RealtimeLeaderboardProps {
  slug: string;
  userId?: string;
  refreshTrigger?: number; // increments on submission
}

export default function RealtimeLeaderboard({
  slug,
  userId,
  refreshTrigger = 0,
}: RealtimeLeaderboardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    fetch(`/api/contest/${slug}/leaderboard?user_id=${userId || "demo-student-user"}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.leaderboard) {
          setEntries(data.leaderboard);
          setMyRank(data.currentUserRank);
          setMyScore(data.currentUserScore);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, userId]);

  // Initial load & when triggered by a submission
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard, refreshTrigger]);

  // Supabase Realtime channel subscription for instant live updates across contestants
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const channel = supabase
      .channel(`contest-leaderboard-${slug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contest_participants",
        },
        () => {
          fetchLeaderboard();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coding_submissions",
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, fetchLeaderboard]);

  // Background polling every 20 seconds as resilient fallback
  useEffect(() => {
    const interval = setInterval(fetchLeaderboard, 20000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <>
      {/* ── COMPACT HEADER CONTROL (COLLAPSED BY DEFAULT) ── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
          isOpen
            ? "bg-[#5B5FEF] border-[#5B5FEF] text-white shadow-md"
            : "bg-[#181824] border-[#27273D] text-[#A0A6C2] hover:text-white hover:border-[#383854]"
        }`}
      >
        <Trophy size={13} className={isOpen ? "text-amber-300" : "text-amber-400"} />
        <span className="font-mono">
          {myRank ? `Rank #${myRank}` : "Live Rank"}
        </span>
        {myScore !== null && (
          <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono text-[10px] text-white">
            {myScore} pts
          </span>
        )}
      </button>

      {/* ── EXPANDABLE SLIDE-OVER DRAWER (DOES NOT DISPLACE TEST CANVAS) ── */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#181824]/98 backdrop-blur-md border-l border-[#27273D] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="h-14 px-5 border-b border-[#27273D] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold text-white">Live Leaderboard</h3>
              <span className="text-[10px] text-[#6B6F8A] font-mono">
                ({entries.length} participants)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={fetchLeaderboard}
                disabled={loading}
                title="Refresh rankings"
                className="p-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-[#A0A6C2] hover:text-white transition-colors"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-[#A0A6C2] hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Current User Snapshot Callout */}
          <div className="p-4 bg-[#12121A] border-b border-[#27273D] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#5B5FEF]/20 text-[#5B5FEF] font-bold font-mono text-[11px] flex items-center justify-center">
                #{myRank || "-"}
              </div>
              <span className="font-bold text-white">Your Position</span>
            </div>
            <div className="font-mono font-bold text-[#5B5FEF]">
              {myScore !== null ? `${myScore} pts` : "0 pts"}
            </div>
          </div>

          {/* Leaderboard Table List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#27273D]/60 text-xs">
            {/* Table Header */}
            <div className="px-4 py-2 bg-[#14141F] grid grid-cols-12 text-[10px] font-bold text-[#6B6F8A] uppercase tracking-wider sticky top-0 z-10 border-b border-[#27273D]">
              <span className="col-span-2">Rank</span>
              <span className="col-span-4">Contestant</span>
              <span className="col-span-2 text-right">Score</span>
              <span className="col-span-2 text-right">Solved</span>
              <span className="col-span-2 text-right">Time</span>
            </div>

            {entries.length === 0 ? (
              <div className="p-8 text-center text-[#6B6F8A] text-xs">
                No scores recorded yet. Be the first to submit!
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.participant_id}
                  className={`px-4 py-3 grid grid-cols-12 items-center font-mono text-[11px] transition-colors ${
                    entry.is_current_user
                      ? "bg-[#5B5FEF]/15 border-l-2 border-l-[#5B5FEF] font-bold text-white"
                      : "text-[#D8DCEF] hover:bg-[#1C1C2C]"
                  }`}
                >
                  {/* Rank */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    {entry.rank === 1 ? (
                      <span className="text-amber-400 font-bold">🥇 1</span>
                    ) : entry.rank === 2 ? (
                      <span className="text-slate-300 font-bold">🥈 2</span>
                    ) : entry.rank === 3 ? (
                      <span className="text-amber-600 font-bold">🥉 3</span>
                    ) : (
                      <span className="text-[#A0A6C2]">#{entry.rank}</span>
                    )}
                  </div>

                  {/* Contestant Name */}
                  <div className="col-span-4 truncate font-sans text-xs">
                    {entry.is_current_user ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#5B5FEF] text-white text-[10px] font-bold tracking-wider">
                        YOU
                      </span>
                    ) : (
                      <span className="text-white truncate">{entry.display_name}</span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="col-span-2 text-right font-bold text-emerald-400">
                    {entry.total_score}
                  </div>

                  {/* Solved */}
                  <div className="col-span-2 text-right text-[#A0A6C2]">
                    {entry.solved_count}/{entry.total_questions}
                  </div>

                  {/* Time */}
                  <div className="col-span-2 text-right text-[#6B6F8A] text-[10px]">
                    {entry.formatted_time}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="p-3 border-t border-[#27273D] bg-[#12121A] text-center text-[10px] text-[#6B6F8A] flex items-center justify-center gap-1.5 shrink-0">
            <Clock size={11} />
            <span>Server-authoritative • Correctness strictly dominates</span>
          </div>
        </div>
      )}
    </>
  );
}
