"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trophy, Loader2, Calendar, Clock, KeyRound } from "lucide-react";
import type { Contest } from "../../../../types/contest";

export default function ContestsListPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/admin/contests")
      .then((r) => r.json())
      .then((data) => {
        if (data.contests) setContests(data.contests);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = contests.filter((c) => {
    if (filter === "ALL") return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">Contest Management</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Configure assessment timing, passcodes, questions, and publication state.
          </p>
        </div>

        <Link
          href="/admin/contests/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus size={14} />
          <span>New Contest</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {["ALL", "LIVE", "UPCOMING", "PUBLISHED", "DRAFT", "ENDED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === tab
                ? "bg-[#5B5FEF]/10 dark:bg-[#252646] text-[#5B5FEF] dark:text-[#A5B4FC] font-semibold border border-[#5B5FEF]/30"
                : "text-[var(--muted)] hover:bg-[var(--subtle)] hover:text-[var(--ink)] border border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Contests List */}
      {loading ? (
        <div className="h-48 flex items-center justify-center rounded-2xl bg-[var(--card)] border border-[var(--card-border)] shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] text-center space-y-2 shadow-xs">
          <Trophy size={28} className="mx-auto text-[var(--muted)]" />
          <div className="text-sm font-semibold text-[var(--ink)]">No contests match this filter</div>
          <div className="text-xs text-[var(--muted)]">Create a new contest to begin.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] hover:border-[#5B5FEF]/50 transition-all flex flex-col justify-between space-y-4 group shadow-xs hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/admin/contests/${c.id}`}
                    className="font-semibold text-sm group-hover:text-[#5B5FEF] dark:group-hover:text-[#A5B4FC] text-[var(--ink)] transition-colors leading-snug"
                  >
                    {c.title}
                  </Link>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                      c.status === "LIVE"
                        ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1"
                        : c.status === "PUBLISHED" || c.status === "UPCOMING"
                        ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                        : c.status === "DRAFT"
                        ? "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                        : "bg-zinc-100 dark:bg-gray-500/20 text-zinc-600 dark:text-gray-400 border border-zinc-200 dark:border-gray-500/30"
                    }`}
                  >
                    {c.status === "LIVE" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <span>{c.status}</span>
                  </span>
                </div>

                <p className="text-xs text-[var(--muted)] line-clamp-2">
                  {c.description || "No description."}
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[var(--line)] text-[11px] text-[var(--muted)]">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-[var(--muted)]" />
                  <span>Duration: {c.duration_minutes} mins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-[var(--muted)]" />
                  <span>Starts: {new Date(c.start_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[#5B5FEF] dark:text-[#A5B4FC]">
                  <KeyRound size={12} className="text-[var(--muted)]" />
                  <span>Slug: {c.slug}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                {c.status === "LIVE" ? (
                  <>
                    <Link
                      href={`/admin/contests/${c.id}/leaderboard`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
                    >
                      <Trophy size={13} className="text-amber-300" />
                      <span>Live Leaderboard</span>
                    </Link>
                    <Link
                      href={`/admin/contests/${c.id}`}
                      className="inline-flex items-center justify-center py-2 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold transition-colors"
                    >
                      Manage
                    </Link>
                  </>
                ) : c.status === "ENDED" ? (
                  <>
                    <Link
                      href={`/admin/contests/${c.id}`}
                      className="flex-1 inline-flex items-center justify-center py-2 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold transition-colors"
                    >
                      Manage
                    </Link>
                    <Link
                      href={`/admin/contests/${c.id}/analytics`}
                      className="inline-flex items-center justify-center py-2 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[#5B5FEF] dark:text-[#A5B4FC] text-xs font-semibold transition-colors"
                    >
                      Analytics
                    </Link>
                  </>
                ) : (
                  <Link
                    href={`/admin/contests/${c.id}`}
                    className="w-full inline-flex items-center justify-center py-2 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] hover:text-[#5B5FEF] text-xs font-semibold transition-colors shadow-xs"
                  >
                    Manage Contest
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
