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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#27273D]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Assessment Center</h1>
          <p className="text-xs text-[#A0A6C2] mt-1">
            Manage live competitive programming & MCQ contests, timing, and question banks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#27273D] bg-[#181824] hover:bg-[#1E1E2E] text-white text-xs font-semibold transition-colors shrink-0"
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
        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Play size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold">{liveCount}</div>
            <div className="text-xs text-[#A0A6C2]">Live Contests</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold">{upcomingCount}</div>
            <div className="text-xs text-[#A0A6C2]">Upcoming / Published</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold">{contests.length}</div>
            <div className="text-xs text-[#A0A6C2]">Total Contests ({draftCount} draft)</div>
          </div>
        </div>
      </div>

      {/* Recent Contests */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Active & Recent Contests</h2>
          <Link
            href="/admin/contests"
            className="text-xs text-[#5B5FEF] hover:text-[#A5B4FC] flex items-center gap-1 transition-colors"
          >
            <span>View all</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center rounded-2xl bg-[#181824] border border-[#27273D]">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
          </div>
        ) : contests.length === 0 ? (
          <div className="p-10 rounded-2xl bg-[#181824] border border-[#27273D] text-center space-y-3">
            <Trophy size={32} className="mx-auto text-[#6B6F8A]" />
            <h3 className="text-sm font-semibold">No contests created yet</h3>
            <p className="text-xs text-[#A0A6C2] max-w-sm mx-auto">
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
                className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] hover:border-[#5B5FEF]/50 transition-all group block space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-sm group-hover:text-[#A5B4FC] transition-colors">
                    {c.title}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      c.status === "LIVE"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : c.status === "PUBLISHED" || c.status === "UPCOMING"
                        ? "bg-blue-500/20 text-blue-400"
                        : c.status === "DRAFT"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <p className="text-xs text-[#A0A6C2] line-clamp-2">
                  {c.description || "No description provided."}
                </p>

                <div className="pt-2 border-t border-[#27273D] flex items-center justify-between text-[11px] text-[#6B6F8A]">
                  <div>Duration: {c.duration_minutes}m</div>
                  <div>Code: <span className="font-mono text-[#A0A6C2]">{c.slug}</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
