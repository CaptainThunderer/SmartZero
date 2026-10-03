"use client";

import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  Link2,
  Copy,
  Check,
  Send,
  Trash2,
  FileQuestion,
  AlertCircle,
  Shield,
  UserPlus,
  UserX,
  AlertTriangle,
  X,
  Trophy,
  Pencil,
  Save,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";
import type { Contest, ContestQuestion } from "../../../../../types/contest";
import { isoToLocalDatetime, addMinutesToLocalDatetime, localDatetimeToIso } from "@/lib/utils/dateTime";

export default function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [contest, setContest] = useState<Contest | null>(null);
  const [questions, setQuestions] = useState<ContestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Contest Admin Assignments
  const [assignedAdmins, setAssignedAdmins] = useState<string[]>([]);
  const [newAdminId, setNewAdminId] = useState("");
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  // Safe Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [slugConfirmation, setSlugConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Live Rankings Slide-Over Drawer
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerLeaderboard, setDrawerLeaderboard] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Edit Contest Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [pendingEditPayload, setPendingEditPayload] = useState<Record<string, unknown> | null>(null);

  // Edit form fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editIsEndAtManual, setEditIsEndAtManual] = useState(false);
  const [editInstructions, setEditInstructions] = useState("");
  const [editFullscreen, setEditFullscreen] = useState(true);
  const [editAutoSubmit, setEditAutoSubmit] = useState(true);
  const [editMaxViolations, setEditMaxViolations] = useState(3);
  const [editAllowRetake, setEditAllowRetake] = useState(false);
  const [editMaxAttempts, setEditMaxAttempts] = useState(1);
  const [editNegativeMarking, setEditNegativeMarking] = useState(false);
  const [editDefaultNegativeMark, setEditDefaultNegativeMark] = useState(0.25);

  const fetchDrawerLeaderboard = useCallback(async () => {
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/admin/contests/${id}/leaderboard`);
      const data = await res.json();
      if (data.leaderboard) {
        setDrawerLeaderboard(data.leaderboard);
      }
    } catch {
      // Ignore
    } finally {
      setDrawerLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!showDrawer) return;
    fetchDrawerLeaderboard();
    const timer = setInterval(fetchDrawerLeaderboard, 4000);
    return () => clearInterval(timer);
  }, [showDrawer, fetchDrawerLeaderboard]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/contests/${id}`).then((r) => r.json()),
      fetch(`/api/admin/contests/${id}/questions`).then((r) => r.json()),
      fetch(`/api/admin/contests/${id}/admins`).then((r) => r.json()).catch(() => ({ admins: [] })),
    ])
      .then(([contestData, questionsData, adminsData]) => {
        if (contestData.contest) setContest(contestData.contest);
        if (questionsData.questions) setQuestions(questionsData.questions);
        if (adminsData.admins) setAssignedAdmins(adminsData.admins);
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/contests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const data = await res.json();
      if (data.contest) {
        setContest(data.contest);
      }
    } catch {
      setErrorMsg("Failed to publish contest.");
    } finally {
      setPublishing(false);
    }
  };

  const handleSafeDelete = async () => {
    if (!contest) return;
    setDeleting(true);
    setDeleteError(null);

    if (contest.status === "ENDED" && slugConfirmation.trim() !== contest.slug) {
      setDeleteError(`Please type "${contest.slug}" exactly to confirm deletion of this ended contest.`);
      setDeleting(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/contests/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setDeleteError(data.error || "Failed to delete contest.");
      } else {
        router.push("/admin/contests");
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Error executing deletion.");
    } finally {
      setDeleting(false);
    }
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminId.trim()) return;
    setAssigningAdmin(true);
    try {
      const res = await fetch(`/api/admin/contests/${id}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: newAdminId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignedAdmins((prev) => [...prev, newAdminId.trim()]);
        setNewAdminId("");
      } else {
        alert(data.error || "Failed to assign contest admin.");
      }
    } catch {
      alert("Network error assigning contest admin.");
    } finally {
      setAssigningAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    try {
      const res = await fetch(`/api/admin/contests/${id}/admins`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignedAdmins((prev) => prev.filter((a) => a !== adminId));
      }
    } catch {
      alert("Failed to remove contest admin.");
    }
  };

  const copyShareLink = () => {
    if (!contest) return;
    const shareUrl = `${window.location.origin}/contest/${contest.slug}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openEditModal = () => {
    if (!contest) return;
    setEditTitle(contest.title);
    setEditDescription(contest.description || "");
    setEditStartAt(isoToLocalDatetime(contest.start_at));
    setEditEndAt(isoToLocalDatetime(contest.end_at));
    setEditDuration(contest.duration_minutes);
    setEditIsEndAtManual(false);
    setEditInstructions(contest.instructions || "");
    setEditFullscreen(contest.fullscreen_required ?? true);
    setEditAutoSubmit(contest.auto_submit_on_violation ?? true);
    setEditMaxViolations(contest.max_violations ?? 3);
    setEditAllowRetake(contest.allow_retake ?? false);
    setEditMaxAttempts(contest.max_attempts ?? 1);
    setEditNegativeMarking(contest.negative_marking ?? false);
    setEditDefaultNegativeMark(contest.default_negative_mark ?? 0.25);
    setEditError(null);
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const handleEditStartAtChange = (newStart: string) => {
    setEditStartAt(newStart);
    if (!editIsEndAtManual && newStart) {
      setEditEndAt(addMinutesToLocalDatetime(newStart, editDuration));
    }
  };

  const handleEditDurationChange = (newDuration: number) => {
    setEditDuration(newDuration);
    if (!editIsEndAtManual && editStartAt) {
      setEditEndAt(addMinutesToLocalDatetime(editStartAt, newDuration));
    }
  };

  const handleEditEndAtChange = (newEnd: string) => {
    setEditEndAt(newEnd);
    setEditIsEndAtManual(true);
  };

  const handleEditResetEndAt = () => {
    setEditIsEndAtManual(false);
    if (editStartAt) {
      setEditEndAt(addMinutesToLocalDatetime(editStartAt, editDuration));
    }
  };

  const buildEditPayload = (): Record<string, unknown> | null => {
    if (!contest) return null;
    const payload: Record<string, unknown> = {};
    const status = contest.status;
    const isEnded = status === "ENDED" || status === "FINAL_RESULTS";

    if (editTitle.trim() !== contest.title) payload.title = editTitle.trim();
    if (editDescription.trim() !== (contest.description || "")) payload.description = editDescription.trim();
    if (editInstructions !== (contest.instructions || "")) payload.instructions = editInstructions;

    if (!isEnded) {
      const newStartIso = localDatetimeToIso(editStartAt);
      const newEndIso = localDatetimeToIso(editEndAt);
      if (newStartIso && newStartIso !== contest.start_at) payload.start_at = newStartIso;
      if (newEndIso && newEndIso !== contest.end_at) payload.end_at = newEndIso;
      if (editDuration !== contest.duration_minutes) payload.duration_minutes = editDuration;

      if (editFullscreen !== (contest.fullscreen_required ?? true)) payload.fullscreen_required = editFullscreen;
      if (editAutoSubmit !== (contest.auto_submit_on_violation ?? true)) payload.auto_submit_on_violation = editAutoSubmit;
      if (editMaxViolations !== (contest.max_violations ?? 3)) payload.max_violations = editMaxViolations;
      if (editAllowRetake !== (contest.allow_retake ?? false)) payload.allow_retake = editAllowRetake;
      if (editMaxAttempts !== (contest.max_attempts ?? 1)) payload.max_attempts = editMaxAttempts;
      if (editNegativeMarking !== (contest.negative_marking ?? false)) payload.negative_marking = editNegativeMarking;
      if (editDefaultNegativeMark !== (contest.default_negative_mark ?? 0.25)) payload.default_negative_mark = editDefaultNegativeMark;
    }

    return Object.keys(payload).length > 0 ? payload : null;
  };

  const submitEdit = async (payload: Record<string, unknown>) => {
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/contests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setEditError(data.error || "Failed to update contest.");
      } else {
        setContest(data.contest);
        setEditSuccess(true);
        setTimeout(() => {
          setShowEditModal(false);
          setEditSuccess(false);
        }, 1200);
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditSubmit = () => {
    const payload = buildEditPayload();
    if (!payload) {
      setEditError("No changes detected.");
      return;
    }
    if (!editTitle.trim()) {
      setEditError("Title cannot be empty.");
      return;
    }

    const isLive = contest?.status === "LIVE";
    const hasScheduleChanges = payload.end_at !== undefined || payload.duration_minutes !== undefined;

    if (isLive && hasScheduleChanges) {
      setPendingEditPayload(payload);
      setShowLiveConfirm(true);
    } else {
      submitEdit(payload);
    }
  };

  const confirmLiveEdit = () => {
    if (pendingEditPayload) {
      submitEdit(pendingEditPayload);
    }
    setShowLiveConfirm(false);
    setPendingEditPayload(null);
  };


  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-sm font-semibold">Contest not found</div>
        <Link href="/admin/contests" className="text-xs text-[#5B5FEF] underline">
          Return to contest list
        </Link>
      </div>
    );
  }

  const mcqCount = questions.filter((q) => q.question_type === "mcq").length;
  const codingCount = questions.filter((q) => q.question_type === "coding").length;
  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/contests"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Contests</span>
        </Link>

        <div className="flex items-center gap-2">
          {contest.status === "LIVE" && (
            <>
              <button
                onClick={() => setShowDrawer(true)}
                className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Trophy size={13} className="text-amber-500 dark:text-amber-300" />
                <span>Rankings</span>
              </button>
              <Link
                href={`/admin/contests/${id}/leaderboard`}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Trophy size={13} className="text-amber-300" />
                <span>Live Leaderboard</span>
              </Link>
            </>
          )}

          {contest.status === "ENDED" && (
            <Link
              href={`/admin/contests/${id}/leaderboard`}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Trophy size={13} className="text-amber-500 dark:text-amber-300" />
              <span>Final Leaderboard</span>
            </Link>
          )}

          {contest.status === "DRAFT" && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-3.5 py-1.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Publish Contest</span>
            </button>
          )}

          <button
            onClick={openEditModal}
            className="px-3.5 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Pencil size={13} />
            <span>Edit Contest</span>
          </button>

          <button
            onClick={() => {
              setDeleteError(null);
              setSlugConfirmation("");
              setShowDeleteModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete Contest</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Details Card */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Prominent Live Leaderboard Banner */}
        {contest.status === "LIVE" && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-amber-500 dark:text-amber-300 shrink-0">
                <Trophy size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-950 dark:text-white">Contest is Currently LIVE</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-xs text-emerald-700 dark:text-[#A0A6C2]">
                  Monitor live participant submissions, realtime scores, penalty times, and ranking shifts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDrawer(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all shrink-0 shadow-xs"
              >
                <Trophy size={13} className="text-amber-500 dark:text-amber-300" />
                <span>🏆 Live Rankings</span>
              </button>
              <Link
                href={`/admin/contests/${id}/leaderboard`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shrink-0"
              >
                <Trophy size={14} className="text-amber-300" />
                <span>Open Full Leaderboard</span>
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-[var(--line)]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">{contest.title}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  contest.status === "LIVE"
                    ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                    : contest.status === "PUBLISHED" || contest.status === "UPCOMING"
                    ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30"
                    : contest.status === "DRAFT"
                    ? "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                    : "bg-zinc-100 dark:bg-gray-500/20 text-zinc-600 dark:text-gray-400 border border-zinc-200 dark:border-gray-500/30"
                }`}
              >
                {contest.status}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] max-w-xl">
              {contest.description || "No description provided."}
            </p>
          </div>

          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-xs font-semibold text-[var(--ink)] transition-colors shrink-0 shadow-xs"
          >
            {copiedLink ? <Check size={13} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedLink ? "Link Copied" : "Copy Student Link"}</span>
          </button>
        </div>

        {/* Slug / Passcode Bar */}
        <div className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--line)] flex items-center justify-between text-xs">
          <div>
            <span className="text-[var(--muted)] uppercase font-semibold text-[10px] block mb-1">
              Contest Join Slug / Code
            </span>
            <div className="font-mono font-bold text-[var(--ink)] text-sm">
              {contest.slug}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <div className="flex items-center gap-2 text-[var(--muted)] mb-1">
              <Clock size={14} className="text-[#5B5FEF]" />
              <span className="font-semibold">Duration</span>
            </div>
            <div className="text-base font-bold text-[var(--ink)]">{contest.duration_minutes} minutes</div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <div className="flex items-center gap-2 text-[var(--muted)] mb-1">
              <Calendar size={14} className="text-[#5B5FEF]" />
              <span className="font-semibold">Starts At</span>
            </div>
            <div className="text-xs font-medium text-[var(--ink)]">{new Date(contest.start_at).toLocaleString()}</div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <div className="flex items-center gap-2 text-[var(--muted)] mb-1">
              <Calendar size={14} className="text-[#5B5FEF]" />
              <span className="font-semibold">Ends At</span>
            </div>
            <div className="text-xs font-medium text-[var(--ink)]">{new Date(contest.end_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Assessment Policies & Anti-Cheat Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <span className="text-[var(--muted)] text-[10px] uppercase font-semibold block mb-0.5">Fullscreen Policy</span>
            <div className="font-semibold text-[var(--ink)]">
              {contest.fullscreen_required ? "Enforced" : "Optional"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <span className="text-[var(--muted)] text-[10px] uppercase font-semibold block mb-0.5">Auto-Submit</span>
            <div className="font-semibold text-[var(--ink)]">
              {contest.auto_submit_on_violation ? `Yes (max ${contest.max_violations} viol.)` : "Disabled"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <span className="text-[var(--muted)] text-[10px] uppercase font-semibold block mb-0.5">Retake Policy</span>
            <div className="font-semibold text-[var(--ink)]">
              {contest.allow_retake ? `Allowed (${contest.max_attempts} attempts)` : "Single Attempt"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--subtle)] border border-[var(--line)]">
            <span className="text-[var(--muted)] text-[10px] uppercase font-semibold block mb-0.5">Negative Marking</span>
            <div className="font-semibold text-[var(--ink)]">
              {contest.negative_marking ? `Yes (-${contest.default_negative_mark} pts)` : "None"}
            </div>
          </div>
        </div>

        {/* Question Bank Summary */}
        <div className="p-5 rounded-2xl bg-[var(--subtle)] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileQuestion size={16} className="text-[#5B5FEF]" />
              <h2 className="text-sm font-bold text-[var(--ink)]">Contest Questions ({questions.length})</h2>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {mcqCount} MCQs • {codingCount} Coding Problems • Total Marks: {totalMarks}
            </p>
          </div>

          <Link
            href={`/admin/contests/${id}/questions`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold shadow-sm transition-colors shrink-0"
          >
            <span>Manage & Import Questions</span>
          </Link>
        </div>

        {/* Contest Admin Assignments Section */}
        <div className="p-5 rounded-2xl bg-[var(--subtle)] border border-[var(--line)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#5B5FEF]" />
              <h2 className="text-sm font-bold text-[var(--ink)]">Assigned Contest Administrators</h2>
            </div>
            <span className="text-[11px] text-[var(--muted)]">
              {assignedAdmins.length} contest admin(s) assigned
            </span>
          </div>

          {assignedAdmins.length === 0 ? (
            <div className="text-xs text-[var(--muted)] py-2">
              No specific contest admins assigned. Super Admins and global Admins have full access.
            </div>
          ) : (
            <div className="space-y-2">
              {assignedAdmins.map((adminId) => (
                <div
                  key={adminId}
                  className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-[var(--ink)]">{adminId}</span>
                  <button
                    onClick={() => handleRemoveAdmin(adminId)}
                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    title="Remove Admin Assignment"
                  >
                    <UserX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAssignAdmin} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newAdminId}
              onChange={(e) => setNewAdminId(e.target.value)}
              placeholder="Enter User UUID to assign..."
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--card)] text-xs text-[var(--ink)] placeholder-[var(--muted)] font-mono focus:outline-none focus:border-[#5B5FEF]"
            />
            <button
              type="submit"
              disabled={assigningAdmin || !newAdminId.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {assigningAdmin ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
              <span>Assign</span>
            </button>
          </form>
        </div>
      </div>

      {/* ── SAFE DELETE CONFIRMATION MODAL ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--ink)]">Delete Contest</h3>
                  <p className="text-xs text-[var(--muted)]">This action cannot be undone.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs text-[var(--muted)] leading-relaxed">
              <p>
                Deleting <strong className="text-[var(--ink)] font-mono">{contest.title}</strong> will perform a cascading cleanup of all questions, answers, and submissions associated with this contest.
              </p>

              {contest.status === "LIVE" && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                  <strong>Live Contest Guard:</strong> Deletion will be rejected by the server if students currently have active exam attempts.
                </div>
              )}

              {contest.status === "ENDED" && (
                <div className="space-y-2 pt-1">
                  <label className="block text-[var(--muted)]">
                    To confirm deletion, please type the contest slug <strong className="text-[var(--ink)] font-mono">{contest.slug}</strong> below:
                  </label>
                  <input
                    type="text"
                    value={slugConfirmation}
                    onChange={(e) => setSlugConfirmation(e.target.value)}
                    placeholder={contest.slug}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSafeDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Confirm & Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT CONTEST MODAL ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--ink)]">Edit Contest</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-[var(--muted)] hover:text-[var(--ink)]">
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {editError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle size={15} className="shrink-0" />
                  <span>Contest updated successfully!</span>
                </div>
              )}

              {(contest?.status === "ENDED" || contest?.status === "FINAL_RESULTS") && (
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-blue-300 text-xs">
                  <strong>This contest has ended.</strong> Only basic information can be edited. Historical timing and policies are immutable.
                </div>
              )}

              {contest?.status === "LIVE" && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-amber-300 text-xs">
                  <strong>Contest is currently LIVE.</strong> Schedule changes will affect active participants. Start time cannot be modified.
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Contest Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Instructions (Optional)</label>
                  <textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Schedule (Disabled if ended) */}
              {contest?.status !== "ENDED" && contest?.status !== "FINAL_RESULTS" && (
                <div className="space-y-4 pt-4 border-t border-[var(--line)]">
                  <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <Calendar size={14} className="text-[var(--accent)]" /> Schedule
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Start Time (Local)</label>
                      <input
                        type="datetime-local"
                        value={editStartAt}
                        onChange={(e) => handleEditStartAtChange(e.target.value)}
                        disabled={contest?.status === "LIVE"}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Duration (Minutes)</label>
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => handleEditDurationChange(Number(e.target.value))}
                        min={1}
                        max={1440}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[var(--muted)]">End Time (Local)</label>
                        {editIsEndAtManual && (
                          <button onClick={handleEditResetEndAt} className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline">
                            <RotateCcw size={10} /> Reset to auto-calc
                          </button>
                        )}
                      </div>
                      <input
                        type="datetime-local"
                        value={editEndAt}
                        onChange={(e) => handleEditEndAtChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Policies (Disabled if ended) */}
              {contest?.status !== "ENDED" && contest?.status !== "FINAL_RESULTS" && (
                <div className="space-y-4 pt-4 border-t border-[var(--line)]">
                  <h4 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <Shield size={14} className="text-[var(--accent)]" /> Security & Policies
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                      <input type="checkbox" checked={editFullscreen} onChange={(e) => setEditFullscreen(e.target.checked)} className="rounded border-[var(--line)] bg-[var(--subtle)]" />
                      Require Fullscreen
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                      <input type="checkbox" checked={editAutoSubmit} onChange={(e) => setEditAutoSubmit(e.target.checked)} className="rounded border-[var(--line)] bg-[var(--subtle)]" />
                      Auto-Submit on Violations
                    </label>
                    {editAutoSubmit && (
                      <div>
                        <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Max Violations</label>
                        <input type="number" value={editMaxViolations} onChange={(e) => setEditMaxViolations(Number(e.target.value))} min={1} max={10} className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]" />
                      </div>
                    )}
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                        <input type="checkbox" checked={editAllowRetake} onChange={(e) => setEditAllowRetake(e.target.checked)} className="rounded border-[var(--line)] bg-[var(--subtle)]" />
                        Allow Retakes
                      </label>
                      {editAllowRetake && (
                        <div>
                          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Max Attempts</label>
                          <input type="number" value={editMaxAttempts} onChange={(e) => setEditMaxAttempts(Number(e.target.value))} min={1} max={10} className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]" />
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 text-xs text-[var(--ink)]">
                        <input type="checkbox" checked={editNegativeMarking} onChange={(e) => setEditNegativeMarking(e.target.checked)} className="rounded border-[var(--line)] bg-[var(--subtle)]" />
                        Negative Marking
                      </label>
                      {editNegativeMarking && (
                        <div>
                          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Default Negative Mark</label>
                          <input type="number" step="0.25" value={editDefaultNegativeMark} onChange={(e) => setEditDefaultNegativeMark(Number(e.target.value))} min={0} max={5} className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--line)] flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowEditModal(false)} disabled={editSaving} className="px-4 py-2 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                Cancel
              </button>
              <button onClick={handleEditSubmit} disabled={editSaving || !buildEditPayload()} className="px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50">
                {editSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE CONFIRMATION DIALOG ── */}
      {showLiveConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-base font-bold text-[var(--ink)]">Extend Live Contest?</h3>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              This contest is currently live. Your changes will affect the server-authoritative end time for all active participants.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => { setShowLiveConfirm(false); setPendingEditPayload(null); }} className="px-4 py-2 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                Cancel
              </button>
              <button onClick={confirmLiveEdit} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <CheckCircle size={13} />
                <span>Confirm Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE RANKINGS SLIDE-OVER DRAWER ── */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--card)] border-l border-[var(--card-border)] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500 dark:text-amber-400" />
                <h3 className="font-bold text-sm text-[var(--ink)]">Live Rankings</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/contests/${id}/leaderboard`}
                  className="text-xs text-[#5B5FEF] hover:underline"
                >
                  Full View ↗
                </Link>
                <button
                  onClick={() => setShowDrawer(false)}
                  className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--subtle)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {drawerLoading && drawerLeaderboard.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
                </div>
              ) : drawerLeaderboard.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--muted)]">
                  No participants yet in this contest.
                </div>
              ) : (
                drawerLeaderboard.map((entry) => (
                  <div
                    key={entry.participant_id}
                    className="p-3 rounded-xl bg-[var(--subtle)] border border-[var(--line)] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-[#5B5FEF] dark:text-[#A5B4FC] w-6 text-center">
                        #{entry.rank}
                      </span>
                      <div>
                        <div className="font-semibold text-[var(--ink)] leading-tight">
                          {entry.display_name}
                        </div>
                        <div className="text-[10px] text-[var(--muted)]">
                          {entry.student_id ? `ID: ${entry.student_id} • ` : ""}
                          {entry.solved_count}/{entry.total_questions} solved
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {entry.total_score} pts
                      </div>
                      <div className="text-[10px] text-[var(--muted)] font-mono">
                        {entry.formatted_time}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--line)] bg-[var(--card)] flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>Auto-refreshing every 4s</span>
              <button
                onClick={() => setShowDrawer(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
