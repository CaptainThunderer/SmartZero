"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Loader2,
  FileQuestion,
  HelpCircle,
  Code2,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckCircle2,
  X,
  AlertCircle,
  Database,
} from "lucide-react";
import type { ContestQuestion } from "@/types/contest";

export default function ContestQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [questions, setQuestions] = useState<ContestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMcqModal, setShowMcqModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual MCQ state
  const [mcqText, setMcqText] = useState("");
  const [mcqOptA, setMcqOptA] = useState("");
  const [mcqOptB, setMcqOptB] = useState("");
  const [mcqOptC, setMcqOptC] = useState("");
  const [mcqOptD, setMcqOptD] = useState("");
  const [correctIdx, setCorrectIdx] = useState(0);
  const [mcqMarks, setMcqMarks] = useState(1);
  const [mcqNegativeMarks, setMcqNegativeMarks] = useState(0);

  // Manual Coding state
  const [codeTitle, setCodeTitle] = useState("");
  const [codeDesc, setCodeDesc] = useState("");
  const [codeConstraints, setCodeConstraints] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [codeMarks, setCodeMarks] = useState(5);

  // Manual SQL state
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlTitle, setSqlTitle] = useState("");
  const [sqlDesc, setSqlDesc] = useState("");
  const [sqlSchema, setSqlSchema] = useState("");
  const [sqlSampleData, setSqlSampleData] = useState("");
  const [sqlExpectedOutput, setSqlExpectedOutput] = useState("");
  const [sqlOrderSensitive, setSqlOrderSensitive] = useState(true);
  const [sqlMarks, setSqlMarks] = useState(5);
  const [sqlTimeLimit, setSqlTimeLimit] = useState(2000);

  const loadQuestions = React.useCallback(() => {
    fetch(`/api/admin/contests/${id}/questions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.questions) setQuestions(d.questions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleAddMcq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcqText || !mcqOptA || !mcqOptB) {
      setErrorMsg("Question text and at least 2 options are required.");
      return;
    }

    const options = [
      { option_text: mcqOptA, is_correct: correctIdx === 0, sort_order: 0 },
      { option_text: mcqOptB, is_correct: correctIdx === 1, sort_order: 1 },
      ...(mcqOptC ? [{ option_text: mcqOptC, is_correct: correctIdx === 2, sort_order: 2 }] : []),
      ...(mcqOptD ? [{ option_text: mcqOptD, is_correct: correctIdx === 3, sort_order: 3 }] : []),
    ];

    try {
      const res = await fetch(`/api/admin/contests/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "mcq",
          question_text: mcqText,
          options,
          marks: Number(mcqMarks),
          negative_marks: Number(mcqNegativeMarks),
        }),
      });

      if (res.ok) {
        setShowMcqModal(false);
        setMcqText("");
        setMcqOptA("");
        setMcqOptB("");
        setMcqOptC("");
        setMcqOptD("");
        loadQuestions();
      }
    } catch {
      setErrorMsg("Failed to add question.");
    }
  };

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeTitle || !codeDesc) {
      setErrorMsg("Problem title and description are required.");
      return;
    }

    const test_cases = sampleInput
      ? [
          {
            input: sampleInput,
            expected_output: sampleOutput,
            is_sample: true,
            is_hidden: false,
            weight: 1,
          },
        ]
      : [];

    try {
      const res = await fetch(`/api/admin/contests/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "coding",
          title: codeTitle,
          description: codeDesc,
          constraints: codeConstraints,
          test_cases,
          marks: Number(codeMarks),
        }),
      });

      if (res.ok) {
        setShowCodeModal(false);
        setCodeTitle("");
        setCodeDesc("");
        setCodeConstraints("");
        setSampleInput("");
        setSampleOutput("");
        loadQuestions();
      }
    } catch {
      setErrorMsg("Failed to add coding problem.");
    }
  };

  const handleAddSql = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sqlTitle || !sqlDesc || !sqlSchema) {
      setErrorMsg("Title, description, and database schema DDL are required.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/contests/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sql",
          title: sqlTitle,
          description: sqlDesc,
          schema_sql: sqlSchema,
          sample_data_sql: sqlSampleData,
          sample_expected_output: sqlExpectedOutput,
          order_sensitive: sqlOrderSensitive,
          marks: Number(sqlMarks),
          time_limit_ms: Number(sqlTimeLimit) || 2000,
          test_cases: [
            {
              setup_sql: "",
              expected_output: sqlExpectedOutput,
              is_sample: true,
              is_hidden: false,
              weight: 1,
            },
          ],
        }),
      });

      if (res.ok) {
        setShowSqlModal(false);
        setSqlTitle("");
        setSqlDesc("");
        setSqlSchema("");
        setSqlSampleData("");
        setSqlExpectedOutput("");
        setSqlOrderSensitive(true);
        loadQuestions();
      } else {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || "Failed to add SQL question.");
      }
    } catch {
      setErrorMsg("Failed to add SQL question.");
    }
  };

  const moveQuestion = async (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const list = [...questions];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setQuestions(list);

    try {
      await fetch(`/api/admin/contests/${id}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedQuestionIds: list.map((q) => q.question_id) }),
      });
    } catch {
      loadQuestions();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/contests/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Contest Details</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/contests/${id}/import`}
            className="px-3.5 py-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:bg-[var(--subtle)] text-xs font-semibold flex items-center gap-1.5 text-[var(--ink)] transition-colors shadow-xs"
          >
            <Upload size={13} />
            <span>Import Questions</span>
          </Link>

          <button
            onClick={() => setShowMcqModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus size={13} />
            <span>Add MCQ</span>
          </button>

          <button
            onClick={() => setShowCodeModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#5B5FEF]/10 dark:bg-[#252646] hover:bg-[#5B5FEF]/20 dark:hover:bg-[#30325A] text-[#5B5FEF] dark:text-[#A5B4FC] border border-[#5B5FEF]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus size={13} />
            <span>Add Coding</span>
          </button>

          <button
            onClick={() => setShowSqlModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Database size={13} />
            <span>Add SQL</span>
          </button>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 space-y-4 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[var(--ink)]">Contest Question Bank</h1>
          <p className="text-xs text-[var(--muted)]">
            Order questions and assign positive / negative marks.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
          </div>
        ) : questions.length === 0 ? (
          <div className="p-10 rounded-xl bg-[var(--subtle)] border border-[var(--line)] text-center space-y-2">
            <FileQuestion size={28} className="mx-auto text-[var(--muted)]" />
            <div className="text-xs font-semibold text-[var(--ink)]">No questions linked to this contest yet</div>
            <div className="text-[11px] text-[var(--muted)]">
              Add questions manually or import via JSON/CSV/XLSX.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((cq, idx) => (
              <div
                key={cq.id}
                className="p-4 rounded-xl bg-[var(--subtle)] border border-[var(--line)] flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#5B5FEF]/10 dark:bg-[#252646] text-[#5B5FEF] dark:text-[#A5B4FC] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-[var(--ink)]">
                      {cq.question_type === "mcq"
                        ? cq.question_text || cq.prompt || cq.mcq_details?.question_text || "Multiple Choice Question"
                        : cq.question_type === "sql"
                        ? cq.sql_details?.title || "SQL Query Challenge"
                        : cq.coding_details?.title || "Coding Challenge"}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] flex items-center gap-2 mt-0.5">
                      <span
                        className={`uppercase text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          cq.question_type === "sql"
                            ? "bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-[#5B5FEF]/10 dark:bg-[#252646] text-[#5B5FEF] dark:text-[#A5B4FC]"
                        }`}
                      >
                        {cq.question_type}
                      </span>
                      <span>Marks: {cq.marks}</span>
                      {cq.negative_marks > 0 && (
                        <span className="text-red-500 dark:text-red-400">Penalty: -{cq.negative_marks}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={idx === 0}
                    onClick={() => moveQuestion(idx, "up")}
                    className="p-1.5 rounded hover:bg-[var(--card)] disabled:opacity-30 text-[var(--muted)] hover:text-[var(--ink)]"
                    title="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    disabled={idx === questions.length - 1}
                    onClick={() => moveQuestion(idx, "down")}
                    className="p-1.5 rounded hover:bg-[var(--card)] disabled:opacity-30 text-[var(--muted)] hover:text-[var(--ink)]"
                    title="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCQ Modal */}
      {showMcqModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <h2 className="text-sm font-bold text-[var(--ink)]">Add Multiple Choice Question</h2>
              <button
                onClick={() => setShowMcqModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMcq} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">Question Prompt *</label>
                <textarea
                  required
                  rows={3}
                  value={mcqText}
                  onChange={(e) => setMcqText(e.target.value)}
                  placeholder="What is the average time complexity of QuickSort?"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[var(--muted)] font-semibold">Options (Select Correct)</label>
                {[
                  { label: "A", val: mcqOptA, set: setMcqOptA },
                  { label: "B", val: mcqOptB, set: setMcqOptB },
                  { label: "C", val: mcqOptC, set: setMcqOptC },
                  { label: "D", val: mcqOptD, set: setMcqOptD },
                ].map((opt, i) => (
                  <div key={opt.label} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct_opt"
                      checked={correctIdx === i}
                      onChange={() => setCorrectIdx(i)}
                      className="text-[#5B5FEF]"
                    />
                    <span className="font-bold text-[var(--muted)]">{opt.label}:</span>
                    <input
                      type="text"
                      value={opt.val}
                      onChange={(e) => opt.set(e.target.value)}
                      placeholder={`Option ${opt.label} text`}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[var(--muted)] font-semibold mb-1">Marks</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={mcqMarks}
                    onChange={(e) => setMcqMarks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] font-semibold mb-1">Negative Marks</label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={mcqNegativeMarks}
                    onChange={(e) => setMcqNegativeMarks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowMcqModal(false)}
                  className="px-3 py-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--subtle)] hover:text-[var(--ink)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-medium shadow-xs transition-colors"
                >
                  Add MCQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coding Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <h2 className="text-sm font-bold text-[var(--ink)]">Add Coding Problem</h2>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCode} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">Problem Title *</label>
                <input
                  required
                  type="text"
                  value={codeTitle}
                  onChange={(e) => setCodeTitle(e.target.value)}
                  placeholder="e.g. Reverse Linked List"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={codeDesc}
                  onChange={(e) => setCodeDesc(e.target.value)}
                  placeholder="Given the head of a singly linked list, reverse the list..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted)] font-semibold mb-1">Sample Input</label>
                  <textarea
                    rows={2}
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    placeholder="[1,2,3,4,5]"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs font-mono text-[var(--ink)] placeholder-[var(--muted)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] font-semibold mb-1">Sample Output</label>
                  <textarea
                    rows={2}
                    value={sampleOutput}
                    onChange={(e) => setSampleOutput(e.target.value)}
                    placeholder="[5,4,3,2,1]"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs font-mono text-[var(--ink)] placeholder-[var(--muted)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">Marks</label>
                <input
                  type="number"
                  min={1}
                  value={codeMarks}
                  onChange={(e) => setCodeMarks(Number(e.target.value))}
                  className="w-32 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="px-3 py-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--subtle)] hover:text-[var(--ink)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-medium shadow-xs transition-colors"
                >
                  Add Problem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Database size={16} />
                </div>
                <h2 className="text-sm font-bold text-[var(--ink)]">Add SQL Query Challenge</h2>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSql} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">Problem Title *</label>
                <input
                  required
                  type="text"
                  value={sqlTitle}
                  onChange={(e) => setSqlTitle(e.target.value)}
                  placeholder="e.g. Find Students Scoring Above Average"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">Description / Task *</label>
                <textarea
                  required
                  rows={2}
                  value={sqlDesc}
                  onChange={(e) => setSqlDesc(e.target.value)}
                  placeholder="Write a query to return name and marks of students scoring above the overall average, ordered by marks DESC."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">
                  Database Schema DDL (CREATE TABLE statements) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={sqlSchema}
                  onChange={(e) => setSqlSchema(e.target.value)}
                  placeholder="CREATE TABLE students (&#10;  id INTEGER PRIMARY KEY,&#10;  name TEXT,&#10;  department TEXT,&#10;  marks INTEGER&#10;);"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs font-mono text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">
                  Sample Seed Data DDL (INSERT INTO statements)
                </label>
                <textarea
                  rows={3}
                  value={sqlSampleData}
                  onChange={(e) => setSqlSampleData(e.target.value)}
                  placeholder="INSERT INTO students VALUES&#10;(1, 'Sai', 'DS', 92),&#10;(2, 'Rahul', 'CSE', 81),&#10;(3, 'Anu', 'DS', 88),&#10;(4, 'Ravi', 'CSE', 75);"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs font-mono text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block text-[var(--muted)] font-semibold mb-1">
                  Sample Expected Output (Tabular text or JSON rows)
                </label>
                <textarea
                  rows={3}
                  value={sqlExpectedOutput}
                  onChange={(e) => setSqlExpectedOutput(e.target.value)}
                  placeholder="name | marks&#10;Sai | 92&#10;Anu | 88"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--subtle)] text-xs font-mono text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sqlOrderSensitive}
                    onChange={(e) => setSqlOrderSensitive(e.target.checked)}
                    className="rounded text-[#5B5FEF] focus:ring-0"
                  />
                  <span className="text-[var(--ink)] font-semibold">Order Sensitive</span>
                  <span className="text-[var(--muted)] text-[11px]">(Enforce exact row order match)</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[var(--muted)] font-semibold mb-1">Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={sqlMarks}
                    onChange={(e) => setSqlMarks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] font-semibold mb-1">Time Limit (ms)</label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={sqlTimeLimit}
                    onChange={(e) => setSqlTimeLimit(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--subtle)] text-xs text-[var(--ink)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-3 py-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--subtle)] hover:text-[var(--ink)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs transition-colors"
                >
                  Add SQL Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
