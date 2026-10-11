"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Trophy,
  Loader2,
  Calendar,
  Clock,
  KeyRound,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import type { Contest } from "../../../../types/contest";

export default function ContestsListPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  // Bulk Selection & Deletion State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  const loadContests = () => {
    fetch("/api/admin/contests")
      .then((r) => r.json())
      .then((data) => {
        if (data.contests) setContests(data.contests);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContests();
  }, []);

  const filtered = contests.filter((c) => {
    if (filter === "ALL") return true;
    return c.status === filter;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const selectedContests = contests.filter((c) => selectedIds.has(c.id));

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    setBulkDeleteError(null);

    try {
      const res = await fetch("/api/admin/contests/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contest_ids: Array.from(selectedIds),
          force: forceDelete,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setBulkDeleteError(data.error || "Failed to bulk delete contests.");
      } else {
        const deletedSet = new Set<string>(data.deleted || []);
        setContests((prev) => prev.filter((c) => !deletedSet.has(c.id)));
        setSelectedIds(new Set());
        setShowBulkDeleteModal(false);

        if (data.failed && data.failed.length > 0) {
          setBulkDeleteError(
            `Deleted ${deletedSet.size} contest(s). ${data.failed.length} failed: ${data.failed[0].error}`
          );
        } else {
          setBulkSuccessMsg(`Successfully deleted ${deletedSet.size} contest(s).`);
          setTimeout(() => setBulkSuccessMsg(null), 3000);
        }
      }
    } catch (err: unknown) {
      setBulkDeleteError(err instanceof Error ? err.message : "Error executing bulk deletion.");
    } finally {
      setBulkDeleting(false);
    }
  };

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

      {bulkSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
          <Check size={15} />
          <span>{bulkSuccessMsg}</span>
        </div>
      )}

      {bulkDeleteError && !showBulkDeleteModal && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={15} />
          <span>{bulkDeleteError}</span>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 rounded-2xl bg-[var(--card)] border border-[#5B5FEF]/40 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--ink)]">
              <strong className="text-[#5B5FEF] dark:text-[#A5B4FC] font-mono">{selectedIds.size}</strong> contest(s) selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline transition-colors"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBulkDeleteError(null);
                setShowBulkDeleteModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Select All */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors self-start sm:self-auto"
          >
            {allFilteredSelected ? (
              <CheckSquare size={15} className="text-[#5B5FEF] dark:text-[#A5B4FC]" />
            ) : (
              <Square size={15} />
            )}
            <span>Select All in View ({filtered.length})</span>
          </button>
        )}
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
          {filtered.map((c) => {
            const isSelected = selectedIds.has(c.id);
            return (
              <div
                key={c.id}
                className={`p-5 rounded-2xl bg-[var(--card)] border transition-all flex flex-col justify-between space-y-4 group shadow-xs hover:shadow-md ${
                  isSelected
                    ? "border-[#5B5FEF] ring-1 ring-[#5B5FEF]/40 bg-[#5B5FEF]/5 dark:bg-[#252646]/20"
                    : "border-[var(--card-border)] hover:border-[#5B5FEF]/50"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(c.id, e)}
                        className="mt-0.5 text-[var(--muted)] hover:text-[#5B5FEF] transition-colors shrink-0"
                        title={isSelected ? "Deselect contest" : "Select contest"}
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-[#5B5FEF] dark:text-[#A5B4FC]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>

                      <Link
                        href={`/admin/contests/${c.id}`}
                        className="font-semibold text-sm group-hover:text-[#5B5FEF] dark:group-hover:text-[#A5B4FC] text-[var(--ink)] transition-colors leading-snug truncate"
                      >
                        {c.title}
                      </Link>
                    </div>

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

                  <p className="text-xs text-[var(--muted)] line-clamp-2 pl-6">
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
            );
          })}
        </div>
      )}

      {/* Bulk Deletion Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Delete {selectedIds.size} Selected Contest(s)?
                </h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  This action will permanently delete these contest records and participant attempts.
                </p>
              </div>
            </div>

            {bulkDeleteError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{bulkDeleteError}</span>
              </div>
            )}

            {/* List of contests to delete */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                Contests to be deleted:
              </span>
              <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-[var(--subtle)] border border-[var(--card-border)] space-y-1.5 text-xs">
                {selectedContests.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--ink)] truncate">{c.title}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--line)] text-[var(--muted)] shrink-0">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--subtle)] border border-[var(--card-border)]">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                  className="mt-0.5 rounded border-[var(--card-border)] text-red-600"
                />
                <span className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Force deletion: Delete even if any contest is currently LIVE with active participants.
                </span>
              </label>
            </div>

            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              Shared question bank questions are NOT deleted and will remain intact.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--card-border)]">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Confirm &amp; Delete {selectedIds.size} Contest(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
