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
          className="inline-flex items-center gap-1.5 text-xs text-[#A0A6C2] hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Contest Details</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/contests/${id}/import`}
            className="px-3.5 py-1.5 rounded-xl border border-[#27273D] hover:bg-[#1E1E2E] text-xs font-semibold flex items-center gap-1.5 text-white transition-colors"
          >
            <Upload size={13} />
            <span>Import Questions</span>
          </Link>

          <button
            onClick={() => setShowMcqModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus size={13} />
            <span>Add MCQ</span>
          </button>

          <button
            onClick={() => setShowCodeModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#252646] hover:bg-[#30325A] text-[#A5B4FC] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus size={13} />
            <span>Add Coding</span>
          </button>
        </div>
      </div>

      <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold">Contest Question Bank</h1>
          <p className="text-xs text-[#A0A6C2]">
            Order questions and assign positive / negative marks.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2 text-xs text-red-400">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
          </div>
        ) : questions.length === 0 ? (
          <div className="p-10 rounded-xl bg-[#12121A] border border-[#27273D] text-center space-y-2">
            <FileQuestion size={28} className="mx-auto text-[#6B6F8A]" />
            <div className="text-xs font-semibold">No questions linked to this contest yet</div>
            <div className="text-[11px] text-[#A0A6C2]">
              Add questions manually or import via JSON/CSV/XLSX.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((cq, idx) => (
              <div
                key={cq.id}
                className="p-4 rounded-xl bg-[#12121A] border border-[#27273D] flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#252646] text-[#A5B4FC] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-white">
                      {cq.question_type === "mcq"
                        ? cq.mcq_details?.question_text || "Multiple Choice Question"
                        : cq.coding_details?.title || "Coding Challenge"}
                    </div>
                    <div className="text-[11px] text-[#A0A6C2] flex items-center gap-2 mt-0.5">
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#252646] text-[#A5B4FC]">
                        {cq.question_type}
                      </span>
                      <span>Marks: {cq.marks}</span>
                      {cq.negative_marks > 0 && (
                        <span className="text-red-400">Penalty: -{cq.negative_marks}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={idx === 0}
                    onClick={() => moveQuestion(idx, "up")}
                    className="p-1.5 rounded hover:bg-[#1E1E2E] disabled:opacity-30 text-[#A0A6C2]"
                    title="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    disabled={idx === questions.length - 1}
                    onClick={() => moveQuestion(idx, "down")}
                    className="p-1.5 rounded hover:bg-[#1E1E2E] disabled:opacity-30 text-[#A0A6C2]"
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
          <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27273D]">
              <h2 className="text-sm font-bold">Add Multiple Choice Question</h2>
              <button
                onClick={() => setShowMcqModal(false)}
                className="text-[#6B6F8A] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMcq} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A0A6C2] font-semibold mb-1">Question Prompt *</label>
                <textarea
                  required
                  rows={3}
                  value={mcqText}
                  onChange={(e) => setMcqText(e.target.value)}
                  placeholder="What is the average time complexity of QuickSort?"
                  className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[#A0A6C2] font-semibold">Options (Select Correct)</label>
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
                    <span className="font-bold text-[#A0A6C2]">{opt.label}:</span>
                    <input
                      type="text"
                      value={opt.val}
                      onChange={(e) => opt.set(e.target.value)}
                      placeholder={`Option ${opt.label} text`}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[#A0A6C2] font-semibold mb-1">Marks</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={mcqMarks}
                    onChange={(e) => setMcqMarks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#A0A6C2] font-semibold mb-1">Negative Marks</label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={mcqNegativeMarks}
                    onChange={(e) => setMcqNegativeMarks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#27273D]">
                <button
                  type="button"
                  onClick={() => setShowMcqModal(false)}
                  className="px-3 py-1.5 rounded-lg text-[#A0A6C2] hover:bg-[#1E1E2E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-medium"
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
          <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27273D]">
              <h2 className="text-sm font-bold">Add Coding Problem</h2>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-[#6B6F8A] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCode} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A0A6C2] font-semibold mb-1">Problem Title *</label>
                <input
                  required
                  type="text"
                  value={codeTitle}
                  onChange={(e) => setCodeTitle(e.target.value)}
                  placeholder="e.g. Reverse Linked List"
                  className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block text-[#A0A6C2] font-semibold mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={codeDesc}
                  onChange={(e) => setCodeDesc(e.target.value)}
                  placeholder="Given the head of a singly linked list, reverse the list..."
                  className="w-full px-3 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A0A6C2] font-semibold mb-1">Sample Input</label>
                  <textarea
                    rows={2}
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    placeholder="[1,2,3,4,5]"
                    className="w-full px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#A0A6C2] font-semibold mb-1">Sample Output</label>
                  <textarea
                    rows={2}
                    value={sampleOutput}
                    onChange={(e) => setSampleOutput(e.target.value)}
                    placeholder="[5,4,3,2,1]"
                    className="w-full px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#A0A6C2] font-semibold mb-1">Marks</label>
                <input
                  type="number"
                  min={1}
                  value={codeMarks}
                  onChange={(e) => setCodeMarks(Number(e.target.value))}
                  className="w-32 px-3 py-1.5 rounded-lg border border-[#27273D] bg-[#12121A] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#27273D]">
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="px-3 py-1.5 rounded-lg text-[#A0A6C2] hover:bg-[#1E1E2E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-medium"
                >
                  Add Problem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
