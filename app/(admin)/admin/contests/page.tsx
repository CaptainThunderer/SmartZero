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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#27273D]">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Contest Management</h1>
          <p className="text-xs text-[#A0A6C2] mt-0.5">
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
                ? "bg-[#252646] text-[#A5B4FC]"
                : "text-[#A0A6C2] hover:bg-[#1E1E2E] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Contests List */}
      {loading ? (
        <div className="h-48 flex items-center justify-center rounded-2xl bg-[#181824] border border-[#27273D]">
          <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#181824] border border-[#27273D] text-center space-y-2">
          <Trophy size={28} className="mx-auto text-[#6B6F8A]" />
          <div className="text-sm font-semibold">No contests match this filter</div>
          <div className="text-xs text-[#A0A6C2]">Create a new contest to begin.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/contests/${c.id}`}
              className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] hover:border-[#5B5FEF]/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-sm group-hover:text-[#A5B4FC] transition-colors leading-snug">
                    {c.title}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
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
                  {c.description || "No description."}
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#27273D] text-[11px] text-[#A0A6C2]">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-[#6B6F8A]" />
                  <span>Duration: {c.duration_minutes} mins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-[#6B6F8A]" />
                  <span>Starts: {new Date(c.start_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[#5B5FEF]">
                  <KeyRound size={12} className="text-[#6B6F8A]" />
                  <span>Slug: {c.slug}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
