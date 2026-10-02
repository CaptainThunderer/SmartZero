"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertCircle, Save } from "lucide-react";

export default function NewContestPage() {
  const router = useRouter();

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 10 * 60 * 1000).toISOString().slice(0, 16);
  const defaultEnd = new Date(now.getTime() + 70 * 60 * 1000).toISOString().slice(0, 16);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [passcode, setPasscode] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [instructions, setInstructions] = useState(
    "1. Stay in fullscreen mode during the exam.\n2. Do not switch tabs or windows.\n3. All submissions are automatically evaluated upon timer expiry."
  );
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [defaultNegativeMark, setDefaultNegativeMark] = useState(0.25);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !passcode || !startAt || !endAt) {
      setErrorMsg("Title, passcode, start time, and end time are required.");
      return;
    }

    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setErrorMsg("End time must be strictly after start time.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          slug: slug.trim() || undefined,
          passcode,
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
          duration_minutes: Number(durationMinutes),
          instructions,
          negative_marking: negativeMarking,
          default_negative_mark: Number(defaultNegativeMark),
        }),
      });

      const data = await res.json();
      setSaving(false);

      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Failed to create contest.");
      } else {
        router.push(`/admin/contests/${data.contest.id}`);
      }
    } catch (err: unknown) {
      setSaving(false);
      setErrorMsg(err instanceof Error ? err.message : "Network error.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/admin/contests"
        className="inline-flex items-center gap-1.5 text-xs text-[#A0A6C2] hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Contests</span>
      </Link>

      <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create New Contest</h1>
          <p className="text-xs text-[#A0A6C2] mt-1">
            Define timing, security passcode, and assessment parameters.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-400">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
              Contest Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SmartZero Algorithm Masters 2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#27273D] bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF]"
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of topics covered and contest guidelines..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
                Passcode (Hashed Securely) *
              </label>
              <input
                type="text"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="e.g. ALGO-2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#27273D] bg-[#12121A] text-sm font-mono focus:outline-none focus:border-[#5B5FEF]"
              />
              <span className="text-[10px] text-[#6B6F8A] mt-1 block">
                Required by students to enter the exam.
              </span>
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
                Custom URL Slug (Optional)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. algo-masters-2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#27273D] bg-[#12121A] text-sm font-mono focus:outline-none focus:border-[#5B5FEF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
                Start Time *
              </label>
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
                End Time *
              </label>
              <input
                type="datetime-local"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
                Duration (mins) *
              </label>
              <input
                type="number"
                min={5}
                max={600}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-[#A0A6C2] mb-1.5">
              Exam Instructions
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
            />
          </div>

          <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Negative Marking</div>
                <div className="text-[11px] text-[#6B6F8A]">
                  Deduct penalty marks for wrong MCQ answers
                </div>
              </div>
              <input
                type="checkbox"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
                className="w-4 h-4 rounded text-[#5B5FEF]"
              />
            </div>

            {negativeMarking && (
              <div>
                <label className="block font-semibold text-[#A0A6C2] mb-1">
                  Default Penalty Marks per Wrong Answer
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="5"
                  value={defaultNegativeMark}
                  onChange={(e) => setDefaultNegativeMark(Number(e.target.value))}
                  className="w-32 px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#181824] text-xs"
                />
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Creating Contest...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Create Contest (Draft)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
