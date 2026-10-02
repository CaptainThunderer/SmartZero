"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  Eye,
  X,
  Loader2,
  HelpCircle,
  Shield,
} from "lucide-react";
import type {
  ContestSimilarityReport,
  PairwiseComparisonRecord,
} from "@/lib/judge/similarity";

export default function AdminCodeSimilarityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ContestSimilarityReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<PairwiseComparisonRecord | null>(null);

  useEffect(() => {
    fetch(`/api/admin/contests/${id}/similarity`)
      .then((r) => r.json())
      .then((data) => {
        if (data.report) {
          setReport(data.report);
        } else {
          setErrorMsg(data.error || "Similarity report unavailable.");
        }
      })
      .catch(() => setErrorMsg("Failed to run code similarity analysis."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#12121A] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
      </div>
    );
  }

  if (errorMsg || !report) {
    return (
      <div className="p-8 text-center space-y-4">
        <HelpCircle size={32} className="mx-auto text-rose-400" />
        <h2 className="text-sm font-bold text-white">Similarity Analysis Unavailable</h2>
        <p className="text-xs text-[#A0A6C2]">{errorMsg}</p>
        <Link
          href={`/admin/contests/${id}`}
          className="text-xs text-[#5B5FEF] underline"
        >
          Return to Contest Details
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/contests/${id}/analytics`}
            className="p-1.5 rounded-lg border border-[#27273D] bg-[#181824] text-[#A0A6C2] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode2 size={16} className="text-[#5B5FEF]" />
              <span>Code Similarity & Investigation Console</span>
            </h1>
            <p className="text-[11px] text-[#A0A6C2]">
              Structural tokenization and identifier-normalized pairwise similarity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-lg bg-[#181824] border border-[#27273D] text-[#A0A6C2] font-mono">
            {report.total_comparisons} comparisons analyzed
          </span>
        </div>
      </div>

      {/* Advisory Banner */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-start gap-2.5">
        <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold text-white">Investigative Review Policy: </span>
          <span>
            Similarity metrics are calculated using token n-grams and normalized syntax trees. Do NOT use this tool to automatically accuse students of misconduct without manual human review of the submission diffs.
          </span>
        </div>
      </div>

      {/* Pairwise Comparisons Table */}
      <div className="p-6 rounded-2xl bg-[#181824] border border-[#27273D] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#A0A6C2]">
            Pairwise Comparisons ({report.comparisons.length})
          </h3>
          <span className="text-[11px] text-[#6B6F8A]">
            {report.flagged_pairs_count} pairs flagged for review
          </span>
        </div>

        {report.comparisons.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6B6F8A]">
            No coding submissions found or no multiple contestants submitted for the same question.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#27273D] text-[10px] text-[#6B6F8A] uppercase font-mono">
                  <th className="pb-3">Contestant A</th>
                  <th className="pb-3">Contestant B</th>
                  <th className="pb-3">Question</th>
                  <th className="pb-3">Language</th>
                  <th className="pb-3 text-right">Similarity</th>
                  <th className="pb-3 text-right">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27273D]/60 font-mono">
                {report.comparisons.map((c) => (
                  <tr key={c.id} className="hover:bg-[#1C1C2C] transition-colors">
                    <td className="py-3 font-sans font-medium text-white">
                      {c.submission_a.display_name}
                    </td>
                    <td className="py-3 font-sans font-medium text-white">
                      {c.submission_b.display_name}
                    </td>
                    <td className="py-3 text-[#A0A6C2] font-sans truncate max-w-xs">
                      {c.question_title || c.question_id}
                    </td>
                    <td className="py-3 text-[#A0A6C2] uppercase text-[10px]">
                      {c.language}
                    </td>
                    <td className="py-3 text-right font-bold text-white">
                      {c.similarity_score}%
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === "Requires review"
                            ? "bg-rose-950/60 text-rose-300 border border-rose-800/50"
                            : c.status === "Similarity detected"
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                            : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setSelectedPair(c)}
                        className="px-2.5 py-1 rounded-lg border border-[#27273D] bg-[#12121A] hover:bg-[#222232] text-[11px] font-semibold text-[#A5B4FC] flex items-center gap-1 ml-auto transition-colors"
                      >
                        <Eye size={12} />
                        <span>Review Diff</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-Side Diff Inspection Modal */}
      {selectedPair && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-[#27273D] rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#27273D]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Pairwise Structural Diff</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 font-mono border border-amber-500/30">
                    {selectedPair.similarity_score}% Match • {selectedPair.status}
                  </span>
                </h3>
                <p className="text-[11px] text-[#A0A6C2]">
                  {selectedPair.submission_a.display_name} vs {selectedPair.submission_b.display_name}
                </p>
              </div>

              <button
                onClick={() => setSelectedPair(null)}
                className="p-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-[#A0A6C2] hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            {/* Side-by-Side Code Viewer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              <div className="flex flex-col border border-[#27273D] rounded-xl bg-[#12121A] overflow-hidden">
                <div className="p-2.5 bg-[#161622] border-b border-[#27273D] text-[11px] font-bold text-white flex items-center justify-between">
                  <span>{selectedPair.submission_a.display_name}</span>
                  <span className="text-[10px] text-[#6B6F8A] font-mono">
                    {new Date(selectedPair.submission_a.submitted_at).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="p-3 font-mono text-[11px] text-[#D8DCEF] overflow-y-auto flex-1 whitespace-pre-wrap leading-relaxed">
                  {selectedPair.submission_a.code}
                </pre>
              </div>

              <div className="flex flex-col border border-[#27273D] rounded-xl bg-[#12121A] overflow-hidden">
                <div className="p-2.5 bg-[#161622] border-b border-[#27273D] text-[11px] font-bold text-white flex items-center justify-between">
                  <span>{selectedPair.submission_b.display_name}</span>
                  <span className="text-[10px] text-[#6B6F8A] font-mono">
                    {new Date(selectedPair.submission_b.submitted_at).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="p-3 font-mono text-[11px] text-[#D8DCEF] overflow-y-auto flex-1 whitespace-pre-wrap leading-relaxed">
                  {selectedPair.submission_b.code}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedPair(null)}
                className="px-4 py-2 rounded-xl bg-[#27273D] hover:bg-[#343450] text-xs font-semibold text-white transition-colors"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
