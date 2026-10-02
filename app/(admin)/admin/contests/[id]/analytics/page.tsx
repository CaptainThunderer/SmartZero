"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  Loader2,
  HelpCircle,
  FileCode2,
  Sparkles,
} from "lucide-react";
import type { AdminContestAnalytics } from "@/lib/contest/analytics";
import type { AdminPostContestAISummary } from "@/lib/contest/postContestAI";

export default function AdminContestAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AdminContestAnalytics | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<AdminPostContestAISummary | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/contests/${id}/analytics`)
      .then((r) => r.json())
      .then((data) => {
        if (data.analytics) {
          setAnalytics(data.analytics);
        } else {
          setErrorMsg(data.error || "Analytics unavailable.");
        }
      })
      .catch(() => setErrorMsg("Failed to load contest analytics."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!analytics) return;
    setAiLoading(true);
    fetch(`/api/admin/contests/${id}/ai-summary`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) {
          setAiSummary(data.summary);
        } else {
          setAiError(data.error || "Cohort AI summary unavailable.");
        }
      })
      .catch(() => setAiError("Could not connect to cohort AI intelligence service."))
      .finally(() => setAiLoading(false));
  }, [analytics, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#12121A] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
      </div>
    );
  }

  if (errorMsg || !analytics) {
    return (
      <div className="p-8 text-center space-y-4">
        <HelpCircle size={32} className="mx-auto text-rose-400" />
        <h2 className="text-sm font-bold text-white">Analytics Not Found</h2>
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
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/contests/${id}`}
            className="p-1.5 rounded-lg border border-[#27273D] bg-[#181824] text-[#A0A6C2] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white">
              {analytics.contest_title} • Cohort Analytics
            </h1>
            <p className="text-[11px] text-[#A0A6C2]">
              Server-authoritative contest performance intelligence
            </p>
          </div>
        </div>

        <Link
          href={`/admin/contests/${id}/similarity`}
          className="px-3.5 py-1.5 rounded-xl border border-[#27273D] bg-[#181824] hover:bg-[#202030] text-xs font-semibold text-white flex items-center gap-2 transition-colors"
        >
          <FileCode2 size={13} className="text-[#5B5FEF]" />
          <span>Code Similarity Review</span>
        </Link>
      </div>

      {/* Cohort Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold flex items-center gap-1.5">
            <Users size={12} className="text-[#5B5FEF]" />
            <span>Participants</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {analytics.total_participants}
          </div>
          <div className="text-[10px] text-[#6B6F8A]">
            {analytics.completed_count} completed ({analytics.completion_rate_percent}%)
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold flex items-center gap-1.5">
            <TrendingUp size={12} className="text-emerald-400" />
            <span>Average Score</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {analytics.average_score} <span className="text-xs text-[#6B6F8A]">pts</span>
          </div>
          <div className="text-[10px] text-[#6B6F8A]">
            High: {analytics.highest_score} • Low: {analytics.lowest_score}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-blue-400" />
            <span>Completion Rate</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {analytics.completion_rate_percent}%
          </div>
          <div className="text-[10px] text-[#6B6F8A]">
            Full submission confirmations
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#181824] border border-[#27273D] space-y-1">
          <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-amber-400" />
            <span>Integrity Events</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {analytics.security_events_summary.total_events}
          </div>
          <div className="text-[10px] text-[#6B6F8A]">
            {analytics.security_events_summary.flagged_participants_count} flagged participants
          </div>
        </div>
      </div>

      {/* AI Cohort Diagnostic Intelligence Card */}
      <div className="p-6 rounded-2xl bg-[#181824] border border-[#27273D] space-y-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B5FEF] to-[#8C52FF] flex items-center justify-center text-white shadow-lg">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                SmartZero AI • Cohort Diagnostic Intelligence
              </h3>
              <p className="text-[10px] text-[#A0A6C2]">
                Post-contest pedagogical difficulty evaluation & curriculum insights
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#5B5FEF]/10 text-[#818CF8] border border-[#5B5FEF]/30">
            Instructor Intelligence
          </span>
        </div>

        {aiLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-xs text-[#A0A6C2]">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
            <span>Analyzing cohort submission dynamics and problem friction...</span>
          </div>
        ) : aiSummary ? (
          <div className="space-y-4 text-xs">
            {/* Cohort Summary */}
            <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-[#D8DCEF] leading-relaxed">
              {aiSummary.cohortSummary}
            </div>

            {/* Difficulty Assessment */}
            <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] space-y-1">
              <div className="text-[10px] uppercase font-bold text-[#A0A6C2] tracking-wider">
                Assessment Calibration & Difficulty
              </div>
              <p className="text-white font-medium">{aiSummary.difficultyAssessment}</p>
            </div>

            {/* Outlier Questions Analysis */}
            {aiSummary.outlierQuestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold text-[#A0A6C2] tracking-wider">
                  Outlier Questions & Completion Bottlenecks
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiSummary.outlierQuestions.map((oq, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#12121A] border border-amber-900/30 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white truncate max-w-[200px]">
                          {oq.questionTitle}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {oq.successRate}% Success
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A0A6C2] leading-relaxed">
                        {oq.insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Curriculum Recommendations */}
            {aiSummary.curriculumRecommendations.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold text-[#A0A6C2] tracking-wider">
                  Recommended Curriculum Actions
                </div>
                <div className="space-y-1.5">
                  {aiSummary.curriculumRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] text-[#C5CBE3] flex items-start gap-2"
                    >
                      <span className="text-[#5B5FEF] font-bold">→</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Official Disclaimer */}
            <div className="pt-3 border-t border-[#27273D]/60 text-[10px] text-[#6B6F8A] italic">
              {aiSummary.disclaimer}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-xs text-[#6B6F8A] text-center">
            {aiError || "Cohort AI diagnostic is unavailable."}
          </div>
        )}
      </div>

      {/* Score Distribution Chart */}
      <div className="p-6 rounded-2xl bg-[#181824] border border-[#27273D] space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#A0A6C2] flex items-center gap-2">
          <BarChart3 size={14} className="text-[#5B5FEF]" />
          <span>Score Distribution</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {analytics.score_distribution.map((b) => (
            <div
              key={b.range}
              className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D] text-center"
            >
              <div className="text-[10px] text-[#6B6F8A] font-mono">{b.range} pts</div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {b.count}
              </div>
              <div className="text-[9px] text-[#A0A6C2]">contestants</div>
            </div>
          ))}
        </div>
      </div>

      {/* Question Analytics Table */}
      <div className="p-6 rounded-2xl bg-[#181824] border border-[#27273D] space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#A0A6C2]">
          Question Performance & Accuracy
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#27273D] text-[10px] text-[#6B6F8A] uppercase font-mono">
                <th className="pb-3">Type</th>
                <th className="pb-3">Question</th>
                <th className="pb-3 text-right">Max Pts</th>
                <th className="pb-3 text-right">Attempts</th>
                <th className="pb-3 text-right">Avg Score</th>
                <th className="pb-3 text-right">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27273D]/60 font-mono">
              {analytics.question_analytics.map((qa) => (
                <tr key={qa.question_id} className="hover:bg-[#1C1C2C] transition-colors">
                  <td className="py-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        qa.question_type === "mcq"
                          ? "bg-purple-950/60 text-purple-300"
                          : "bg-blue-950/60 text-blue-300"
                      }`}
                    >
                      {qa.question_type}
                    </span>
                  </td>
                  <td className="py-3 font-sans font-medium text-white max-w-xs truncate">
                    {qa.title}
                  </td>
                  <td className="py-3 text-right text-[#A0A6C2]">{qa.max_marks}</td>
                  <td className="py-3 text-right text-[#A0A6C2]">{qa.attempts_count}</td>
                  <td className="py-3 text-right font-bold text-white">
                    {qa.average_score}
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-400">
                    {qa.success_rate_percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
