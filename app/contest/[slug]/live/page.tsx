"use client";

import React, { useEffect, useState, use, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  Loader2,
  Check,
  Trophy,
  Home,
  ShieldCheck,
  Code2,
  ShieldAlert,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { ContestQuestion, ContestStatus, McqAnswer } from "@/types/contest";
import CodingIDE from "@/components/contest/CodingIDE";
import RealtimeLeaderboard from "@/components/contest/RealtimeLeaderboard";
import ExamSecurityShield from "@/components/contest/ExamSecurityShield";

export default function LiveContestExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, initialize } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [contestTitle, setContestTitle] = useState("");
  const [contestId, setContestId] = useState("");
  const [questions, setQuestions] = useState<ContestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Policy & Gate States
  const [fullscreenRequired, setFullscreenRequired] = useState(true);
  const [autoSubmitOnViolation, setAutoSubmitOnViolation] = useState(false);
  const [maxViolations, setMaxViolations] = useState(5);
  const [allowRetake, setAllowRetake] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [attemptNumber, setAttemptNumber] = useState(1);

  // Exam flow states
  const [examStarted, setExamStarted] = useState(false);
  const [isEnteringFullscreen, setIsEnteringFullscreen] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [submissionReason, setSubmissionReason] = useState<string>("manual");
  const [violationsCount, setViolationsCount] = useState<number>(0);

  // Trigger to immediately refresh live leaderboard on submissions
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Student answers state: question_id -> { option_id, is_marked_for_review }
  const [answers, setAnswers] = useState<
    Record<string, { option_id: string | null; is_marked: boolean }>
  >({});

  // Autosave status (authoritative sequencing and bounded retry)
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "RETRYING" | "SAVE_FAILED">("SAVED");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const saveSeqRef = useRef<Record<string, number>>({});

  // Authoritative Timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [contestStatus, setContestStatus] = useState<ContestStatus>("LIVE");

  // Submission UI state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<{
    totalScore: number;
    answeredCount: number;
    correctCount: number;
    incorrectCount: number;
  } | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load contest questions, policies, and pre-existing answers
  useEffect(() => {
    const userId = user?.id || "demo-student-user";
    fetch(`/api/contest/${slug}/questions?user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push(`/contest/${slug}`);
          return;
        }

        setContestId(data.contest_id);
        setContestTitle(data.title || "Contest Exam");
        setQuestions(data.questions || []);
        setContestStatus(data.status || "LIVE");

        // Policies
        setFullscreenRequired(data.fullscreen_required ?? true);
        setAutoSubmitOnViolation(data.auto_submit_on_violation ?? false);
        setMaxViolations(data.max_violations ?? 5);
        setAllowRetake(data.allow_retake ?? false);
        setMaxAttempts(data.max_attempts ?? 1);

        if (typeof data.seconds_remaining === "number") {
          setSecondsRemaining(data.seconds_remaining);
        }

        if (data.participant) {
          setAttemptNumber(data.participant.attempt_number || 1);
          setViolationsCount(data.participant.violations_count || 0);

          if (
            data.participant.status === "in_exam" ||
            data.participant.status === "in_progress"
          ) {
            setExamStarted(true);
          } else if (
            data.participant.status === "submitted" ||
            data.participant.status === "auto_submitted" ||
            data.participant.status === "finalized"
          ) {
            setSubmitted(true);
            if (data.participant.status === "auto_submitted") {
              setIsAutoSubmitted(true);
              setSubmissionReason(data.participant.submission_reason || "integrity_violation");
            }
          }
        }

        // Hydrate previous answers
        const ansMap: Record<string, { option_id: string | null; is_marked: boolean }> = {};
        if (Array.isArray(data.answers)) {
          data.answers.forEach((ans: McqAnswer) => {
            ansMap[ans.question_id] = {
              option_id: ans.selected_option_id,
              is_marked: ans.is_marked_for_review,
            };
          });
        }
        setAnswers(ansMap);
      })
      .catch(() => {
        router.push(`/contest/${slug}`);
      })
      .finally(() => setLoading(false));
  }, [slug, user, router]);

  // Sync server timer with user-authoritative state
  useEffect(() => {
    const userId = user?.id || "demo-student-user";
    const sync = () => {
      fetch(`/api/contest/${slug}/state?user_id=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status) {
            setContestStatus(data.status);
            if (typeof data.seconds_remaining === "number") {
              setSecondsRemaining(data.seconds_remaining);
            }
          }
        })
        .catch(() => {});
    };

    sync();
    const interval = setInterval(sync, 10000);
    return () => clearInterval(interval);
  }, [slug, user?.id]);

  // Handle final submission (manual or timer expiry)
  const executeSubmission = useCallback(async (reason: "manual" | "timer_expiry" | "integrity_violation" = "manual") => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/contest/${slug}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || "demo-student-user",
          reason,
          violations_count: violationsCount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        if (reason === "integrity_violation") {
          setIsAutoSubmitted(true);
          setSubmissionReason("integrity_violation");
        }
        if (data.score) {
          setFinalScore(data.score);
        }
      }
    } catch {
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  }, [slug, user, violationsCount]);

  // Handle auto-submit event from security shield
  const handleAutoSubmit = useCallback(async (violations: number, message: string) => {
    setViolationsCount(violations);
    setIsAutoSubmitted(true);
    setSubmissionReason("integrity_violation");
    setSubmitted(true);
    try {
      const res = await fetch(`/api/contest/${slug}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || "demo-student-user",
          reason: "integrity_violation",
          violations_count: violations,
        }),
      });
      const data = await res.json();
      if (data.score) {
        setFinalScore(data.score);
      }
    } catch {}
  }, [slug, user]);

  // 1-second local countdown tick
  useEffect(() => {
    if (submitted || !examStarted) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executeSubmission("timer_expiry");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted, examStarted, executeSubmission]);

  // Enter Fullscreen & Unlock Exam Workspace
  const handleStartExamWithFullscreen = async () => {
    setIsEnteringFullscreen(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen permission rejected or not supported", err);
    }

    try {
      const res = await fetch(`/api/contest/${slug}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user?.id || "demo-student-user" }),
      });
      const data = await res.json();
      if (data.success) {
        setExamStarted(true);
        if (typeof data.seconds_remaining === "number") {
          setSecondsRemaining(data.seconds_remaining);
        }
      }
    } catch {
      setExamStarted(true);
    } finally {
      setIsEnteringFullscreen(false);
    }
  };

  // Start New Attempt (Retake Flow)
  const handleStartNewAttempt = async () => {
    setIsRetaking(true);
    try {
      const res = await fetch(`/api/contest/${slug}/retake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user?.id || "demo-student-user" }),
      });
      const data = await res.json();
      if (data.success && data.participant) {
        setAttemptNumber(data.participant.attempt_number || attemptNumber + 1);
        setSubmitted(false);
        setIsAutoSubmitted(false);
        setExamStarted(false);
        setFinalScore(null);
        setAnswers({});
        setCurrentIndex(0);
        setViolationsCount(0);
        if (typeof data.seconds_remaining === "number") {
          setSecondsRemaining(data.seconds_remaining);
        }
      }
    } catch (err) {
      console.error("Retake error", err);
    } finally {
      setIsRetaking(false);
    }
  };

  // Robust Authoritative Answer Persistence with Sequencing and Bounded Retry
  const persistAnswer = async (
    questionId: string,
    selectedOptionId: string | null,
    isMarked: boolean
  ) => {
    if (submitted) return;

    // Sequence protection: track monotonically increasing sequence per question
    const currentSeq = (saveSeqRef.current[questionId] || 0) + 1;
    saveSeqRef.current[questionId] = currentSeq;

    setSaveStatus("SAVING");
    setSaveErrorMessage(null);

    let attempts = 0;
    let success = false;

    while (attempts < 3 && !success) {
      attempts++;
      try {
        const res = await fetch(`/api/contest/${slug}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: questionId,
            selected_option_id: selectedOptionId,
            is_marked_for_review: isMarked,
            user_id: user?.id || "demo-student-user",
          }),
        });

        if (res.ok) {
          success = true;
          break;
        }
      } catch {
        // Network error during attempt
      }

      // If a newer save request was fired for this question during the network call, abort immediately
      if (saveSeqRef.current[questionId] !== currentSeq) {
        return;
      }

      if (!success && attempts < 3) {
        setSaveStatus("RETRYING");
        await new Promise((r) => setTimeout(r, 500 * attempts));
      }
    }

    // Only apply final status if this response corresponds to the latest user action
    if (saveSeqRef.current[questionId] === currentSeq) {
      if (success) {
        setSaveStatus("SAVED");
        setSaveErrorMessage(null);
      } else {
        setSaveStatus("SAVE_FAILED");
        setSaveErrorMessage("Unable to save your answer. Please check your connection and try again.");
      }
    }
  };

  // Autosave single option selection
  const handleSelectOption = async (questionId: string, optionId: string) => {
    if (submitted) return;

    const current = answers[questionId] || { option_id: null, is_marked: false };
    const nextOptionId = current.option_id === optionId ? null : optionId;
    const updated = { ...current, option_id: nextOptionId };

    setAnswers((prev) => ({ ...prev, [questionId]: updated }));
    await persistAnswer(questionId, nextOptionId, updated.is_marked);
  };

  // Toggle Mark for Review
  const handleToggleReview = async (questionId: string) => {
    if (submitted) return;

    const current = answers[questionId] || { option_id: null, is_marked: false };
    const nextReview = !current.is_marked;
    const updated = { ...current, is_marked: nextReview };

    setAnswers((prev) => ({ ...prev, [questionId]: updated }));
    await persistAnswer(questionId, current.option_id, nextReview);
  };

  // Clear current question selection
  const handleClearResponse = async (questionId: string) => {
    if (submitted) return;

    const current = answers[questionId] || { option_id: null, is_marked: false };
    const updated = { ...current, option_id: null };

    setAnswers((prev) => ({ ...prev, [questionId]: updated }));
    await persistAnswer(questionId, null, current.is_marked);
  };

  // Format time HH:MM:SS
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Counts for navigator
  const totalCount = questions.length;
  const answeredCount = Object.values(answers).filter((a) => a.option_id !== null).length;
  const markedCount = Object.values(answers).filter((a) => a.is_marked).length;
  const unansweredCount = Math.max(0, totalCount - answeredCount);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#12121A] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
          <span className="text-xs text-[#A0A6C2]">Loading assessment workspace...</span>
        </div>
      </div>
    );
  }

  // ── 1. AUTO-SUBMITTED SCREEN (NEUTRAL INSTITUTIONAL NOTIFICATION) ──
  if (submitted && isAutoSubmitted) {
    return (
      <div className="min-h-screen bg-[#12121A] text-[#F1F5F9] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#181824] border border-amber-600/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
            <ShieldAlert size={36} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Exam Automatically Submitted</h1>
            <p className="text-xs text-[#A0A6C2] leading-relaxed">
              Your examination has been automatically submitted due to an integrity policy trigger (e.g. fullscreen exit or window focus change). All answers and code written prior to this point have been securely recorded.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2 text-left text-xs">
            <div className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">Attempt</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {attemptNumber} of {maxAttempts}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">Violations Logged</div>
              <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                {violationsCount} events
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">Answered</div>
              <div className="text-base font-bold text-white font-mono mt-0.5">
                {finalScore ? finalScore.answeredCount : answeredCount} / {totalCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">Authoritative Score</div>
              <div className="text-base font-bold text-[#5B5FEF] font-mono mt-0.5">
                {finalScore ? `${finalScore.totalScore} pts` : "Recorded"}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {allowRetake && attemptNumber < maxAttempts ? (
              <button
                onClick={handleStartNewAttempt}
                disabled={isRetaking}
                className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
              >
                {isRetaking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span>Start New Attempt ({attemptNumber + 1}/{maxAttempts})</span>
              </button>
            ) : null}

            <Link
              href={`/contest/${slug}`}
              className="w-full py-2.5 rounded-xl bg-[#27273D]/60 hover:bg-[#27273D] text-[#A0A6C2] hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trophy size={14} />
              <span>Contest Overview</span>
            </Link>

            <Link
              href="/dashboard"
              className="w-full py-2.5 rounded-xl bg-[#12121A] border border-[#27273D] text-[#A0A6C2] hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Home size={14} />
              <span>Student Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. STANDARD SUBMISSION SCREEN ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#12121A] text-[#F1F5F9] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#181824] border border-[#27273D] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 mx-auto flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Assessment Submitted!</h1>
            <p className="text-xs text-[#A0A6C2] leading-relaxed">
              Your responses for <span className="text-white font-medium">{contestTitle}</span> have been securely recorded on the server.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2 text-left">
            <div className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">Answered</div>
              <div className="text-lg font-bold text-white font-mono mt-0.5">
                {finalScore ? finalScore.answeredCount : answeredCount} / {totalCount}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D]">
              <div className="text-[10px] text-[#A0A6C2] uppercase font-semibold">Final Score</div>
              <div className="text-lg font-bold text-[#5B5FEF] font-mono mt-0.5">
                {finalScore ? `${finalScore.totalScore} pts` : "Recorded"}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/30 text-[11px] text-[#A5B4FC] flex items-center justify-center gap-2">
            <ShieldCheck size={14} className="text-indigo-400" />
            <span>Attempt #{attemptNumber} — Server-side verification complete</span>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {allowRetake && attemptNumber < maxAttempts && (
              <button
                onClick={handleStartNewAttempt}
                disabled={isRetaking}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
              >
                {isRetaking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span>Start New Attempt ({attemptNumber + 1}/{maxAttempts})</span>
              </button>
            )}

            <Link
              href={`/contest/${slug}`}
              className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Trophy size={14} />
              <span>View Contest Summary</span>
            </Link>
            <Link
              href="/dashboard"
              className="w-full py-2.5 rounded-xl bg-[#27273D]/60 hover:bg-[#27273D] text-[#A0A6C2] hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Home size={14} />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. MANDATORY FULLSCREEN GATE MODAL ──
  if (fullscreenRequired && !examStarted) {
    return (
      <div className="min-h-screen bg-[#12121A] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#181824] border border-[#27273D] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#5B5FEF]/15 border border-[#5B5FEF]/30 mx-auto flex items-center justify-center text-[#5B5FEF]">
            <Maximize2 size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Fullscreen Required</h1>
            <p className="text-xs text-[#A0A6C2] leading-relaxed">
              This assessment requires continuous fullscreen mode to ensure examination integrity. Exiting fullscreen or switching windows may result in automatic submission.
            </p>
          </div>

          <div className="space-y-2.5 text-left text-xs bg-[#12121A] border border-[#27273D] p-4 rounded-xl">
            <div className="flex items-center gap-2 text-[#A5B4FC]">
              <ShieldCheck size={14} className="text-[#5B5FEF] shrink-0" />
              <span>Continuous Fullscreen Active</span>
            </div>
            <div className="flex items-center gap-2 text-[#A0A6C2]">
              <Clock size={14} className="text-indigo-400 shrink-0" />
              <span>Server-synchronized countdown</span>
            </div>
            <div className="flex items-center gap-2 text-[#A0A6C2]">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              <span>Integrity violation threshold: {maxViolations} events</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={handleStartExamWithFullscreen}
              disabled={isEnteringFullscreen}
              className="w-full py-3 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#5B5FEF]/20 transition-all disabled:opacity-50"
            >
              {isEnteringFullscreen ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Maximize2 size={15} />
              )}
              <span>Enter Fullscreen & Start Exam</span>
            </button>

            <Link
              href={`/contest/${slug}`}
              className="text-xs text-[#A0A6C2] hover:text-white transition-colors"
            >
              Cancel & Return to Contest Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentMcq = currentQ?.mcq_details;
  const currentAnswer = currentQ ? answers[currentQ.question_id] : undefined;
  const isLowTime = secondsRemaining <= 300;

  return (
    <div className="min-h-screen bg-[#12121A] text-[#F1F5F9] flex flex-col font-sans select-none">
      {/* ── TOP AUTHORITATIVE EXAM HEADER ── */}
      <header className="h-14 border-b border-[#27273D] bg-[#181824] px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#5B5FEF]/10 border border-[#5B5FEF]/30 flex items-center justify-center text-[#5B5FEF] font-bold text-xs font-mono">
            SZ
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
              {contestTitle}
            </h1>
            <div className="text-[10px] text-[#A0A6C2] flex items-center gap-2 font-mono">
              <span>Q {currentIndex + 1} of {totalCount}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {saveStatus === "SAVING" ? (
                  <>
                    <Loader2 size={10} className="animate-spin text-[#A5B4FC]" />
                    <span className="text-[#A5B4FC]">Saving...</span>
                  </>
                ) : saveStatus === "SAVED" ? (
                  <>
                    <Check size={10} className="text-emerald-400" />
                    <span className="text-emerald-400">Saved</span>
                  </>
                ) : saveStatus === "RETRYING" ? (
                  <>
                    <Loader2 size={10} className="animate-spin text-amber-400" />
                    <span className="text-amber-400">Retrying save...</span>
                  </>
                ) : saveStatus === "SAVE_FAILED" ? (
                  <span className="text-rose-400">Save failed</span>
                ) : (
                  <span className="text-[#A0A6C2]">Ready</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Collapsible Live Leaderboard */}
          <RealtimeLeaderboard
            slug={slug}
            userId={user?.id}
            refreshTrigger={refreshTrigger}
          />

          {/* Server countdown timer pill */}
          <div
            className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs flex items-center gap-2 transition-colors ${
              isLowTime
                ? "bg-rose-950/40 border-rose-600/60 text-rose-300 animate-pulse"
                : "bg-[#12121A] border-[#27273D] text-white"
            }`}
          >
            <Clock size={13} className={isLowTime ? "text-rose-400" : "text-[#5B5FEF]"} />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          {/* Submit Exam button */}
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Send size={12} />
            <span>Submit Exam</span>
          </button>
        </div>
      </header>

      {/* Exam Anti-Cheat & Focus Security Shield */}
      <ExamSecurityShield
        slug={slug}
        userId={user?.id}
        enabled={!submitted && examStarted}
        onAutoSubmit={handleAutoSubmit}
      />

      {/* ── MAIN EXAM CANVAS LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / CENTER: QUESTION WORKSPACE */}
        <main className="flex-1 flex flex-col bg-[#12121A] overflow-hidden">
          {currentQ ? (
            (currentQ.question_type === "coding" && currentQ.coding_details) ||
            (currentQ.question_type === "sql" && currentQ.sql_details) ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <CodingIDE
                  key={`${user?.id || "anon"}_${currentQ.question_id}`}
                  slug={slug}
                  questionId={currentQ.question_id}
                  codingDetails={currentQ.coding_details}
                  sqlDetails={currentQ.sql_details}
                  questionType={currentQ.question_type}
                  marks={currentQ.marks}
                  userId={user?.id}
                  onSubmissionSuccess={() => setRefreshTrigger((t) => t + 1)}
                />
              </div>
            ) : (
              <div className="max-w-3xl w-full mx-auto p-6 sm:p-8 flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  {saveErrorMessage && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
                      <span>{saveErrorMessage}</span>
                      <button
                        onClick={() => setSaveErrorMessage(null)}
                        className="text-[11px] underline text-rose-400 hover:text-rose-200 ml-2 shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Question Info Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#27273D]">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-md bg-[#27273D] text-xs font-bold text-white font-mono">
                        Question {currentIndex + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#5B5FEF]/10 text-[#5B5FEF] border border-[#5B5FEF]/30 uppercase">
                        MCQ
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                        +{currentQ.marks} Marks
                      </span>
                      {currentQ.negative_marks > 0 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950/40 text-rose-400 border border-rose-800/40">
                          -{currentQ.negative_marks} Negative
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleReview(currentQ.question_id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        currentAnswer?.is_marked
                          ? "bg-amber-950/50 border-amber-600/60 text-amber-300"
                          : "border-[#27273D] text-[#A0A6C2] hover:text-white"
                      }`}
                    >
                      <Bookmark size={13} />
                      <span>{currentAnswer?.is_marked ? "Marked for Review" : "Mark for Review"}</span>
                    </button>
                  </div>

                  {/* Question Text Prompt */}
                  <div className="text-base sm:text-lg font-medium text-white leading-relaxed">
                    {currentMcq?.question_text || "No question prompt available."}
                  </div>

                  {/* Options List */}
                  <div className="space-y-3 pt-2">
                    {currentMcq?.options?.map((option, idx) => {
                      const isSelected = currentAnswer?.option_id === option.id;
                      const optionLabel = String.fromCharCode(65 + idx);

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleSelectOption(currentQ.question_id, option.id)}
                          className={`w-full p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all ${
                            isSelected
                              ? "bg-[#5B5FEF]/15 border-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/10"
                              : "bg-[#181824] border-[#27273D] text-[#D8DCEF] hover:border-[#383854] hover:bg-[#1E1E2E]"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-[#5B5FEF] text-white"
                                : "bg-[#12121A] text-[#A0A6C2] border border-[#27273D]"
                            }`}
                          >
                            {optionLabel}
                          </div>
                          <span className="text-sm pt-0.5 leading-snug">{option.option_text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Bottom Action Navigation */}
                <div className="pt-8 border-t border-[#27273D] flex items-center justify-between">
                  <button
                    onClick={() => handleClearResponse(currentQ.question_id)}
                    disabled={!currentAnswer?.option_id}
                    className="text-xs text-[#A0A6C2] hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <RotateCcw size={12} />
                    <span>Clear Selection</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="px-4 py-2 rounded-xl border border-[#27273D] bg-[#181824] hover:bg-[#1E1E2E] text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>

                    <button
                      onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
                      disabled={currentIndex === totalCount - 1}
                      className="px-5 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-40 transition-colors shadow-sm"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#A0A6C2]">
              No questions found for this contest.
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR: QUESTION PALETTE NAVIGATOR */}
        <aside className="w-72 border-l border-[#27273D] bg-[#181824] flex flex-col shrink-0 hidden md:flex">
          <div className="p-4 border-b border-[#27273D]">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Question Palette
            </h2>
            <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>{answeredCount} Answered</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>{markedCount} Review</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#6B6F8A]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#27273D]"></span>
                <span>{unansweredCount} Left</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2.5">
              {questions.map((q, idx) => {
                const ans = answers[q.question_id];
                const isCurrent = idx === currentIndex;
                const isAnswered = ans && ans.option_id !== null;
                const isMarked = ans && ans.is_marked;
                const isCoding = q.question_type === "coding";
                const isSql = q.question_type === "sql";

                let btnClass = "border-[#27273D] bg-[#12121A] text-[#A0A6C2] hover:border-[#383854]";
                if (isCurrent) {
                  btnClass = "border-[#5B5FEF] bg-[#5B5FEF]/20 text-white font-bold ring-2 ring-[#5B5FEF]/40";
                } else if (isMarked) {
                  btnClass = "border-amber-600/50 bg-amber-950/40 text-amber-300";
                } else if (isAnswered) {
                  btnClass = "border-emerald-600/50 bg-emerald-950/40 text-emerald-300";
                }

                return (
                  <button
                    key={q.question_id || idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl border text-xs font-mono font-semibold flex items-center justify-center relative transition-all ${btnClass}`}
                  >
                    <span>{idx + 1}</span>
                    {isCoding && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                    {isSql && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ── FINAL SUBMISSION CONFIRMATION MODAL ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-[#27273D] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">Submit Examination?</h3>
              <p className="text-xs text-[#A0A6C2] leading-relaxed">
                Are you sure you want to finish your assessment? Once submitted, your answers will be locked and graded authoritatively.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-[#12121A] border border-[#27273D]">
                <div className="text-[10px] text-[#A0A6C2]">Answered</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">{answeredCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#12121A] border border-[#27273D]">
                <div className="text-[10px] text-[#A0A6C2]">Review</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">{markedCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#12121A] border border-[#27273D]">
                <div className="text-[10px] text-[#A0A6C2]">Unanswered</div>
                <div className="text-sm font-bold text-rose-400 mt-0.5">{unansweredCount}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-[#27273D] text-xs font-semibold text-[#A0A6C2] hover:text-white transition-colors"
              >
                Continue Exam
              </button>
              <button
                onClick={() => executeSubmission("manual")}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
