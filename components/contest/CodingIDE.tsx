"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  History,
  Terminal,
  RotateCcw,
  Code2,
  Check,
} from "lucide-react";
import type {
  CodingQuestion,
  SqlQuestion,
  QuestionType,
  CodingLanguage,
  CodingVerdict,
  CodingSubmission,
  TestCaseVerdictResult,
} from "@/types/contest";
import { STARTER_TEMPLATES, getSqlStarterTemplate } from "@/lib/judge/templates";

// Dynamically import Monaco Editor to avoid SSR window issues
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-xs text-[#6B6F8A] font-mono">
      Initializing Monaco IDE...
    </div>
  ),
});

/**
 * Generates an isolated, student/attempt-scoped cache key for coding drafts.
 * Scoped strictly to: contestId, attemptNumber, studentId, questionId, language.
 * Format: smartzero:draft:<contestId>:<attemptNumber>:<studentId>:<questionId>:<language>
 */
export function getStudentDraftKey(
  userId: string | undefined,
  contestIdOrSlug: string | undefined,
  attemptOrQuestion: number | string | undefined,
  questionOrLanguage: string,
  maybeLanguage?: string
): string | null {
  if (!userId || userId === "unauthenticated-viewer" || userId === "demo-student-user") return null;

  const contestId = contestIdOrSlug || "contest";
  let attemptNumber = 1;
  let questionId = "";
  let language = "python";

  if (typeof attemptOrQuestion === "number" && maybeLanguage !== undefined) {
    // 5 arguments: (userId, contestId, attemptNumber, questionId, language)
    attemptNumber = attemptOrQuestion;
    questionId = questionOrLanguage;
    language = maybeLanguage;
  } else {
    // 4 arguments: (userId, slug, questionId, language)
    attemptNumber = 1;
    questionId = String(attemptOrQuestion || "");
    language = questionOrLanguage;
  }

  return `smartzero:draft:${contestId}:${attemptNumber}:${userId}:${questionId}:${language}`;
}

/**
 * Purges legacy unscoped client draft keys to prevent cross-user leakage.
 */
export function cleanupLegacyUnscopedDrafts(slug?: string, questionId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("smartzero_code_") ||
          k.startsWith("coding_draft_") ||
          (slug && questionId && k.startsWith(`smartzero_code_${slug}_${questionId}_`)))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Non-blocking
  }
}

interface CodingIDEProps {
  slug: string;
  contestId?: string;
  attemptNumber?: number;
  questionId: string;
  codingDetails?: CodingQuestion;
  sqlDetails?: SqlQuestion;
  questionType?: QuestionType;
  marks: number;
  userId?: string;
  onSubmissionSuccess?: (score: number) => void;
}

export default function CodingIDE({
  slug,
  contestId,
  attemptNumber = 1,
  questionId,
  codingDetails,
  sqlDetails,
  questionType,
  marks,
  userId,
  onSubmissionSuccess,
}: CodingIDEProps) {
  const isSqlQuestion = questionType === "sql" || !!sqlDetails;
  const initialLang: CodingLanguage = isSqlQuestion ? "sql" : "python";

  const getInitialStarter = useCallback(
    (lang: CodingLanguage): string => {
      if (lang === "sql") {
        return getSqlStarterTemplate(sqlDetails);
      }
      return STARTER_TEMPLATES[lang] || "";
    },
    [sqlDetails]
  );

  const [language, setLanguage] = useState<CodingLanguage>(initialLang);
  const [code, setCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      cleanupLegacyUnscopedDrafts(slug, questionId);
      const scopedKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, initialLang);
      if (scopedKey) {
        const cached = localStorage.getItem(scopedKey);
        if (cached !== null) return cached;
      }
    }
    return getInitialStarter(initialLang);
  });
  const [customInput, setCustomInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"results" | "custom" | "history">("results");

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<{
    verdict: CodingVerdict;
    execution_time_ms: number;
    test_case_results: TestCaseVerdictResult[];
    compile_output?: string;
  } | null>(null);

  const [lastSubmission, setLastSubmission] = useState<CodingSubmission | null>(null);
  const [submissionsHistory, setSubmissionsHistory] = useState<CodingSubmission[]>([]);

  // Draft Autosave State
  const [draftStatus, setDraftStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "RETRYING" | "SAVE_FAILED">("IDLE");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSeqRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<string | undefined>(userId);

  // Invalidate previous student state if userId prop changes dynamically
  useEffect(() => {
    if (currentUserIdRef.current !== userId) {
      currentUserIdRef.current = userId;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      setDraftStatus("IDLE");
      setRunResult(null);
      setLastSubmission(null);
      setSubmissionsHistory([]);

      const scopedKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, language);
      const scopedCache = scopedKey && typeof window !== "undefined" ? localStorage.getItem(scopedKey) : null;
      setCode(scopedCache || getInitialStarter(language));
    }
  }, [userId, contestId, slug, attemptNumber, questionId, language, getInitialStarter]);

  // Synchronize code with student-scoped cache when question or language changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      cleanupLegacyUnscopedDrafts(slug, questionId);
      const scopedKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, language);
      const cached = scopedKey ? localStorage.getItem(scopedKey) : null;
      if (cached !== null) {
        setCode(cached);
      } else {
        setCode(getInitialStarter(language));
      }
    }
  }, [slug, contestId, attemptNumber, questionId, language, userId, getInitialStarter]);

  // Fetch previous submission history for Submissions tab (history only; does not overwrite new attempt starter)
  useEffect(() => {
    if (!userId || userId === "demo-student-user") return;

    let cancelled = false;
    fetch(`/api/contest/${slug}/coding/submissions?question_id=${questionId}&user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || currentUserIdRef.current !== userId) return;
        if (data.submissions) {
          setSubmissionsHistory(data.submissions);
          if (data.submissions.length > 0) {
            setLastSubmission(data.submissions[0]);
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug, questionId, userId]);

  // Debounced Draft Autosave to Server with monotonic sequence and identity protection
  useEffect(() => {
    if (!userId || !code || code === getInitialStarter(language)) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const targetUserId = userId;
    saveTimeoutRef.current = setTimeout(async () => {
      // Abort if identity changed during debounce window
      if (currentUserIdRef.current !== targetUserId) return;

      const currentSeq = ++draftSeqRef.current;
      setDraftStatus("SAVING");
      let attempts = 0;
      let success = false;
      while (attempts < 3 && !success) {
        attempts++;
        try {
          if (currentUserIdRef.current !== targetUserId) return;

          const res = await fetch(`/api/contest/${slug}/coding/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question_id: questionId,
              language,
              code,
              user_id: targetUserId,
              seq: currentSeq,
              timestamp: Date.now(),
            }),
          });
          if (res.ok) {
            success = true;
            if (currentSeq === draftSeqRef.current && currentUserIdRef.current === targetUserId) {
              setDraftStatus("SAVED");
            }
            break;
          }
        } catch {
          // Retry
        }
        if (!success && attempts < 3) {
          if (currentSeq === draftSeqRef.current && currentUserIdRef.current === targetUserId) {
            setDraftStatus("RETRYING");
          }
          await new Promise((r) => setTimeout(r, 600 * attempts));
        }
      }
      if (!success && currentSeq === draftSeqRef.current && currentUserIdRef.current === targetUserId) {
        setDraftStatus("SAVE_FAILED");
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [code, language, questionId, slug, userId, getInitialStarter]);

  const handleLanguageChange = (newLang: CodingLanguage) => {
    if (typeof window !== "undefined") {
      const oldKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, language);
      if (oldKey) {
        try {
          localStorage.setItem(oldKey, code);
        } catch {}
      }
      const newKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, newLang);
      const cached = newKey ? localStorage.getItem(newKey) : null;
      setCode(cached !== null ? cached : getInitialStarter(newLang));
    } else {
      setCode(getInitialStarter(newLang));
    }
    setLanguage(newLang);
  };

  const handleCodeChange = (newCode: string | undefined) => {
    const val = newCode || "";
    setCode(val);
    if (typeof window !== "undefined") {
      const scopedKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, language);
      if (scopedKey) {
        try {
          localStorage.setItem(scopedKey, val);
        } catch {}
      }
    }
  };

  const handleResetCode = () => {
    const reset = getInitialStarter(language);
    setCode(reset);
    if (typeof window !== "undefined") {
      const scopedKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, language);
      if (scopedKey) {
        try {
          localStorage.removeItem(scopedKey);
        } catch {}
      }
    }
  };

  const handleRestoreSubmission = (sub: CodingSubmission) => {
    if (sub.code) {
      if (sub.language && sub.language !== language) {
        setLanguage(sub.language);
      }
      setCode(sub.code);
      if (typeof window !== "undefined") {
        const scopedKey = getStudentDraftKey(userId, contestId || slug, attemptNumber, questionId, sub.language || language);
        if (scopedKey) {
          try {
            localStorage.setItem(scopedKey, sub.code);
          } catch {}
        }
      }
    }
  };

  // Run Code against Sample Test Cases
  const handleRunCode = async () => {
    if (isRunningRef.current || isSubmittingRef.current) return;
    isRunningRef.current = true;
    setIsRunning(true);
    setActiveTab("results");
    try {
      const res = await fetch(`/api/contest/${slug}/coding/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: questionId,
          code,
          language,
          custom_input: customInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setRunResult(data.summary);
      } else {
        setRunResult({
          verdict: data.code === "JUDGE_UNAVAILABLE" ? "JUDGE_UNAVAILABLE" : "SYSTEM_ERROR",
          execution_time_ms: 0,
          test_case_results: [],
          compile_output: data.error || "Code execution service is temporarily unavailable.",
        });
      }
    } catch {
      setRunResult({
        verdict: "JUDGE_UNAVAILABLE",
        execution_time_ms: 0,
        test_case_results: [],
        compile_output: "Code execution service is temporarily unavailable. Please check your network and retry.",
      });
    } finally {
      isRunningRef.current = false;
      setIsRunning(false);
    }
  };

  // Submit Solution for Official Judging (Hidden Test Cases)
  const handleOfficialSubmit = async () => {
    if (isSubmittingRef.current || isRunningRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setActiveTab("results");
    try {
      const res = await fetch(`/api/contest/${slug}/coding/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: questionId,
          code,
          language,
          user_id: userId || "demo-student-user",
        }),
      });
      const data = await res.json();
      if (res.ok && data.submission) {
        setLastSubmission(data.submission);
        setSubmissionsHistory((prev) => [data.submission, ...prev]);
        setRunResult({
          verdict: data.submission.verdict,
          execution_time_ms: data.submission.execution_time_ms,
          test_case_results: data.submission.test_case_results || [],
          compile_output: data.submission.compile_output,
        });
        if (onSubmissionSuccess) {
          onSubmissionSuccess(data.submission.score);
        }
      } else {
        setRunResult({
          verdict: data.code === "JUDGE_UNAVAILABLE" ? "JUDGE_UNAVAILABLE" : "SYSTEM_ERROR",
          execution_time_ms: 0,
          test_case_results: [],
          compile_output:
            data.error ||
            "Judge service is temporarily unavailable. Your submission was not scored. Please try again.",
        });
      }
    } catch {
      setRunResult({
        verdict: "JUDGE_UNAVAILABLE",
        execution_time_ms: 0,
        test_case_results: [],
        compile_output:
          "Judge service is temporarily unavailable. Your submission was not scored. Please try again.",
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#12121A]">
      {/* ── LEFT PANE: PROBLEM STATEMENT & SAMPLES ── */}
      <div className="w-full lg:w-5/12 border-b lg:border-b-0 lg:border-r border-[#27273D] bg-[#181824] flex flex-col overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="space-y-2 border-b border-[#27273D] pb-4">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                isSqlQuestion
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-[#5B5FEF]/15 text-[#5B5FEF] border border-[#5B5FEF]/30"
              }`}>
                {isSqlQuestion ? "SQL Database Query" : "Coding Challenge"}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {marks} Marks
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#27273D] text-[#A0A6C2]">
                {sqlDetails?.difficulty || codingDetails?.difficulty || "Medium"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {sqlDetails?.title || codingDetails?.title || "Challenge Problem"}
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-[#A0A6C2] font-mono">
              <span>Time Limit: {sqlDetails?.time_limit_ms || codingDetails?.time_limit_ms || 2000}ms</span>
              {!isSqlQuestion && codingDetails?.memory_limit_mb && (
                <span>Memory Limit: {codingDetails.memory_limit_mb}MB</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3 text-xs leading-relaxed text-[#D8DCEF]">
            <h3 className="text-xs font-bold uppercase text-[#A0A6C2] tracking-wider">
              Problem Description
            </h3>
            <p className="whitespace-pre-line">{sqlDetails?.description || codingDetails?.description}</p>
          </div>

          {/* SQL-Specific Database Schema & Sample Data */}
          {isSqlQuestion && sqlDetails && (
            <>
              {sqlDetails.schema_sql && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-amber-400 font-mono text-[11px] uppercase tracking-wider">
                    Database Schema (DDL):
                  </h3>
                  <pre className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] font-mono text-[11px] text-amber-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {sqlDetails.schema_sql}
                  </pre>
                </div>
              )}

              {sqlDetails.sample_data_sql && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-indigo-400 font-mono text-[11px] uppercase tracking-wider">
                    Sample Dataset:
                  </h3>
                  <pre className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] font-mono text-[11px] text-[#A5B4FC] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {sqlDetails.sample_data_sql}
                  </pre>
                </div>
              )}

              {sqlDetails.sample_expected_output && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-emerald-400 font-mono text-[11px] uppercase tracking-wider">
                    Sample Expected Output{sqlDetails.order_sensitive ? " (Order Sensitive)" : ""}:
                  </h3>
                  <pre className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {sqlDetails.sample_expected_output}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* Coding Challenge Formats & Constraints */}
          {!isSqlQuestion && codingDetails && (
            <>
              {codingDetails.input_format && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-white">Input Format:</h3>
                  <p className="text-[#A0A6C2] whitespace-pre-line leading-relaxed">
                    {codingDetails.input_format}
                  </p>
                </div>
              )}

              {codingDetails.output_format && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-white">Output Format:</h3>
                  <p className="text-[#A0A6C2] whitespace-pre-line leading-relaxed">
                    {codingDetails.output_format}
                  </p>
                </div>
              )}

              {codingDetails.constraints && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-bold text-white">Constraints:</h3>
                  <pre className="p-3 rounded-lg bg-[#12121A] border border-[#27273D] font-mono text-[11px] text-[#A5B4FC] overflow-x-auto whitespace-pre-wrap">
                    {codingDetails.constraints}
                  </pre>
                </div>
              )}

              {/* Sample Test Cases */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold uppercase text-[#A0A6C2] tracking-wider">
                  Sample Test Cases
                </h3>
                {codingDetails.test_cases
                  ?.filter((tc) => tc.is_sample)
                  .map((tc, idx) => (
                    <div
                      key={tc.id || idx}
                      className="rounded-xl border border-[#27273D] bg-[#12121A] p-3.5 space-y-2 text-xs"
                    >
                      <div className="font-bold text-[#A5B4FC] text-[11px]">
                        Sample Case {idx + 1}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] text-[#6B6F8A] uppercase font-mono mb-1">
                            Input
                          </div>
                          <pre className="p-2.5 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-white overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                            {tc.input || "(empty)"}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#6B6F8A] uppercase font-mono mb-1">
                            Expected Output
                          </div>
                          <pre className="p-2.5 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                            {tc.expected_output || "(empty)"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT PANE: MONACO EDITOR & JUDGE CONSOLE ── */}
      <div className="w-full lg:w-7/12 flex flex-col h-full bg-[#12121A]">
        {/* Editor Toolbar */}
        <div className="h-11 border-b border-[#27273D] bg-[#181824] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white font-mono">
              <Code2 size={15} className="text-[#5B5FEF]" />
              <span>Solution Editor</span>
            </div>

            {/* Language Selector: Restricted to Python 3 and SQL (SQLite) */}
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as CodingLanguage)}
              disabled={isSqlQuestion}
              className="bg-[#12121A] border border-[#27273D] text-white text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#5B5FEF] disabled:opacity-90"
            >
              {isSqlQuestion ? (
                <option value="sql">SQL (SQLite)</option>
              ) : (
                <>
                  <option value="python">Python 3</option>
                  <option value="sql">SQL (SQLite)</option>
                </>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[11px] font-mono flex items-center gap-1.5 mr-1">
              {draftStatus === "SAVING" ? (
                <>
                  <Loader2 size={11} className="animate-spin text-[#A5B4FC]" />
                  <span className="text-[#A5B4FC]">Draft saving...</span>
                </>
              ) : draftStatus === "SAVED" ? (
                <>
                  <Check size={11} className="text-emerald-400" />
                  <span className="text-emerald-400">Draft saved</span>
                </>
              ) : draftStatus === "RETRYING" ? (
                <>
                  <Loader2 size={11} className="animate-spin text-amber-400" />
                  <span className="text-amber-400">Retrying draft...</span>
                </>
              ) : draftStatus === "SAVE_FAILED" ? (
                <span className="text-rose-400">Draft unsaved</span>
              ) : null}
            </div>

            <button
              onClick={handleResetCode}
              title="Reset starter template"
              className="p-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-[#A0A6C2] hover:text-white hover:border-[#383854] text-xs transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 min-h-[320px] relative bg-[#12121A]">
          <Editor
            height="100%"
            language={language === "cpp" ? "cpp" : language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "var(--font-geist-mono), Menlo, Monaco, Consolas, monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              readOnly: false,
              domReadOnly: false,
              contextmenu: true,
              quickSuggestions: true,
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: "on",
              tabCompletion: "on",
              autoClosingBrackets: "always",
              autoClosingQuotes: "always",
              formatOnPaste: true,
            }}
            onMount={(editor) => {
              try {
                editor.focus();
              } catch {}
            }}
          />
        </div>

        {/* Bottom Console Tabs & Action Bar */}
        <div className="border-t border-[#27273D] bg-[#181824] flex flex-col shrink-0">
          {/* Console Tabs */}
          <div className="h-9 border-b border-[#27273D] px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("results")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === "results"
                    ? "bg-[#27273D] text-white"
                    : "text-[#A0A6C2] hover:text-white"
                }`}
              >
                Test Results
              </button>
              <button
                onClick={() => setActiveTab("custom")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === "custom"
                    ? "bg-[#27273D] text-white"
                    : "text-[#A0A6C2] hover:text-white"
                }`}
              >
                Custom Input
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === "history"
                    ? "bg-[#27273D] text-white"
                    : "text-[#A0A6C2] hover:text-white"
                }`}
              >
                <History size={12} />
                <span>Submissions ({submissionsHistory.length})</span>
              </button>
            </div>

            {/* Run / Submit Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRunCode}
                disabled={isRunning || isSubmitting}
                className="px-3.5 py-1 rounded-lg border border-[#3B3B59] bg-[#12121A] hover:bg-[#1E1E2E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-[#A5B4FC]" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play size={12} className="text-[#5B5FEF]" />
                    <span>Run Code</span>
                  </>
                )}
              </button>

              <button
                onClick={handleOfficialSubmit}
                disabled={isRunning || isSubmitting}
                className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Judging...</span>
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Console Drawer Content */}
          <div className="h-44 p-4 overflow-y-auto text-xs font-mono">
            {activeTab === "custom" && (
              <div className="space-y-2 h-full flex flex-col">
                <div className="text-[10px] text-[#A0A6C2] uppercase font-bold">
                  Enter custom test case stdin:
                </div>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Paste custom input here..."
                  className="flex-1 w-full p-2.5 rounded-lg border border-[#27273D] bg-[#12121A] text-white font-mono text-xs focus:outline-none focus:border-[#5B5FEF] resize-none"
                />
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-2">
                {submissionsHistory.length === 0 ? (
                  <div className="text-[#6B6F8A] text-center py-6">
                    No submissions recorded yet for this challenge.
                  </div>
                ) : (
                  submissionsHistory.map((sub, idx) => (
                    <div
                      key={sub.id || idx}
                      className="p-2.5 rounded-lg border border-[#27273D] bg-[#12121A] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.verdict === "Accepted"
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-700/50"
                              : sub.verdict === "Partial Accepted"
                              ? "bg-amber-950/60 text-amber-300 border border-amber-700/50"
                              : "bg-rose-950/60 text-rose-300 border border-rose-700/50"
                          }`}
                        >
                          {sub.verdict}
                        </span>
                        <span className="text-[#A0A6C2] uppercase text-[10px]">
                          {sub.language}
                        </span>
                        {sub.score !== undefined ? (
                          <span className="text-white font-bold">
                            {sub.score} / {marks} pts
                          </span>
                        ) : (
                          <span className="text-[#A0A6C2] text-[10px]">
                            Score Hidden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] text-[#6B6F8A] flex items-center gap-2">
                          <span>{sub.execution_time_ms}ms</span>
                          <span>•</span>
                          <span>{new Date(sub.submitted_at).toLocaleTimeString()}</span>
                        </div>
                        {sub.code && (
                          <button
                            onClick={() => handleRestoreSubmission(sub)}
                            title="Restore this submitted code into editor"
                            className="px-2 py-0.5 rounded bg-[#27273D] hover:bg-[#383854] text-[#A0A6C2] hover:text-white text-[10px] transition-colors"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div>
                {!runResult ? (
                  <div className="text-[#6B6F8A] text-center py-6 flex flex-col items-center gap-1.5">
                    <Terminal size={18} />
                    <span>Run code or submit solution to inspect verdicts</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Overall Verdict Banner */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#27273D]">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-bold ${
                            runResult.verdict === "Accepted"
                              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-600/60"
                              : runResult.verdict === "Partial Accepted"
                              ? "bg-amber-950/80 text-amber-300 border border-amber-600/60"
                              : runResult.verdict === "JUDGE_UNAVAILABLE"
                              ? "bg-amber-950/80 text-amber-300 border border-amber-600/60"
                              : "bg-rose-950/80 text-rose-300 border border-rose-600/60"
                          }`}
                        >
                          {runResult.verdict === "JUDGE_UNAVAILABLE"
                            ? "Judge Unavailable"
                            : runResult.verdict === "TLE"
                            ? "Time Limit Exceeded"
                            : runResult.verdict === "MLE"
                            ? "Memory Limit Exceeded"
                            : runResult.verdict === "SYSTEM_ERROR"
                            ? "System Error"
                            : runResult.verdict}
                        </span>
                        {lastSubmission && lastSubmission.score !== undefined && runResult.verdict !== "JUDGE_UNAVAILABLE" && (
                          <span className="text-white font-bold">
                            Score: {lastSubmission.score} / {marks}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#A0A6C2]">
                        Max Runtime: {runResult.execution_time_ms}ms
                      </div>
                    </div>

                    {/* Compilation Error Output */}
                    {runResult.compile_output && (
                      <div
                        className={`p-3 rounded-lg text-[11px] whitespace-pre-wrap ${
                          runResult.verdict === "JUDGE_UNAVAILABLE"
                            ? "bg-amber-950/20 border border-amber-900/40 text-amber-300"
                            : "bg-rose-950/20 border border-rose-900/40 text-rose-300"
                        }`}
                      >
                        {runResult.compile_output}
                      </div>
                    )}

                    {/* Test Case Breakdown */}
                    <div className="space-y-2">
                      {runResult.test_case_results?.map((tc, idx) => (
                        <div
                          key={tc.test_case_id || idx}
                          className="p-2.5 rounded-lg border border-[#27273D] bg-[#12121A] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#A5B4FC]">
                              {tc.is_sample ? `Sample Case ${idx + 1}` : `Hidden Test Case ${idx + 1}`}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                tc.verdict === "Accepted"
                                  ? "text-emerald-400 bg-emerald-950/40"
                                  : "text-rose-400 bg-rose-950/40"
                              }`}
                            >
                              {tc.verdict} ({tc.execution_time_ms}ms)
                            </span>
                          </div>

                          {/* Show details ONLY for sample test cases */}
                          {tc.is_sample && (
                            <div className="space-y-2 pt-1 text-[10px]">
                              {tc.columns && tc.rows ? (
                                <div>
                                  <div className="flex items-center justify-between text-[#6B6F8A] mb-1 font-mono">
                                    <span className="font-bold text-indigo-300">Query Result:</span>
                                    <span>{tc.row_count ?? tc.rows.length} rows • {tc.execution_time_ms}ms</span>
                                  </div>
                                  <pre className="p-2.5 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
                                    {tc.actual_output || "(empty result)"}
                                  </pre>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-[#6B6F8A] block mb-1">Input:</span>
                                    <pre className="p-2 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-white overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                                      {tc.input || "(none)"}
                                    </pre>
                                  </div>
                                  <div>
                                    <span className="text-[#6B6F8A] block mb-1">Actual Output:</span>
                                    <pre className="p-2 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                                      {tc.actual_output || "(empty)"}
                                    </pre>
                                  </div>
                                </div>
                              )}
                              {tc.error && (
                                <div className="text-rose-400 p-2 rounded bg-rose-950/20 border border-rose-900/40 whitespace-pre-wrap">
                                  {tc.error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
