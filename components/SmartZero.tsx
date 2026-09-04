"use client";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  GraduationCap,
  Layers,
  Lightbulb,
  Link2,
  Pause,
  Pen,
  Play,
  Pointer,
  RotateCcw,
  Send,
  Sparkles,
  SquareFunction,
  TreePine,
  Undo2,
  Variable,
  XCircle,
  HelpCircle,
} from "lucide-react";
import SemanticCanvas from "./SemanticCanvas";
import { applyAction, initialCanvas, replay } from "../engine/core";
import { lessonFromId, SUPPORTED_LESSONS } from "../engine/lessons";
import type { Lesson, LessonPhase, CanvasState, LessonStep } from "../types/dsa";

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */
const PROMPTS = [
  "Find the second maximum element in an array.",
  "Explain binary search.",
  "Insert 65 into this BST.",
  "Reverse a linked list.",
];

const TEACH_TOOLS = [
  { id: "array", label: "Array", icon: Layers },
  { id: "list", label: "Linked List", icon: Link2 },
  { id: "tree", label: "Tree", icon: TreePine },
  { id: "variable", label: "Variable", icon: Variable },
  { id: "pointer", label: "Pointer", icon: Pointer },
  { id: "loop", label: "Loop", icon: SquareFunction },
  { id: "pen", label: "Pen", icon: Pen },
] as const;

/* ══════════════════════════════════════════════
   SmartZero Main Component
   ══════════════════════════════════════════════ */
export default function SmartZero() {
  /* ── Mode ── */
  const [mode, setMode] = useState<"learn" | "teach">("learn");

  /* ── Lesson Runtime ── */
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<LessonPhase>("idle");

  /* ── Playback ── */
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Learner Interaction ── */
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [hintIndex, setHintIndex] = useState(0);

  /* ── AI Chat ── */
  const [chat, setChat] = useState<{ role: "ai" | "user"; text: string }[]>([
    {
      role: "ai",
      text: "Hi! I'm SmartZero. Ask any DSA question and I'll turn it into a visual, step-by-step lesson.",
    },
  ]);
  const [input, setInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  /* ── Language ── */
  const [language, setLanguage] = useState<"javascript" | "cpp">("javascript");

  /* ── Teach Mode ── */
  const [teachState, setTeachState] = useState<CanvasState>(initialCanvas());

  /* ── Computed ── */
  const canvasState: CanvasState =
    mode === "teach"
      ? teachState
      : lesson
        ? replay(lesson.steps, step)
        : initialCanvas();

  const current: LessonStep | undefined = lesson?.steps[step];
  const total = lesson?.steps.length ?? 0;
  const isPauseStep = !!current?.pause && answerCorrect !== true;

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  /* ── Changes in Current Step for Structured Explanation ── */
  const changesInCurrentStep = useMemo(() => {
    if (!current) return [];
    const changes: string[] = [];
    current.actions.forEach((a) => {
      if (a.action === "update_variable") changes.push(`${a.name} → ${a.value}`);
      else if (a.action === "create_variable") changes.push(`${a.name} initialized to ${a.value}`);
      else if (a.action === "move_pointer") changes.push(`pointer ${a.pointer} → index ${a.targetIndex}`);
      else if (a.action === "create_pointer") changes.push(`pointer ${a.pointer} at index ${a.targetIndex}`);
      else if (a.action === "move_ll_pointer") changes.push(`pointer ${a.pointer} → ${a.targetId ?? "null"}`);
      else if (a.action === "set_bounds") changes.push(`bounds: low=${a.low}, mid=${a.mid}, high=${a.high}`);
      else if (a.action === "dim_elements") changes.push(`eliminated ${a.indices.length} elements from search`);
      else if (a.action === "relink") changes.push(`relink reversed up to node index ${a.reversedUpTo}`);
      else if (a.action === "compare" && a.text) changes.push(`compare: ${a.text}`);
      else if (a.action === "highlight_tree_node") changes.push(`visit tree node ${a.id}`);
      else if (a.action === "reveal_tree_node") changes.push(`insert node ${a.id}`);
    });
    return changes;
  }, [current]);

  /* ══════════════════════════════════════════
     Phase computation
     ══════════════════════════════════════════ */
  const computePhase = useCallback(
    (s: number, correct: boolean | null): LessonPhase => {
      if (!lesson) return "idle";
      const st = lesson.steps[s];
      if (!st) return "completed";
      if (
        s >= lesson.steps.length - 1 &&
        !st.pause
      )
        return "completed";
      if (st.pause && correct === null) return "waiting_for_learner";
      if (st.pause && correct === true) return "correct";
      if (st.pause && correct === false) return "incorrect";
      return "teaching";
    },
    [lesson]
  );

  /* ══════════════════════════════════════════
     Timer cleanup on unmount
     ══════════════════════════════════════════ */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* ══════════════════════════════════════════
     Playback timer
     ══════════════════════════════════════════ */
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!playing || !lesson) return;
    if (isPauseStep) {
      setPlaying(false);
      return;
    }
    if (step >= total - 1) {
      setPlaying(false);
      setPhase("completed");
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStep((s) => {
        const next = Math.min(s + 1, total - 1);
        const nextStep = lesson.steps[next];
        if (nextStep?.pause) {
          setPlaying(false);
          setPhase("waiting_for_learner");
          setSelectedAnswer(null);
          setAnswerCorrect(null);
          setHintIndex(0);
        } else if (next >= total - 1) {
          setPlaying(false);
          setPhase("completed");
        } else {
          setPhase("teaching");
        }
        return next;
      });
    }, 1400 / speed);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, lesson, step, total, speed, isPauseStep]);

  /* ══════════════════════════════════════════
     LESSON LIFECYCLE — P0
     startLesson: complete reset of all state
     ══════════════════════════════════════════ */
  function startLesson(
    l: Lesson,
    preamble = "Got it — setting up the visual lesson."
  ) {
    // 1. Stop any active playback timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 2-11. Reset ALL lesson runtime state
    setLesson(l);
    setMode("learn");
    setTeachState(initialCanvas());
    setStep(0);
    setPlaying(false);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase(l.steps[0]?.pause ? "waiting_for_learner" : "teaching");

    // 12. Chat context
    setChat((c) => [
      ...c,
      { role: "ai", text: preamble },
      {
        role: "ai",
        text: `${l.dataStructure} · ${l.pattern}\n\n${l.objective}`,
      },
      {
        role: "ai",
        text: `Lesson ready: ${l.title}. Use Next or Play to move through it.`,
      },
    ]);
  }

  /* ══════════════════════════════════════════
     Load lesson by ID
     ══════════════════════════════════════════ */
  function loadLesson(
    id: string,
    preamble = "Got it — setting up the visual lesson."
  ) {
    const l = lessonFromId(id);
    if (!l) return;
    startLesson(l, preamble);
  }

  /* ══════════════════════════════════════════
     AI Question Handler
     ══════════════════════════════════════════ */
  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text: q }]);
    setAiBusy(true);

    try {
      const r = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const task = await r.json();
      if (!r.ok) throw new Error(task.error || "Unable to interpret question");

      if (task.lessonId) {
        loadLesson(
          task.lessonId,
          "I understand the question. Let's build the visualization."
        );
      } else {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text: `I can currently teach:\n\n${SUPPORTED_LESSONS.map((l) => `• ${l.title}`).join("\n")}\n\nTry one of these topics!`,
          },
        ]);
      }
    } catch (e) {
      setChat((c) => [
        ...c,
        {
          role: "ai",
          text: e instanceof Error ? e.message : "Something went wrong.",
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  /* ══════════════════════════════════════════
     Answer Submission
     ══════════════════════════════════════════ */
  function submitAnswer(choiceId: string) {
    if (!current?.question) return;
    const correct = choiceId === current.question.correctId;
    setSelectedAnswer(choiceId);
    setAnswerCorrect(correct);
    setPhase(correct ? "correct" : "incorrect");

    const choice =
      current.question.choices.find((c) => c.id === choiceId)?.text || "";

    if (correct) {
      setChat((c) => [
        ...c,
        {
          role: "ai",
          text: `✅ Correct! ${choice}\n\nNice reasoning. Press Next when you're ready to continue.`,
        },
      ]);
    } else {
      const m = current.question.misconceptions[choiceId];
      setChat((c) => [
        ...c,
        {
          role: "ai",
          text: m?.feedback
            ? `❌ ${m.feedback}`
            : "Not quite. Look at the current visual state and try to reason from it.",
        },
      ]);
    }
  }

  /* ══════════════════════════════════════════
     Hint System
     ══════════════════════════════════════════ */
  function requestHint() {
    if (!current?.question?.hints) return;
    const hints = current.question.hints;
    if (hintIndex >= hints.length) {
      setChat((c) => [
        ...c,
        { role: "ai", text: "No more hints available. Try your best!" },
      ]);
      return;
    }
    const hint = hints[hintIndex];
    setHintIndex((h) => h + 1);
    setChat((c) => [
      ...c,
      { role: "ai", text: `💡 Hint ${hintIndex + 1}: ${hint}` },
    ]);
  }

  /* ══════════════════════════════════════════
     Playback Controls
     ══════════════════════════════════════════ */
  function next() {
    if (!lesson) return;
    if (phase === "waiting_for_learner") return;
    if (step >= total - 1) return;
    const nextStep = step + 1;
    setStep(nextStep);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase(computePhase(nextStep, null));
  }

  function prev() {
    if (step <= 0) return;
    const prevStep = step - 1;
    setStep(prevStep);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase(computePhase(prevStep, null));
  }

  function restart() {
    if (!lesson) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStep(0);
    setPlaying(false);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase(computePhase(0, null));
  }

  function togglePlay() {
    if (playing) {
      setPlaying(false);
    } else if (lesson && phase !== "waiting_for_learner" && phase !== "completed") {
      setPlaying(true);
      setPhase("teaching");
    }
  }

  /* ══════════════════════════════════════════
     Mode Switching
     ══════════════════════════════════════════ */
  function switchToLearn() {
    if (mode === "learn") return;
    // Clear teach state, ensure clean learn mode
    setTeachState(initialCanvas());
    setMode("learn");
  }

  function switchToTeach() {
    if (mode === "teach") return;
    // Stop playback
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
    // Reset lesson state
    setLesson(null);
    setStep(0);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase("idle");
    // Fresh teach canvas
    setTeachState(initialCanvas());
    setMode("teach");
  }

  /* ══════════════════════════════════════════
     Teach Mode Tool Handlers
     ══════════════════════════════════════════ */
  function teachToolClick(toolId: string) {
    switch (toolId) {
      case "array":
        setTeachState((s) =>
          applyAction(s, {
            action: "create_array",
            id: "manual-array",
            values: [10, 20, 30, 40],
          })
        );
        break;
      case "variable":
        setTeachState((s) =>
          applyAction(s, {
            action: "create_variable",
            name: "max",
            value: 0,
          })
        );
        break;
      case "pointer":
        setTeachState((s) =>
          s.array
            ? applyAction(s, {
                action: "create_pointer",
                pointer: "i",
                targetIndex: 0,
              })
            : s
        );
        break;
      case "list":
        setTeachState((s) =>
          applyAction(s, {
            action: "create_linked_list",
            values: [1, 2, 3, 4],
          })
        );
        break;
      case "tree":
        setTeachState((s) =>
          applyAction(s, {
            action: "create_tree",
            nodes: [
              { id: "t50", value: 50, x: 300, y: 80, visible: true },
              { id: "t30", value: 30, x: 180, y: 170, visible: true },
              { id: "t70", value: 70, x: 420, y: 170, visible: true },
            ],
            edges: [
              ["t50", "t30"],
              ["t50", "t70"],
            ],
          })
        );
        break;
      case "loop":
        setTeachState((s) =>
          applyAction(s, {
            action: "show_message",
            text: "for (i = 0; i < n; i++) — loop created",
          })
        );
        break;
      case "pen":
        // Pen mode: clear UI decoration, excalidraw handles freehand by default
        break;
    }
  }

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */
  return (
    <div className="h-full flex flex-col bg-[#FAFAF8] text-[#232946]">
      {/* ── NAVBAR ── */}
      <header className="h-14 shrink-0 border-b border-[#E7E7E2] bg-white/90 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 min-w-[160px]">
          <div className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="font-bold tracking-tight text-[15px]">
              Smart<span className="text-[#5B5FEF]">Zero</span>
            </div>
            <div className="text-[8px] text-[#9498B3]">
              SEE IT · DO IT · UNDERSTAND IT
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-[12px]">
          <button
            onClick={switchToLearn}
            className={`px-3 py-1.5 rounded-lg font-semibold ${
              mode === "learn"
                ? "bg-[#EEF0FD] text-[#5B5FEF]"
                : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
            }`}
          >
            Learn
          </button>
          <button
            onClick={switchToTeach}
            className={`px-3 py-1.5 rounded-lg font-medium ${
              mode === "teach"
                ? "bg-[#EEF0FD] text-[#5B5FEF]"
                : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
            }`}
          >
            Teach
          </button>
          <button
            className="px-3 py-1.5 rounded-lg text-[#B8BAD0] cursor-not-allowed"
            title="Coming in V2"
          >
            Practice
          </button>
        </nav>

        <div className="flex-1" />

        <button
          onClick={() =>
            loadLesson("second-max", "🚀 Launching the flagship demo!")
          }
          className="h-9 px-3 rounded-xl bg-[#5B5FEF] text-white text-[11px] font-semibold flex items-center gap-1.5"
        >
          <Play size={13} fill="currentColor" /> Demo Mode
        </button>

        <div className="w-8 h-8 rounded-full bg-[#ECEBFF] text-[#5B5FEF] flex items-center justify-center text-[12px] font-semibold">
          S
        </div>
      </header>

      {/* ── TEACH TOOLBAR ── */}
      {mode === "teach" && (
        <div className="h-11 shrink-0 border-b border-[#E7E7E2] bg-white flex items-center px-4 gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-[#9498B3] mr-2 font-medium uppercase tracking-wide">
            Teach
          </span>
          {TEACH_TOOLS.map((t) => {
            const I = t.icon;
            return (
              <button
                key={t.id}
                title={t.label}
                onClick={() => teachToolClick(t.id)}
                className="px-2 py-1 rounded-lg border border-transparent hover:border-[#DDDDE7] hover:bg-[#F7F7F4] text-[10px] text-[#4A4E68] flex items-center gap-1.5"
              >
                <I size={13} />
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-[#9498B3]">
            <Undo2 size={13} />
            Semantic tools
          </div>
        </div>
      )}

      {/* ── MAIN 3-PANEL LAYOUT ── */}
      <div className="flex-1 min-h-0 flex">
        {/* ── LEFT: AI Teacher ── */}
        <aside className="w-[280px] shrink-0 border-r border-[#E7E7E2] bg-white/70 flex flex-col">
          <div className="px-3 py-2 border-b border-[#E7E7E2] flex items-center gap-2">
            <GraduationCap size={15} className="text-[#5B5FEF]" />
            <span className="text-[12px] font-bold">AI Teacher</span>
            <span
              className={`ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-semibold ${
                aiBusy
                  ? "bg-[#FBF6EC] text-[#A56621]"
                  : "bg-[#EAFAF3] text-[#1E8062]"
              }`}
            >
              {aiBusy ? "THINKING" : "READY"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[94%] whitespace-pre-line text-[11.5px] leading-relaxed px-3 py-2 rounded-2xl ${
                    m.role === "user"
                      ? "bg-[#232946] text-white rounded-br-md"
                      : "bg-[#F2F2EE] text-[#30344D] rounded-bl-md"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />

            {/* Suggested prompts when no lesson */}
            {!lesson && mode === "learn" && (
              <div className="pt-2">
                <div className="text-[9px] uppercase tracking-wider text-[#9498B3] font-semibold mb-2">
                  Try asking
                </div>
                <div className="space-y-1">
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => ask(p)}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl border border-[#E2E2E8] bg-white hover:border-[#5B5FEF] text-[10.5px] text-[#4A4E68]"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-[#E7E7E2]">
            <div className="flex gap-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ask(input);
                }}
                placeholder="Ask any DSA question..."
                className="flex-1 min-w-0 h-9 px-2.5 rounded-xl border border-[#DDDDE7] bg-white text-[11px] outline-none focus:border-[#5B5FEF]"
              />
              <button
                disabled={aiBusy}
                onClick={() => ask(input)}
                className="w-9 h-9 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── CENTER: Canvas ── */}
        <section className="flex-1 min-w-0 flex flex-col bg-[#F7F7F4]">
          <div className="h-10 shrink-0 border-b border-[#E7E7E2] bg-white flex items-center px-4 gap-3">
            <span className="text-[11px] font-semibold">
              Interactive Canvas
            </span>
            <span className="text-[9px] text-[#9498B3]">
              {lesson
                ? `${lesson.dataStructure} — ${lesson.title}`
                : "Semantic DSA whiteboard"}
            </span>
            {phase !== "idle" && (
              <span
                className={`ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  phase === "completed"
                    ? "bg-[#EAFAF3] text-[#1E8062]"
                    : phase === "waiting_for_learner"
                      ? "bg-[#FBF6EC] text-[#A56621]"
                      : phase === "correct"
                        ? "bg-[#EAFAF3] text-[#1E8062]"
                        : phase === "incorrect"
                          ? "bg-[#FEF0F0] text-[#B91C1C]"
                          : "bg-[#EEF0FD] text-[#5B5FEF]"
                }`}
              >
                {phase.replace(/_/g, " ")}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 relative">
            <SemanticCanvas state={canvasState} />

            {/* ── Learner Question Overlay ── */}
            {current?.question && phase !== "teaching" && (
              <div className="absolute left-4 right-4 bottom-4 max-w-2xl mx-auto bg-white border border-[#DDDDE7] rounded-2xl shadow-[0_12px_40px_rgba(35,41,70,.12)] p-4">
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-[#5B5FEF] font-bold mb-2">
                  <Lightbulb size={12} /> Your turn
                </div>
                <div className="text-[12px] font-medium mb-3">
                  {current.question.prompt}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {current.question.choices.map((c) => {
                    const isSelected = selectedAnswer === c.id;
                    const isCorrect =
                      selectedAnswer !== null &&
                      c.id === current.question!.correctId;
                    return (
                      <button
                        key={c.id}
                        disabled={answerCorrect === true}
                        onClick={() => submitAnswer(c.id)}
                        className={`text-left px-3 py-2 rounded-xl border text-[10.5px] transition-colors ${
                          isCorrect
                            ? "border-[#1E9E76] bg-[#EAFAF3] text-[#1E8062]"
                            : isSelected
                              ? "border-[#C97A2B] bg-[#FBF6EC] text-[#A56621]"
                              : "border-[#DDDDE7] hover:border-[#5B5FEF] bg-white"
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2
                            size={12}
                            className="inline mr-1"
                          />
                        ) : isSelected ? (
                          <XCircle size={12} className="inline mr-1" />
                        ) : null}
                        {c.text}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {/* Hint button */}
                  {current.question.hints &&
                    current.question.hints.length > 0 &&
                    answerCorrect !== true && (
                      <button
                        onClick={requestHint}
                        className="text-[9px] px-2 py-1 rounded-lg border border-[#DDDDE7] text-[#6B6F8A] hover:border-[#5B5FEF] hover:text-[#5B5FEF] flex items-center gap-1"
                      >
                        <HelpCircle size={11} />
                        Hint{" "}
                        {hintIndex > 0
                          ? `(${hintIndex}/${current.question.hints.length})`
                          : ""}
                      </button>
                    )}

                  {selectedAnswer && (
                    <span className="text-[9px] text-[#9498B3]">
                      {answerCorrect
                        ? "✅ Correct — press Next to continue."
                        : "Read the feedback above. You can try again or use a Hint."}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── PLAYBACK CONTROLS ── */}
          <div className="h-12 shrink-0 bg-white border-t border-[#E7E7E2] flex items-center px-4 gap-2">
            <button
              onClick={prev}
              disabled={!lesson || step === 0}
              className="p-1.5 rounded-lg hover:bg-[#F2F2EE] disabled:opacity-30"
            >
              <ArrowRight size={15} className="rotate-180" />
            </button>

            <button
              onClick={togglePlay}
              disabled={
                !lesson ||
                phase === "waiting_for_learner" ||
                phase === "completed"
              }
              className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center disabled:opacity-30"
            >
              {playing ? (
                <Pause size={14} />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
            </button>

            <button
              onClick={next}
              disabled={
                !lesson ||
                phase === "waiting_for_learner" ||
                step >= total - 1
              }
              className="p-1.5 rounded-lg hover:bg-[#F2F2EE] disabled:opacity-30"
            >
              <ArrowRight size={15} />
            </button>

            <button
              onClick={restart}
              disabled={!lesson}
              className="p-1.5 rounded-lg hover:bg-[#F2F2EE] disabled:opacity-30"
            >
              <RotateCcw size={14} />
            </button>

            <div className="h-4 w-px bg-[#E7E7E2] mx-1" />

            <span className="text-[9px] text-[#9498B3]">Speed</span>
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                  speed === s
                    ? "bg-[#232946] text-white"
                    : "hover:bg-[#F2F2EE]"
                }`}
              >
                {s}×
              </button>
            ))}

            <div className="flex-1" />

            <span className="text-[9px] text-[#9498B3]">
              {lesson ? `Step ${step + 1}/${total}` : "No lesson"}
            </span>
            {lesson && (
              <div className="w-28 h-1.5 rounded-full bg-[#E7E7E2] overflow-hidden">
                <div
                  className="h-full bg-[#5B5FEF] transition-all"
                  style={{
                    width: `${((step + 1) / total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT: Code & Explanation ── */}
        <aside className="w-[300px] shrink-0 border-l border-[#E7E7E2] bg-white flex flex-col">
          <div className="h-10 border-b border-[#E7E7E2] flex items-center px-3 gap-3 text-[11px]">
            <span className="font-bold text-[#5B5FEF] flex items-center gap-1">
              <Code2 size={13} /> Code
            </span>
            <span className="text-[#A2A4B7]">State</span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {lesson ? (
              <>
                {/* Language toggle */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#F0F0EC]">
                  <div className="text-[9px] text-[#9498B3]">Language</div>
                  <div className="flex rounded-lg overflow-hidden border border-[#DDDDE7]">
                    <button
                      onClick={() => setLanguage("javascript")}
                      className={`px-2 py-0.5 text-[9px] ${
                        language === "javascript"
                          ? "bg-[#232946] text-white"
                          : "bg-white"
                      }`}
                    >
                      JS
                    </button>
                    <button
                      onClick={() => setLanguage("cpp")}
                      className={`px-2 py-0.5 text-[9px] ${
                        language === "cpp"
                          ? "bg-[#232946] text-white"
                          : "bg-white"
                      }`}
                    >
                      C++
                    </button>
                  </div>
                </div>

                {/* Code viewer */}
                <pre className="p-2.5 text-[10px] leading-[1.8] font-mono">
                  {lesson.code[language].map((line, i) => {
                    const highlighted =
                      lesson.lineMap[language][current?.codeLine || ""] ===
                      i + 1;
                    return (
                      <div
                        key={i}
                        className={`px-2 rounded transition-colors ${
                          highlighted
                            ? "bg-[#EEF0FD] text-[#5B5FEF] font-semibold"
                            : "text-[#4A4E68]"
                        }`}
                      >
                        <span className="text-[#B8BAD0] mr-2">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {line}
                      </div>
                    );
                  })}
                </pre>

                {/* Variable state */}
                {Object.keys(canvasState.variables).length > 0 && (
                  <div className="px-3 py-2 border-t border-[#F0F0EC]">
                    <div className="text-[8px] uppercase tracking-wider text-[#9498B3] font-bold mb-1">
                      Variables
                    </div>
                    <div className="space-y-0.5">
                      {Object.entries(canvasState.variables).map(
                        ([name, val]) => (
                          <div
                            key={name}
                            className="text-[10px] font-mono text-[#1E8062]"
                          >
                            {name} = {String(val)}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-[11px] text-[#9498B3]">
                Load a lesson to see synchronized code.
              </div>
            )}
          </div>

          {/* ── Structured Explanation Panel ── */}
          {lesson && current && (
            <div className="border-t border-[#E7E7E2] p-3 space-y-2.5 max-h-[250px] overflow-y-auto">
              <div>
                <div className="text-[8px] uppercase tracking-wider text-[#5B5FEF] font-bold">
                  Current Step ({step + 1}/{total})
                </div>
                <div className="text-[11px] font-semibold text-[#232946] mt-0.5">
                  {current.codeLine ? `Phase: ${current.codeLine}` : "Step Execution"}
                </div>
              </div>

              <div>
                <div className="text-[8px] uppercase tracking-wider text-[#9498B3] font-bold">
                  Why
                </div>
                <div className="text-[11px] leading-relaxed text-[#4A4E68] mt-0.5">
                  {current.explanation}
                </div>
              </div>

              {changesInCurrentStep.length > 0 && (
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-[#1E8062] font-bold">
                    What Changed
                  </div>
                  <div className="text-[10px] font-mono text-[#1E8062] mt-0.5 space-y-0.5">
                    {changesInCurrentStep.map((c, ci) => (
                      <div key={ci}>• {c}</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[8px] uppercase tracking-wider text-[#C97A2B] font-bold">
                  What to Notice
                </div>
                <div className="text-[10.5px] leading-relaxed text-[#6B6F8A] mt-0.5">
                  {current.question
                    ? "Interactive decision point: Analyze the whiteboard and select the correct algorithmic action."
                    : current.codeLine === "found" || current.codeLine === "done" || current.codeLine === "return"
                      ? "Algorithm completed: Review the final state and complexity guarantees."
                      : "Notice how pointer and variable transitions maintain deterministic algorithmic invariants."}
                </div>
              </div>

              {canvasState.complexity && (
                <div className="pt-1 flex gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-[#F2F2EE] text-[9px] font-mono font-semibold">
                    Time {canvasState.complexity.time}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#F2F2EE] text-[9px] font-mono font-semibold">
                    Space {canvasState.complexity.space}
                  </span>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ── FOOTER ── */}
      <footer className="h-7 shrink-0 border-t border-[#E7E7E2] bg-white flex items-center justify-center gap-4 text-[8px] text-[#A2A4B7]">
        <span>SmartZero V1</span>
        <span>AI Teacher</span>
        <span>Semantic Canvas</span>
        <span>Deterministic DSA Engine</span>
        <span>Notes & Learning Tracker → V2</span>
      </footer>
    </div>
  );
}
