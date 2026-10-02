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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setErrorMsg(null);
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
      }
    } catch (err: unknown) {
      setParsing(false);
      setErrorMsg(err instanceof Error ? err.message : "Network error during upload.");
    }
  };

  const handleCommitImport = async () => {
    if (!preview || preview.validQuestions.length === 0) return;
    setCommitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/admin/contests/${id}/questions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: preview.validQuestions }),
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
        className="inline-flex items-center gap-1.5 text-xs text-[#A0A6C2] hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Question Bank</span>
      </Link>

      <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Import Question Bank</h1>
          <p className="text-xs text-[#A0A6C2] mt-1">
            Upload questions in JSON, CSV, or Excel (.xlsx) format with automated schema validation.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successCount !== null && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-400">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Successfully imported {successCount} questions! Redirecting to contest...</span>
          </div>
        )}

        {/* Downloadable Templates Section */}
        <div className="p-4 rounded-xl border border-[#27273D] bg-[#12121A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileSpreadsheet size={15} className="text-[#5B5FEF]" />
              <span>Need help with the format? Download Example File</span>
            </div>
            <p className="text-[11px] text-[#A0A6C2]">
              Download ready-to-use template files preloaded with valid MCQ & Coding challenges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/admin/contests/templates?format=json"
              download="smartzero_questions_template.json"
              className="px-3 py-1.5 rounded-lg border border-[#27273D] hover:border-[#5B5FEF]/50 bg-[#181824] hover:bg-[#1E1E2E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileCode size={13} className="text-[#5B5FEF]" />
              <span>JSON</span>
            </a>
            <a
              href="/api/admin/contests/templates?format=csv"
              download="smartzero_questions_template.csv"
              className="px-3 py-1.5 rounded-lg border border-[#27273D] hover:border-[#5B5FEF]/50 bg-[#181824] hover:bg-[#1E1E2E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={13} className="text-emerald-400" />
              <span>CSV</span>
            </a>
            <a
              href="/api/admin/contests/templates?format=xlsx"
              download="smartzero_questions_template.xlsx"
              className="px-3 py-1.5 rounded-lg border border-[#27273D] hover:border-[#5B5FEF]/50 bg-[#181824] hover:bg-[#1E1E2E] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={13} className="text-indigo-400" />
              <span>Excel (XLSX)</span>
            </a>
          </div>
        </div>

        {/* Upload Box */}
        <div className="p-6 rounded-2xl border-2 border-dashed border-[#27273D] hover:border-[#5B5FEF]/50 bg-[#12121A] text-center space-y-3 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center mx-auto">
            <Upload size={20} />
          </div>

          <div>
            <label className="text-xs font-semibold text-white cursor-pointer hover:underline">
              <span>Choose JSON, CSV, or XLSX file</span>
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-[#A0A6C2] mt-0.5">
              Supports MCQ & Coding formats
            </p>
          </div>

          {file && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#252646] text-[#A5B4FC] text-xs font-mono">
              <FileText size={13} />
              <span>{file.name}</span>
              <span className="text-[10px] text-[#A0A6C2]">
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
          <div className="space-y-5 pt-4 border-t border-[#27273D]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Import Preview & Diagnostics</h2>
                <p className="text-xs text-[#A0A6C2]">
                  Format: <span className="uppercase font-mono text-[#A5B4FC]">{preview.format}</span> • {preview.totalParsed} total rows parsed
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCommitImport}
                  disabled={committing || preview.validQuestions.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {committing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Import {preview.validQuestions.length} Valid Questions</span>
                </button>
              </div>
            </div>

            {/* Error Callout */}
            {preview.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <AlertCircle size={15} />
                  <span>Found {preview.errors.length} validation error(s) (these rows will be skipped):</span>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] text-red-300">
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
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-900/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                  <AlertTriangle size={15} />
                  <span>Found {preview.warnings.length} warning(s):</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] text-amber-300">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#A0A6C2]">
                Ready to Import ({preview.validQuestions.length})
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {preview.validQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#12121A] border border-[#27273D] flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#252646] text-[#A5B4FC]">
                          {q.type}
                        </span>
                        <span className="font-semibold text-white">
                          {q.type === "mcq" ? q.question_text : q.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B6F8A]">
                        {q.type === "mcq"
                          ? `${q.options.length} options • Marks: ${q.marks}`
                          : `${q.test_cases.length} test cases • Marks: ${q.marks}`}
                      </div>
                    </div>

                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
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
        <div className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] text-[11px] space-y-2 text-[#A0A6C2]">
          <div className="font-bold text-white text-xs">Supported File Formats & Column Headers:</div>
          <div>
            • <strong className="text-white">MCQ (Spreadsheet / CSV)</strong>: Columns:{" "}
            <code className="text-[#A5B4FC]">type</code> (mcq),{" "}
            <code className="text-[#A5B4FC]">question_text</code>,{" "}
            <code className="text-[#A5B4FC]">option_a</code>,{" "}
            <code className="text-[#A5B4FC]">option_b</code>,{" "}
            <code className="text-[#A5B4FC]">option_c</code>,{" "}
            <code className="text-[#A5B4FC]">option_d</code>,{" "}
            <code className="text-[#A5B4FC]">correct_answer</code> (A, B, C, or D),{" "}
            <code className="text-[#A5B4FC]">marks</code>.
          </div>
          <div>
            • <strong className="text-white">Coding (Spreadsheet / CSV)</strong>: Columns:{" "}
            <code className="text-[#A5B4FC]">type</code> (coding),{" "}
            <code className="text-[#A5B4FC]">title</code>,{" "}
            <code className="text-[#A5B4FC]">description</code>,{" "}
            <code className="text-[#A5B4FC]">sample_input</code>,{" "}
            <code className="text-[#A5B4FC]">sample_output</code>,{" "}
            <code className="text-[#A5B4FC]">marks</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
