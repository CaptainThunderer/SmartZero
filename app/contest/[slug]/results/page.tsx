"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Trophy,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  ListOrdered,
  ArrowLeft,
  Loader2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { StudentContestResult } from "@/lib/contest/analytics";
import type { StudentPostContestAIAnalysis } from "@/lib/contest/postContestAI";

export default function StudentContestResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user, initialize } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<StudentContestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<StudentPostContestAIAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const userId = user?.id || "demo-student-user";
    fetch(`/api/contest/${slug}/results?user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.result) {
          setResult(data.result);
        } else {
          setErrorMsg(data.error || "No results available.");
        }
      })
      .catch(() => setErrorMsg("Failed to load contest results."))
      .finally(() => setLoading(false));
  }, [slug, user]);

  useEffect(() => {
    if (!result) return;
    const userId = user?.id || "demo-student-user";
    setAiLoading(true);
    fetch(`/api/contest/${slug}/ai-analysis?user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.analysis) {
          setAiAnalysis(data.analysis);
        } else {
          setAiError(data.error || "Post-contest AI analysis unavailable.");
        }
      })
      .catch(() => setAiError("Could not reach AI analysis service."))
      .finally(() => setAiLoading(false));
  }, [result, slug, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#12121A] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
      </div>
    );
  }

  if (errorMsg || !result) {
    return (
      <div className="min-h-screen bg-[#12121A] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <HelpCircle size={36} className="text-[#A0A6C2]" />
        <h1 className="text-base font-bold">Contest Results Unavailable</h1>
        <p className="text-xs text-[#A0A6C2] max-w-sm text-center">
          {errorMsg || "Participation records for this assessment were not found."}
        </p>
        <Link
          href={`/contest/${slug}`}
          className="text-xs text-[#5B5FEF] underline"
        >
          Return to Contest Landing Page
        </Link>
      </div>
    );
  }

  const scorePercent =
    result.max_possible_score > 0
      ? Math.round((result.total_score / result.max_possible_score) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#12121A] text-[#F1F5F9] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#27273D] bg-[#181824] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/contest/${slug}`}
            className="p-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-[#A0A6C2] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide">
              {result.contest_title} • Results
            </h1>
            <div className="text-[10px] text-[#A0A6C2] font-mono">
              Final Official Scorecard
            </div>
          </div>
        </div>

        <Link
          href={`/contest/${slug}`}
          className="px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs font-semibold text-[#A0A6C2] hover:text-white transition-colors"
        >
          Contest Overview
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-6 sm:p-8 space-y-8 flex-1">
        {/* Performance Hero Banner */}
        <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Assessment Completed
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {result.total_score}{" "}
                <span className="text-base sm:text-lg text-[#6B6F8A] font-normal font-mono">
                  / {result.max_possible_score} pts
                </span>
              </h2>
              <p className="text-xs text-[#A0A6C2]">
                Solved {result.problems_solved} of {result.total_problems} problems ({scorePercent}% accuracy)
              </p>
            </div>

            {/* Rank & Percentile Badges */}
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-center min-w-[100px]">
                <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">
                  Global Rank
                </div>
                <div className="text-xl font-mono font-bold text-amber-400 mt-0.5">
                  #{result.rank || 1}
                </div>
                <div className="text-[9px] text-[#6B6F8A]">
                  of {result.total_participants} contestants
                </div>
              </div>

              {result.percentile !== null && (
                <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-center min-w-[100px]">
                  <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">
                    Percentile
                  </div>
                  <div className="text-xl font-mono font-bold text-[#5B5FEF] mt-0.5">
                    {result.percentile}%
                  </div>
                  <div className="text-[9px] text-[#6B6F8A]">Top tier score</div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-[#27273D]/80 text-xs">
            <div className="p-3 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#6B6F8A] uppercase font-mono">MCQ Score</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {result.mcq_score} pts
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#6B6F8A] uppercase font-mono">Coding Score</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {result.coding_score} pts
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#6B6F8A] uppercase font-mono">Effective Time</div>
              <div className="text-base font-bold text-white font-mono mt-0.5 flex items-center gap-1.5">
                <Clock size={13} className="text-[#A5B4FC]" />
                <span>{result.effective_time_formatted}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#6B6F8A] uppercase font-mono">Attempt Rate</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {result.problems_attempted} / {result.total_problems}
              </div>
            </div>
          </div>
        </div>

        {/* Post-Contest AI Intelligence Card */}
        <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B5FEF] to-[#8C52FF] flex items-center justify-center text-white shadow-lg">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  SmartZero AI Tutor • Performance Intelligence
                </h3>
                <p className="text-[10px] text-[#A0A6C2]">
                  Post-contest diagnostic & personalized algorithmic recommendations
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#5B5FEF]/10 text-[#818CF8] border border-[#5B5FEF]/30">
              AI Post-Mortem
            </span>
          </div>

          {aiLoading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-2 text-xs text-[#A0A6C2]">
              <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
              <span>Synthesizing algorithmic insights...</span>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-5 text-xs">
              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-[#D8DCEF] leading-relaxed">
                {aiAnalysis.summary}
              </div>

              {/* Strong vs Weak Topics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#12121A] border border-emerald-900/30 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    Demonstrated Strengths
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysis.strongestTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#12121A] border border-amber-900/30 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    Target Focus Areas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysis.weakTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mistake Patterns */}
              {aiAnalysis.mistakePatterns.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold text-[#A0A6C2] tracking-wider">
                    Algorithmic & Submission Patterns
                  </div>
                  <div className="space-y-1.5">
                    {aiAnalysis.mistakePatterns.map((pat, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] text-[#C5CBE3] flex items-start gap-2"
                      >
                        <span className="text-[#5B5FEF] font-bold">•</span>
                        <span>{pat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Recommendations */}
              {aiAnalysis.recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold text-[#A0A6C2] tracking-wider">
                    Actionable Next Steps
                  </div>
                  <div className="space-y-1.5">
                    {aiAnalysis.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] text-[#C5CBE3] flex items-start gap-2"
                      >
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested SmartZero Interactive Lessons */}
              {aiAnalysis.suggestedSmartZeroLessons.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#27273D]/80">
                  <div className="text-[10px] uppercase font-bold text-[#A0A6C2] tracking-wider">
                    Recommended SmartZero Visual Canvas Lessons
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.suggestedSmartZeroLessons.map((lessonId) => (
                      <Link
                        key={lessonId}
                        href={`/?lesson=${lessonId}`}
                        className="px-3 py-1.5 rounded-lg bg-[#5B5FEF]/10 hover:bg-[#5B5FEF]/20 text-[#818CF8] border border-[#5B5FEF]/30 font-mono text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles size={11} />
                        <span>{lessonId}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Official Disclaimer */}
              <div className="pt-3 border-t border-[#27273D]/60 text-[10px] text-[#6B6F8A] italic">
                {aiAnalysis.disclaimer}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-xs text-[#6B6F8A] text-center">
              {aiError || "Post-contest AI intelligence is unavailable for this session."}
            </div>
          )}
        </div>

        {/* Question-Wise Performance Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#A0A6C2]">
              Question-by-Question Analysis
            </h3>
            <span className="text-xs text-[#6B6F8A]">
              Detailed solutions and explanations
            </span>
          </div>

          <div className="space-y-3">
            {result.question_performance.map((qp, idx) => (
              <div
                key={qp.question_id || idx}
                className="bg-[#181824] border border-[#27273D] rounded-xl p-5 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#27273D] text-[#D8DCEF]">
                      Q{idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        qp.question_type === "mcq"
                          ? "bg-purple-950/40 text-purple-300 border border-purple-800/40"
                          : "bg-blue-950/40 text-blue-300 border border-blue-800/40"
                      }`}
                    >
                      {qp.question_type}
                    </span>
                    <span className="font-semibold text-white truncate max-w-md">
                      {qp.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span
                      className={`font-bold ${
                        qp.status === "solved"
                          ? "text-emerald-400"
                          : qp.status === "partial"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {qp.earned_marks} / {qp.allocated_marks} pts
                    </span>
                  </div>
                </div>

                {/* MCQ Explanation Post-Contest */}
                {qp.question_type === "mcq" && qp.mcq_info && (
                  <div className="bg-[#12121A] border border-[#27273D] rounded-lg p-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      {qp.mcq_info.is_correct ? (
                        <div className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 size={13} />
                          <span>Correct Answer</span>
                        </div>
                      ) : (
                        <div className="text-rose-400 flex items-center gap-1 font-semibold">
                          <XCircle size={13} />
                          <span>Incorrect / Missed</span>
                        </div>
                      )}
                    </div>
                    {qp.mcq_info.explanation && (
                      <p className="text-[#A0A6C2] leading-relaxed">
                        <span className="font-bold text-white">Explanation: </span>
                        {qp.mcq_info.explanation}
                      </p>
                    )}
                  </div>
                )}

                {/* Coding challenge summary */}
                {qp.question_type === "coding" && qp.coding_info && (
                  <div className="bg-[#12121A] border border-[#27273D] rounded-lg p-3 flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-[#6B6F8A]">Verdict:</span>
                      <span
                        className={`font-bold ${
                          qp.coding_info.best_verdict === "Accepted"
                            ? "text-emerald-400"
                            : qp.coding_info.best_verdict === "Partial Accepted"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {qp.coding_info.best_verdict || "No Submission"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[#A0A6C2]">
                      {qp.coding_info.test_cases_passed !== undefined && (
                        <span>
                          Test cases: {qp.coding_info.test_cases_passed}/
                          {qp.coding_info.total_test_cases}
                        </span>
                      )}
                      <span>Attempts: {qp.coding_info.submissions_count}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
