"use client";

import React, { useEffect, useState, use } from "react";
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
} from "lucide-react";
import type { Contest, ContestQuestion } from "../../../../../types/contest";

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
          className="inline-flex items-center gap-1.5 text-xs text-[#A0A6C2] hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Contests</span>
        </Link>

        <div className="flex items-center gap-2">
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
            onClick={() => {
              setDeleteError(null);
              setSlugConfirmation("");
              setShowDeleteModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl border border-red-900/40 text-red-400 hover:bg-red-950/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete Contest</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2.5 text-xs text-red-400">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Details Card */}
      <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-[#27273D]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <h1 className="text-xl font-bold tracking-tight text-white">{contest.title}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  contest.status === "LIVE"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : contest.status === "PUBLISHED" || contest.status === "UPCOMING"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : contest.status === "DRAFT"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                }`}
              >
                {contest.status}
              </span>
            </div>
            <p className="text-xs text-[#A0A6C2] max-w-xl">
              {contest.description || "No description provided."}
            </p>
          </div>

          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#27273D] hover:bg-[#1E1E2E] text-xs font-semibold text-white transition-colors shrink-0"
          >
            {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedLink ? "Link Copied" : "Copy Student Link"}</span>
          </button>
        </div>

        {/* Slug / Passcode Bar */}
        <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] flex items-center justify-between text-xs">
          <div>
            <span className="text-[#6B6F8A] uppercase font-semibold text-[10px] block mb-1">
              Contest Join Slug / Code
            </span>
            <div className="font-mono font-bold text-white text-sm">
              {contest.slug}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D]">
            <div className="flex items-center gap-2 text-[#A0A6C2] mb-1">
              <Clock size={14} className="text-[#5B5FEF]" />
              <span className="font-semibold">Duration</span>
            </div>
            <div className="text-base font-bold text-white">{contest.duration_minutes} minutes</div>
          </div>

          <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D]">
            <div className="flex items-center gap-2 text-[#A0A6C2] mb-1">
              <Calendar size={14} className="text-[#5B5FEF]" />
              <span className="font-semibold">Starts At</span>
            </div>
            <div className="text-xs font-medium text-white">{new Date(contest.start_at).toLocaleString()}</div>
          </div>

          <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D]">
            <div className="flex items-center gap-2 text-[#A0A6C2] mb-1">
              <Calendar size={14} className="text-[#5B5FEF]" />
              <span className="font-semibold">Ends At</span>
            </div>
            <div className="text-xs font-medium text-white">{new Date(contest.end_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Question Bank Summary */}
        <div className="p-5 rounded-2xl bg-[#12121A] border border-[#27273D] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileQuestion size={16} className="text-[#5B5FEF]" />
              <h2 className="text-sm font-bold text-white">Contest Questions ({questions.length})</h2>
            </div>
            <p className="text-xs text-[#A0A6C2]">
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
        <div className="p-5 rounded-2xl bg-[#12121A] border border-[#27273D] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#5B5FEF]" />
              <h2 className="text-sm font-bold text-white">Assigned Contest Administrators</h2>
            </div>
            <span className="text-[11px] text-[#A0A6C2]">
              {assignedAdmins.length} contest admin(s) assigned
            </span>
          </div>

          {assignedAdmins.length === 0 ? (
            <div className="text-xs text-[#6B6F8A] py-2">
              No specific contest admins assigned. Super Admins and global Admins have full access.
            </div>
          ) : (
            <div className="space-y-2">
              {assignedAdmins.map((adminId) => (
                <div
                  key={adminId}
                  className="p-2.5 rounded-xl border border-[#27273D] bg-[#181824] flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-white">{adminId}</span>
                  <button
                    onClick={() => handleRemoveAdmin(adminId)}
                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
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
              className="flex-1 px-3 py-2 rounded-xl border border-[#27273D] bg-[#181824] text-xs text-white placeholder-[#6B6F8A] font-mono focus:outline-none focus:border-[#5B5FEF]"
            />
            <button
              type="submit"
              disabled={assigningAdmin || !newAdminId.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#27273D] hover:bg-[#383854] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
          <div className="bg-[#181824] border border-red-900/50 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Contest</h3>
                  <p className="text-xs text-[#A0A6C2]">This action cannot be undone.</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-[#6B6F8A] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs text-[#A0A6C2] leading-relaxed">
              <p>
                Deleting <strong className="text-white font-mono">{contest.title}</strong> will perform a cascading cleanup of all questions, answers, and submissions associated with this contest.
              </p>

              {contest.status === "LIVE" && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-amber-300">
                  <strong>Live Contest Guard:</strong> Deletion will be rejected by the server if students currently have active exam attempts.
                </div>
              )}

              {contest.status === "ENDED" && (
                <div className="space-y-2 pt-1">
                  <label className="block text-[#A0A6C2]">
                    To confirm deletion, please type the contest slug <strong className="text-white font-mono">{contest.slug}</strong> below:
                  </label>
                  <input
                    type="text"
                    value={slugConfirmation}
                    onChange={(e) => setSlugConfirmation(e.target.value)}
                    placeholder={contest.slug}
                    className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-[#27273D] text-xs font-semibold text-[#A0A6C2] hover:text-white transition-colors"
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
    </div>
  );
}
