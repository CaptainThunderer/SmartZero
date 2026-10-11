"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  FileCode,
  Check,
} from "lucide-react";
import type { ValidationResult, ParsedImportQuestion } from "@/lib/contest/importer";

export default function ContestQuestionImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [existingCount, setExistingCount] = useState<number>(0);
  const [contestName, setContestName] = useState<string>("");
  const [duplicatesWithExisting, setDuplicatesWithExisting] = useState<Array<{ incomingIndex: number; titleOrPrompt: string; type: string }>>([]);
  const [deduplicate, setDeduplicate] = useState<boolean>(true);
  const [showReplaceModal, setShowReplaceModal] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setErrorMsg(null);
      setDuplicatesWithExisting([]);
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) return;
    setParsing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/contests/${id}/questions/import`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setParsing(false);

      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Failed to parse file.");
      } else if (data.preview) {
        setPreview(data.preview);
        setExistingCount(data.existingCount || 0);
        setContestName(data.contestName || "");
        setDuplicatesWithExisting(data.duplicatesWithExisting || []);
      }
    } catch (err: unknown) {
      setParsing(false);
      setErrorMsg(err instanceof Error ? err.message : "Network error during upload.");
    }
  };

  const handleCommitImport = async (confirmed = false) => {
    if (!preview || preview.validQuestions.length === 0) return;
    if (importMode === "replace" && !confirmed) {
      setShowReplaceModal(true);
      return;
    }
    setCommitting(true);
    setErrorMsg(null);
    setShowReplaceModal(false);

    try {
      const res = await fetch(`/api/admin/contests/${id}/questions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: preview.validQuestions,
          mode: importMode,
          deduplicate,
        }),
      });

      const data = await res.json();
      setCommitting(false);

      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Failed to commit questions.");
      } else {
        setSuccessCount(data.importedCount);
        setTimeout(() => {
          router.push(`/admin/contests/${id}/questions`);
        }, 1500);
      }
    } catch (err: unknown) {
      setCommitting(false);
      setErrorMsg(err instanceof Error ? err.message : "Network error during commit.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={`/admin/contests/${id}/questions`}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Question Bank</span>
      </Link>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">Import Question Bank</h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Upload questions in JSON, CSV, or Excel (.xlsx) format with automated schema validation.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Successfully imported {successCount} questions! Redirecting to contest...</span>
          </div>
        )}

        {/* Downloadable Templates Section */}
        <div className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
              <FileSpreadsheet size={15} className="text-[#5B5FEF]" />
              <span>Need help with the format? Download Example File</span>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              Download ready-to-use template files preloaded with valid MCQ & Coding challenges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/admin/contests/templates?format=json"
              download="smartzero_questions_template.json"
              className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] hover:border-[#5B5FEF]/50 bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileCode size={13} className="text-[#5B5FEF]" />
              <span>JSON</span>
            </a>
            <a
              href="/api/admin/contests/templates?format=csv"
              download="smartzero_questions_template.csv"
              className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] hover:border-[#5B5FEF]/50 bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>CSV</span>
            </a>
            <a
              href="/api/admin/contests/templates?format=xlsx"
              download="smartzero_questions_template.xlsx"
              className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] hover:border-[#5B5FEF]/50 bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={13} className="text-indigo-600 dark:text-indigo-400" />
              <span>Excel (XLSX)</span>
            </a>
            <a
              href="/api/admin/contests/templates?format=xls"
              download="smartzero_questions_template.xls"
              className="px-3 py-1.5 rounded-lg border border-[var(--card-border)] hover:border-[#5B5FEF]/50 bg-[var(--card)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={13} className="text-teal-600 dark:text-teal-400" />
              <span>Excel (XLS)</span>
            </a>
          </div>
        </div>

        {/* Upload Box */}
        <div className="p-6 rounded-2xl border-2 border-dashed border-[var(--card-border)] hover:border-[#5B5FEF]/50 bg-[var(--subtle)] text-center space-y-3 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center mx-auto">
            <Upload size={20} />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--ink)] cursor-pointer hover:underline">
              <span>Choose JSON, CSV, or XLSX file</span>
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Supports MCQ & Coding formats
            </p>
          </div>

          {file && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#5B5FEF]/10 dark:bg-[#252646] text-[#5B5FEF] dark:text-[#A5B4FC] text-xs font-mono">
              <FileText size={13} />
              <span>{file.name}</span>
              <span className="text-[10px] text-[var(--muted)]">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          {file && !preview && (
            <div className="pt-2">
              <button
                onClick={handleUploadAndParse}
                disabled={parsing}
                className="px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>Validate & Preview</span>
              </button>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="space-y-5 pt-4 border-t border-[var(--card-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--ink)]">Import Preview & Diagnostics</h2>
                <p className="text-xs text-[var(--muted)]">
                  Format: <span className="uppercase font-mono text-[#5B5FEF] dark:text-[#A5B4FC]">{preview.format}</span> • {preview.totalParsed} total rows parsed
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCommitImport(false)}
                  disabled={committing || preview.validQuestions.length === 0}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors ${
                    importMode === "replace"
                      ? "bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                      : "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                  }`}
                >
                  {committing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>
                    {importMode === "replace"
                      ? `Replace All (${preview.validQuestions.length} Questions)`
                      : `Import ${preview.validQuestions.length - (deduplicate ? duplicatesWithExisting.length : 0)} Questions`}
                  </span>
                </button>
              </div>
            </div>

            {/* Import Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--ink)]">Import Strategy</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Append Mode */}
                <button
                  type="button"
                  onClick={() => setImportMode("append")}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                    importMode === "append"
                      ? "bg-[#5B5FEF]/10 dark:bg-[#252646] border-[#5B5FEF] ring-1 ring-[#5B5FEF]"
                      : "bg-[var(--subtle)] border-[var(--card-border)] hover:border-[#5B5FEF]/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${importMode === "append" ? "border-[#5B5FEF] bg-[#5B5FEF]" : "border-[var(--muted)]"}`} />
                      Append Questions
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                      Safe
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    Keep the existing {existingCount} question assignment(s) and add valid questions from this file.
                  </p>
                </button>

                {/* Replace Mode */}
                <button
                  type="button"
                  onClick={() => setImportMode("replace")}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                    importMode === "replace"
                      ? "bg-rose-500/10 dark:bg-rose-950/40 border-rose-500 ring-1 ring-rose-500"
                      : "bg-[var(--subtle)] border-[var(--card-border)] hover:border-rose-400/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${importMode === "replace" ? "border-rose-500 bg-rose-500" : "border-[var(--muted)]"}`} />
                      Replace Existing Questions
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">
                      Replaces {existingCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    Remove current {existingCount} question assignment(s) and replace them with this file&apos;s questions. Question bank records remain intact.
                  </p>
                </button>
              </div>
            </div>

            {/* Duplicates with Existing Warning */}
            {duplicatesWithExisting.length > 0 && importMode === "append" && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">
                      {duplicatesWithExisting.length} incoming question(s) already exist in this contest
                    </div>
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 line-clamp-1">
                      Example: &ldquo;{duplicatesWithExisting[0].titleOrPrompt}&rdquo;
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--ink)] shrink-0">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="rounded border-[var(--card-border)] text-[#5B5FEF]"
                  />
                  <span>Skip existing duplicates</span>
                </label>
              </div>
            )}

            {/* Error Callout */}
            {preview.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
                  <AlertCircle size={15} />
                  <span>Found {preview.errors.length} validation error(s) (these rows will be skipped):</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] text-red-700 dark:text-red-300">
                  {preview.errors.map((err, i) => (
                    <div key={i}>
                      • Row {err.row}{err.field ? ` [${err.field}]` : ""}: {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning Callout */}
            {preview.warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                  <AlertTriangle size={15} />
                  <span>Found {preview.warnings.length} warning(s):</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                  {preview.warnings.map((warn, i) => (
                    <div key={i}>
                      • Row {warn.row}{warn.field ? ` [${warn.field}]` : ""}: {warn.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Valid Questions Table Preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Ready to Import ({preview.validQuestions.length})
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {preview.validQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[var(--subtle)] border border-[var(--card-border)] flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            q.type === "sql"
                              ? "bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : q.type === "coding"
                              ? "bg-indigo-500/10 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                              : "bg-purple-500/10 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {q.type === "sql" ? "SQL Coding" : q.type === "coding" ? "Python Coding" : "MCQ"}
                        </span>
                        <span className="font-semibold text-[var(--ink)]">
                          {q.type === "mcq" ? q.question_text : q.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {q.type === "mcq"
                          ? `${q.options.length} options • Marks: ${q.marks}`
                          : `${q.test_cases.length} test cases • Marks: ${q.marks}`}
                      </div>
                    </div>

                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>Valid</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Template Format Instructions */}
        <div className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--card-border)] text-[11px] space-y-2 text-[var(--muted)]">
          <div className="font-bold text-[var(--ink)] text-xs">Supported File Formats & Column Headers:</div>
          <div>
            • <strong className="text-[var(--ink)]">MCQ (Spreadsheet / CSV)</strong>: Columns:{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">type</code> (mcq),{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">question_text</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">option_a</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">option_b</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">option_c</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">option_d</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">correct_answer</code> (A, B, C, or D),{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">marks</code>.
          </div>
          <div>
            • <strong className="text-[var(--ink)]">Coding (Spreadsheet / CSV)</strong>: Columns:{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">type</code> (coding),{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">title</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">description</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">sample_input</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">sample_output</code>,{" "}
            <code className="text-[#5B5FEF] dark:text-[#A5B4FC]">marks</code>.
          </div>
        </div>
      </div>

      {/* Replacement Confirmation Modal */}
      {showReplaceModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">Confirm Question Replacement</h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  You are about to remove all current question assignments from this contest.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--card-border)] space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--muted)]">Contest:</span>
                <span className="font-semibold text-[var(--ink)]">{contestName || id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--muted)]">Existing Questions to Remove:</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{existingCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--line)]">
                <span className="text-[var(--muted)]">Incoming Questions to Link:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{preview.validQuestions.length}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--muted)]">Expected Final Question Count:</span>
                <span className="font-mono font-bold text-[var(--ink)]">{preview.validQuestions.length}</span>
              </div>
            </div>

            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              Note: This action only replaces contest assignments. Existing shared questions in the question bank remain safe and accessible.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--card-border)]">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] hover:bg-[var(--subtle)] text-[var(--ink)] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCommitImport(true)}
                disabled={committing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {committing ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>Confirm &amp; Replace Questions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
