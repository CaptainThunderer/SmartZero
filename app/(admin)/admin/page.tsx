"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trophy, Users, Clock, ArrowRight, Loader2, Play } from "lucide-react";
import type { Contest } from "../../../types/contest";

export default function AdminDashboardPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/contests")
      .then((r) => r.json())
      .then((data) => {
        if (data.contests) setContests(data.contests);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const liveCount = contests.filter((c) => c.status === "LIVE").length;
  const upcomingCount = contests.filter((c) => c.status === "UPCOMING" || c.status === "PUBLISHED").length;
  const draftCount = contests.filter((c) => c.status === "DRAFT").length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--line)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Admin Assessment Center</h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Manage live competitive programming & MCQ contests, timing, and question banks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold transition-colors shrink-0 shadow-xs"
          >
            <Users size={14} className="text-[#5B5FEF]" />
            <span>Manage Users</span>
          </Link>

          <Link
            href="/admin/contests/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold shadow-sm transition-colors shrink-0"
          >
            <Plus size={15} />
            <span>Create Contest</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Play size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--ink)]">{liveCount}</div>
            <div className="text-xs text-[var(--muted)]">Live Contests</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--ink)]">{upcomingCount}</div>
            <div className="text-xs text-[var(--muted)]">Upcoming / Published</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--ink)]">{contests.length}</div>
            <div className="text-xs text-[var(--muted)]">Total Contests ({draftCount} draft)</div>
          </div>
        </div>
      </div>

      {/* Recent Contests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--ink)]">Active & Recent Contests</h2>
          <Link
            href="/admin/contests"
            className="text-xs text-[#5B5FEF] hover:text-[#4338CA] dark:hover:text-[#A5B4FC] flex items-center gap-1 transition-colors font-medium"
          >
            <span>View all</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center rounded-2xl bg-[var(--card)] border border-[var(--card-border)] shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
          </div>
        ) : contests.length === 0 ? (
          <div className="p-10 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] text-center space-y-3 shadow-xs">
            <Trophy size={32} className="mx-auto text-[var(--muted)]" />
            <h3 className="text-sm font-semibold text-[var(--ink)]">No contests created yet</h3>
            <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
              Create your first live competitive exam with MCQs, coding challenges, and server-authoritative timer.
            </p>
            <Link
              href="/admin/contests/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#5B5FEF] text-white text-xs font-medium hover:bg-[#4D51E0] transition-colors mt-2"
            >
              <Plus size={14} />
              <span>Create First Contest</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contests.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                href={`/admin/contests/${c.id}`}
                className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--card-border)] hover:border-[#5B5FEF]/50 transition-all group block space-y-3 shadow-xs hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-sm text-[var(--ink)] group-hover:text-[#5B5FEF] dark:group-hover:text-[#A5B4FC] transition-colors">
                    {c.title}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                      c.status === "LIVE"
                        ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                        : c.status === "PUBLISHED" || c.status === "UPCOMING"
                        ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                        : c.status === "DRAFT"
                        ? "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                        : "bg-zinc-100 dark:bg-gray-500/20 text-zinc-600 dark:text-gray-400 border border-zinc-200 dark:border-gray-500/30"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <p className="text-xs text-[var(--muted)] line-clamp-2">
                  {c.description || "No description provided."}
                </p>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--muted)]">
                  <div>Duration: {c.duration_minutes}m</div>
                  <div>Code: <span className="font-mono text-[var(--ink)] font-semibold">{c.slug}</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
