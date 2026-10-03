"use client";

import React, { useState, useEffect, useRef } from "react";
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
  CodingLanguage,
  CodingVerdict,
  CodingSubmission,
  TestCaseVerdictResult,
} from "@/types/contest";
import { STARTER_TEMPLATES } from "@/lib/judge/templates";

// Dynamically import Monaco Editor to avoid SSR window issues
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#12121A] flex items-center justify-center text-xs text-[#6B6F8A] font-mono">
      Initializing Monaco IDE...
    </div>
  ),
});

interface CodingIDEProps {
  slug: string;
  questionId: string;
  codingDetails: CodingQuestion;
  marks: number;
  userId?: string;
  onSubmissionSuccess?: (score: number) => void;
}

export default function CodingIDE({
  slug,
  questionId,
  codingDetails,
  marks,
  userId,
  onSubmissionSuccess,
}: CodingIDEProps) {
  const [language, setLanguage] = useState<CodingLanguage>("python");
  const [code, setCode] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(`smartzero_code_${slug}_${questionId}_python`);
      if (cached) return cached;
    }
    return STARTER_TEMPLATES.python;
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

  // Synchronize code with cache when question changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(`smartzero_code_${slug}_${questionId}_${language}`);
      if (cached !== null) {
        setCode(cached);
      } else {
        setCode(STARTER_TEMPLATES[language] || "");
      }
    }
  }, [slug, questionId, language]);

  // Fetch previous submission history on mount
  useEffect(() => {
    fetch(`/api/contest/${slug}/coding/submissions?question_id=${questionId}&user_id=${userId || "demo-student-user"}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.submissions) {
          setSubmissionsHistory(data.submissions);
          if (data.submissions.length > 0) {
            setLastSubmission(data.submissions[0]);
            if (typeof window !== "undefined") {
              const cached = localStorage.getItem(`smartzero_code_${slug}_${questionId}_${language}`);
              if (!cached && data.submissions[0].code) {
                setCode(data.submissions[0].code);
                if (data.submissions[0].language) {
                  setLanguage(data.submissions[0].language);
                }
              }
            }
          }
        }
      })
      .catch(() => {});
  }, [slug, questionId, userId, language]);

  // Debounced Draft Autosave to Server
  useEffect(() => {
    if (!code || code === STARTER_TEMPLATES[language]) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setDraftStatus("SAVING");
      let attempts = 0;
      let success = false;
      while (attempts < 3 && !success) {
        attempts++;
        try {
          const res = await fetch(`/api/contest/${slug}/coding/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question_id: questionId,
              language,
              code,
              user_id: userId || "demo-student-user",
            }),
          });
          if (res.ok) {
            success = true;
            setDraftStatus("SAVED");
            break;
          }
        } catch {
          // Retry
        }
        if (!success && attempts < 3) {
          setDraftStatus("RETRYING");
          await new Promise((r) => setTimeout(r, 600 * attempts));
        }
      }
      if (!success) {
        setDraftStatus("SAVE_FAILED");
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [code, language, questionId, slug, userId]);

  const handleLanguageChange = (newLang: CodingLanguage) => {
    // Save current language code
    if (typeof window !== "undefined") {
      localStorage.setItem(`smartzero_code_${slug}_${questionId}_${language}`, code);
      const cached = localStorage.getItem(`smartzero_code_${slug}_${questionId}_${newLang}`);
      setCode(cached !== null ? cached : STARTER_TEMPLATES[newLang] || "");
    } else {
      setCode(STARTER_TEMPLATES[newLang] || "");
    }
    setLanguage(newLang);
  };

  const handleCodeChange = (newCode: string | undefined) => {
    const val = newCode || "";
    setCode(val);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`smartzero_code_${slug}_${questionId}_${language}`, val);
      } catch {}
    }
  };

  const handleResetCode = () => {
    const reset = STARTER_TEMPLATES[language] || "";
    setCode(reset);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`smartzero_code_${slug}_${questionId}_${language}`);
      } catch {}
    }
  };

  const handleRestoreSubmission = (sub: CodingSubmission) => {
    if (sub.code) {
      if (sub.language && sub.language !== language) {
        setLanguage(sub.language);
      }
      setCode(sub.code);
      if (typeof window !== "undefined") {
        localStorage.setItem(`smartzero_code_${slug}_${questionId}_${sub.language || language}`, sub.code);
      }
    }
  };

  // Run Code against Sample Test Cases
  const handleRunCode = async () => {
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
      if (data.summary) {
        setRunResult(data.summary);
      }
    } catch {
      // Ignore
    } finally {
      setIsRunning(false);
    }
  };

  // Submit Solution for Official Judging (Hidden Test Cases)
  const handleOfficialSubmit = async () => {
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
      if (data.submission) {
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
      }
    } catch {
      // Ignore
    } finally {
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
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#5B5FEF]/15 text-[#5B5FEF] border border-[#5B5FEF]/30 uppercase tracking-wider">
                Coding Challenge
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {marks} Marks
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#27273D] text-[#A0A6C2]">
                {codingDetails.difficulty}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {codingDetails.title}
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-[#A0A6C2] font-mono">
              <span>Time Limit: {codingDetails.time_limit_ms}ms</span>
              <span>Memory Limit: {codingDetails.memory_limit_mb}MB</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3 text-xs leading-relaxed text-[#D8DCEF]">
            <h3 className="text-xs font-bold uppercase text-[#A0A6C2] tracking-wider">
              Problem Description
            </h3>
            <p className="whitespace-pre-line">{codingDetails.description}</p>
          </div>

          {/* Input Format */}
          {codingDetails.input_format && (
            <div className="space-y-1.5 text-xs">
              <h3 className="font-bold text-white">Input Format:</h3>
              <p className="text-[#A0A6C2] whitespace-pre-line leading-relaxed">
                {codingDetails.input_format}
              </p>
            </div>
          )}

          {/* Output Format */}
          {codingDetails.output_format && (
            <div className="space-y-1.5 text-xs">
              <h3 className="font-bold text-white">Output Format:</h3>
              <p className="text-[#A0A6C2] whitespace-pre-line leading-relaxed">
                {codingDetails.output_format}
              </p>
            </div>
          )}

          {/* Constraints */}
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
                      <pre className="p-2 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-white overflow-x-auto">
                        {tc.input || "(empty)"}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#6B6F8A] uppercase font-mono mb-1">
                        Expected Output
                      </div>
                      <pre className="p-2 rounded bg-[#181824] border border-[#27273D] font-mono text-[11px] text-emerald-400 overflow-x-auto">
                        {tc.expected_output || "(empty)"}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
          </div>
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

            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as CodingLanguage)}
              className="bg-[#12121A] border border-[#27273D] text-white text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#5B5FEF]"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="typescript">TypeScript</option>
              <option value="cpp">C++ (g++)</option>
              <option value="java">Java 17</option>
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
                        <span className="text-white font-bold">
                          {sub.score} / {marks} pts
                        </span>
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
                              : "bg-rose-950/80 text-rose-300 border border-rose-600/60"
                          }`}
                        >
                          {runResult.verdict}
                        </span>
                        {lastSubmission && (
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
                      <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-300 text-[11px] whitespace-pre-wrap">
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
                            <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                              <div>
                                <span className="text-[#6B6F8A]">Input:</span>
                                <div className="text-white truncate">{tc.input || "(none)"}</div>
                              </div>
                              <div>
                                <span className="text-[#6B6F8A]">Actual Output:</span>
                                <div className="text-emerald-300 truncate">
                                  {tc.actual_output || "(empty)"}
                                </div>
                              </div>
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
