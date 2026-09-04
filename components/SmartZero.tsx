"use client";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
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
} from "lucide-react";
import SemanticCanvas from "./SemanticCanvas";
import { applyAction, initialCanvas, replay } from "../engine/core";
import { lessonFromId, SUPPORTED_LESSONS } from "../engine/lessons";
import type { Lesson, LessonPhase, CanvasState, LessonStep } from "../types/dsa";

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */
const SUGGESTED_PROMPTS = [
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

  /* ── Sidebar Minimization ── */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  /* ── Lesson Runtime ── */
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<LessonPhase>("idle");

  /* ── Playback ── */
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Learner Interaction Modal State ── */
  const [draftAnswer, setDraftAnswer] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [hintIndex, setHintIndex] = useState(0);

  /* ── AI Chat ── */
  const [chat, setChat] = useState<{ role: "ai" | "user"; text: string }[]>([
    {
      role: "ai",
      text: "Hi! I'm SmartZero, your AI-powered interactive DSA teacher. Ask any data structures or algorithms question, or pick a topic to begin.",
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

  /* ── Trigger resize event when sidebars collapse/expand ── */
  const toggleLeftSidebar = useCallback(() => {
    setLeftCollapsed((c) => !c);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightCollapsed((c) => !c);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
  }, []);

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
      else if (a.action === "dim_elements") changes.push(`eliminated ${a.indices.length} elements from search space`);
      else if (a.action === "relink") changes.push(`relink reversed up to node index ${a.reversedUpTo}`);
      else if (a.action === "compare" && a.text) changes.push(`compare: ${a.text}`);
      else if (a.action === "highlight_tree_node") changes.push(`visit tree node ${a.id}`);
      else if (a.action === "reveal_tree_node") changes.push(`insert node ${a.id}`);
    });
    return changes;
  }, [current]);

  /* ── Contextual Details for Question Modal ── */
  const questionContext = useMemo(() => {
    if (!current?.question || !lesson) return [];
    const ctx: { label: string; value: string | number }[] = [];

    if (lesson.id === "second-max" && canvasState.array) {
      const ptr = canvasState.array.pointers["i"] ?? 0;
      const val = canvasState.array.values[ptr];
      if (val !== undefined) ctx.push({ label: "Current value", value: val });
      if (canvasState.variables["max"] !== undefined) ctx.push({ label: "max", value: canvasState.variables["max"] });
      if (canvasState.variables["secondMax"] !== undefined) ctx.push({ label: "secondMax", value: canvasState.variables["secondMax"] });
      ctx.push({ label: "Pointer i", value: ptr });
    } else if (lesson.id === "binary-search") {
      if (canvasState.variables["target"] !== undefined) ctx.push({ label: "Target", value: canvasState.variables["target"] });
      if (canvasState.bounds) {
        ctx.push({ label: "mid index", value: canvasState.bounds.mid });
        if (canvasState.array) {
          const midVal = canvasState.array.values[canvasState.bounds.mid];
          if (midVal !== undefined) ctx.push({ label: "arr[mid]", value: midVal });
        }
        ctx.push({ label: "low", value: canvasState.bounds.low });
        ctx.push({ label: "high", value: canvasState.bounds.high });
      }
    } else if (lesson.id === "bst-insert" && canvasState.tree) {
      ctx.push({ label: "Inserting", value: 65 });
      if (canvasState.tree.highlightId) {
        const node = canvasState.tree.nodes.find((n) => n.id === canvasState.tree?.highlightId);
        if (node) ctx.push({ label: "Current node", value: node.value });
      }
    } else if (lesson.id === "linked-list-reverse" && canvasState.linkedList) {
      const p = canvasState.linkedList.pointers;
      if (p["curr"]) {
        const n = canvasState.linkedList.nodes.find((x) => x.id === p["curr"]);
        if (n) ctx.push({ label: "curr", value: `node ${n.value}` });
      }
      if (p["prev"] !== undefined) {
        const n = p["prev"] ? canvasState.linkedList.nodes.find((x) => x.id === p["prev"]) : null;
        ctx.push({ label: "prev", value: n ? `node ${n.value}` : "null" });
      }
      if (p["next"] !== undefined) {
        const n = p["next"] ? canvasState.linkedList.nodes.find((x) => x.id === p["next"]) : null;
        ctx.push({ label: "next", value: n ? `node ${n.value}` : "null" });
      }
    }
    return ctx;
  }, [current, lesson, canvasState]);

  /* ══════════════════════════════════════════
     Phase computation
     ══════════════════════════════════════════ */
  const computePhase = useCallback(
    (s: number, correct: boolean | null): LessonPhase => {
      if (!lesson) return "idle";
      const st = lesson.steps[s];
      if (!st) return "completed";
      if (s >= lesson.steps.length - 1 && !st.pause) return "completed";
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
          setDraftAnswer(null);
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
     LESSON LIFECYCLE — P0 Isolation
     startLesson: complete reset of all state
     ══════════════════════════════════════════ */
  function startLesson(
    l: Lesson,
    preamble = "Got it — setting up the visual lesson."
  ) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setLesson(l);
    setMode("learn");
    setTeachState(initialCanvas());
    setStep(0);
    setPlaying(false);
    setDraftAnswer(null);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase(l.steps[0]?.pause ? "waiting_for_learner" : "teaching");

    setChat((c) => [
      ...c,
      { role: "ai", text: preamble },
      {
        role: "ai",
        text: `${l.dataStructure} · ${l.pattern}\n\n${l.objective}`,
      },
      {
        role: "ai",
        text: `Lesson loaded: "${l.title}". Use Play or Next to explore step-by-step.`,
      },
    ]);
  }

  /* ══════════════════════════════════════════
     Load lesson by ID
     ══════════════════════════════════════════ */
  function loadLesson(
    id: string,
    preamble = "Setting up the visual lesson..."
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
          "I understand the question. Building the interactive visualization."
        );
      } else {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text: `I can currently teach:\n\n${SUPPORTED_LESSONS.map((l) => `• ${l.title}`).join("\n")}\n\nSelect or ask about any of these topics!`,
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
     Learner Interaction: Check Answer
     ══════════════════════════════════════════ */
  function checkAnswer() {
    if (!draftAnswer || !current?.question) return;
    const correct = draftAnswer === current.question.correctId;
    setSelectedAnswer(draftAnswer);
    setAnswerCorrect(correct);
    setPhase(correct ? "correct" : "incorrect");

    const choiceText =
      current.question.choices.find((c) => c.id === draftAnswer)?.text || "";

    if (correct) {
      setChat((c) => [
        ...c,
        {
          role: "ai",
          text: `✅ Correct! ${choiceText}\n\nGreat algorithmic intuition. Let's continue the lesson.`,
        },
      ]);
    } else {
      const m = current.question.misconceptions[draftAnswer];
      setChat((c) => [
        ...c,
        {
          role: "ai",
          text: m?.feedback
            ? `❌ ${m.feedback}\n\nReview the explanation on screen and continue when ready.`
            : "❌ Not quite. Review the visual state and try again, or continue when ready.",
        },
      ]);
    }
  }

  /* ══════════════════════════════════════════
     Learner Interaction: Try Again
     ══════════════════════════════════════════ */
  function tryAgain() {
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setDraftAnswer(null);
    setPhase("waiting_for_learner");
  }

  /* ══════════════════════════════════════════
     Learner Interaction: Continue Lesson
     ══════════════════════════════════════════ */
  function continueLesson() {
    if (!lesson) return;
    const nextStep = step + 1;
    setDraftAnswer(null);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);

    if (nextStep < total) {
      setStep(nextStep);
      setPhase(computePhase(nextStep, null));
    } else {
      setPhase("completed");
    }
  }

  /* ══════════════════════════════════════════
     Hint System (Progressive)
     ══════════════════════════════════════════ */
  function requestHint() {
    if (!current?.question?.hints) return;
    const hints = current.question.hints;
    if (hintIndex >= hints.length) {
      setChat((c) => [
        ...c,
        { role: "ai", text: "All hints revealed! Analyze the current canvas values." },
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
    setDraftAnswer(null);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase(computePhase(nextStep, null));
  }

  function prev() {
    if (step <= 0) return;
    const prevStep = step - 1;
    setStep(prevStep);
    setDraftAnswer(null);
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
    setDraftAnswer(null);
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
    setTeachState(initialCanvas());
    setMode("learn");
  }

  function switchToTeach() {
    if (mode === "teach") return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
    setLesson(null);
    setStep(0);
    setDraftAnswer(null);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setHintIndex(0);
    setPhase("idle");
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
            text: "for (i = 0; i < n; i++) — loop step",
          })
        );
        break;
      case "pen":
        break;
    }
  }

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */
  const isQuestionModalOpen = Boolean(
    current?.question &&
      (phase === "waiting_for_learner" || phase === "correct" || phase === "incorrect")
  );

  return (
    <div className="h-full flex flex-col bg-[#FAFAF8] text-[#232946] select-none">
      {/* ── NAVBAR ── */}
      <header className="h-14 shrink-0 border-b border-[#E7E7E2] bg-white/95 flex items-center px-4 gap-4 z-20">
        <div className="flex items-center gap-2.5 min-w-[170px]">
          <div className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="font-bold tracking-tight text-[15px] leading-tight">
              Smart<span className="text-[#5B5FEF]">Zero</span>
            </div>
            <div className="text-[8px] text-[#9498B3] font-medium tracking-wider uppercase">
              Interactive DSA Teacher
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-[12px]">
          <button
            onClick={switchToLearn}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              mode === "learn"
                ? "bg-[#EEF0FD] text-[#5B5FEF]"
                : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
            }`}
          >
            Learn
          </button>
          <button
            onClick={switchToTeach}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              mode === "teach"
                ? "bg-[#EEF0FD] text-[#5B5FEF]"
                : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
            }`}
          >
            Teach
          </button>
          <button
            disabled
            className="px-3 py-1.5 rounded-lg text-[#B8BAD0] cursor-not-allowed flex items-center gap-1"
            title="Coming in V2"
          >
            Practice
            <span className="text-[7.5px] px-1 py-0.2 rounded bg-[#F2F2EE] text-[#9498B3]">V2</span>
          </button>
        </nav>

        <div className="flex-1" />

        {/* Lesson quick-launcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              loadLesson(
                "second-max",
                "Let's explore finding the second maximum element in an array using a single pass."
              )
            }
            className="h-9 px-3.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Sparkles size={13} />
            Start Learning
          </button>
        </div>

        <div
          title="SmartZero Student"
          className="w-8 h-8 rounded-full bg-[#ECEBFF] text-[#5B5FEF] flex items-center justify-center text-[12px] font-bold"
        >
          SZ
        </div>
      </header>

      {/* ── TEACH TOOLBAR ── */}
      {mode === "teach" && (
        <div className="h-11 shrink-0 border-b border-[#E7E7E2] bg-white flex items-center px-4 gap-1.5 overflow-x-auto z-10">
          <span className="text-[10px] text-[#9498B3] mr-2 font-bold uppercase tracking-wider">
            Teach Palette
          </span>
          {TEACH_TOOLS.map((t) => {
            const I = t.icon;
            return (
              <button
                key={t.id}
                title={`Add ${t.label}`}
                onClick={() => teachToolClick(t.id)}
                className="px-2.5 py-1 rounded-lg border border-[#E2E2E8] hover:border-[#5B5FEF] hover:bg-[#F7F7F4] text-[10.5px] text-[#4A4E68] font-medium flex items-center gap-1.5 transition-colors"
              >
                <I size={13} className="text-[#5B5FEF]" />
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-[#9498B3]">
            <Undo2 size={13} />
            Interactive DSA Whiteboard
          </div>
        </div>
      )}

      {/* ── MAIN 3-PANEL LAYOUT (COLLAPSIBLE) ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* ── LEFT: AI Teacher Panel ── */}
        {!leftCollapsed ? (
          <aside className="w-[290px] shrink-0 border-r border-[#E7E7E2] bg-white/80 flex flex-col transition-all">
            <div className="h-11 px-3 border-b border-[#E7E7E2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className="text-[#5B5FEF]" />
                <span className="text-[12px] font-bold text-[#232946]">AI Teacher</span>
                <span
                  className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                    aiBusy
                      ? "bg-[#FBF6EC] text-[#A56621]"
                      : "bg-[#EAFAF3] text-[#1E8062]"
                  }`}
                >
                  {aiBusy ? "THINKING" : "READY"}
                </span>
              </div>
              <button
                onClick={toggleLeftSidebar}
                title="Collapse AI Teacher"
                aria-label="Collapse AI Teacher"
                className="p-1 rounded-lg hover:bg-[#F2F2EE] text-[#6B6F8A] hover:text-[#232946] transition-colors"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] whitespace-pre-line text-[11.5px] leading-relaxed px-3 py-2 rounded-2xl ${
                      m.role === "user"
                        ? "bg-[#232946] text-white rounded-br-sm"
                        : "bg-[#F2F2EE] text-[#30344D] rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />

              {/* Suggested prompts when idle */}
              {!lesson && mode === "learn" && (
                <div className="pt-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#9498B3] font-bold mb-2">
                    Explore Lessons
                  </div>
                  <div className="space-y-1.5">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => ask(p)}
                        className="w-full text-left px-2.5 py-2 rounded-xl border border-[#E2E2E8] bg-white hover:border-[#5B5FEF] hover:bg-[#FAFBFD] text-[11px] text-[#4A4E68] transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-2.5 border-t border-[#E7E7E2] bg-white">
              <div className="flex gap-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") ask(input);
                  }}
                  placeholder="Ask any DSA question..."
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-xl border border-[#DDDDE7] bg-white text-[11px] outline-none focus:border-[#5B5FEF] transition-colors"
                />
                <button
                  disabled={aiBusy}
                  onClick={() => ask(input)}
                  className="w-9 h-9 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </aside>
        ) : (
          /* Collapsed AI Rail */
          <div className="w-11 shrink-0 border-r border-[#E7E7E2] bg-white flex flex-col items-center py-3 gap-4">
            <button
              onClick={toggleLeftSidebar}
              title="Expand AI Teacher"
              aria-label="Expand AI Teacher"
              className="p-1.5 rounded-xl bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC] transition-colors"
            >
              <PanelLeftOpen size={16} />
            </button>
            <div
              style={{ writingMode: "vertical-rl" }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#9498B3] rotate-180 select-none flex items-center gap-1.5"
            >
              <GraduationCap size={12} className="rotate-90 text-[#5B5FEF]" />
              AI Teacher
            </div>
          </div>
        )}

        {/* ── CENTER: Canvas Section ── */}
        <section className="flex-1 min-w-0 flex flex-col bg-[#F7F7F4] relative">
          <div className="h-11 shrink-0 border-b border-[#E7E7E2] bg-white flex items-center px-4 gap-3 z-10">
            <span className="text-[11.5px] font-bold text-[#232946]">
              Interactive Canvas
            </span>
            <span className="text-[9.5px] text-[#9498B3]">
              {lesson
                ? `${lesson.dataStructure} — ${lesson.title}`
                : "Deterministic DSA Whiteboard"}
            </span>
            {phase !== "idle" && (
              <span
                className={`ml-auto text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
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

          {/* Canvas Viewport */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <SemanticCanvas state={canvasState} />

            {/* ── LEARNER QUESTION MODAL (FOCUSED & CONTEXTUAL) ── */}
            {isQuestionModalOpen && current?.question && (
              <div className="absolute inset-0 z-30 bg-[#232946]/35 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Learner Question"
                  className="w-full max-w-xl bg-white border border-[#DDDDE7] rounded-3xl shadow-[0_24px_60px_rgba(35,41,70,0.18)] p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 my-auto"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-[#F0F0EC] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#5B5FEF] bg-[#EEF0FD] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <Lightbulb size={12} />
                        Your Turn
                      </span>
                      <span className="text-[11px] font-semibold text-[#6B6F8A]">
                        Decision Point
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9498B3] font-medium">
                      Step {step + 1} of {total}
                    </span>
                  </div>

                  {/* Context chips */}
                  {questionContext.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-[#F7F7F4] border border-[#EAEAE6]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#9498B3] mr-1">
                        Current State:
                      </span>
                      {questionContext.map((c, ci) => (
                        <span
                          key={ci}
                          className="px-2 py-0.5 rounded-lg bg-white border border-[#E2E2E8] text-[10.5px] font-mono text-[#30344D]"
                        >
                          <span className="text-[#6B6F8A]">{c.label}:</span>{" "}
                          <span className="font-bold text-[#5B5FEF]">{String(c.value)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Question Prompt */}
                  <div className="text-[13.5px] font-semibold text-[#232946] leading-snug">
                    {current.question.prompt}
                  </div>

                  {/* Choice Selection Cards */}
                  <div className="space-y-2">
                    {current.question.choices.map((c) => {
                      const isDraft = draftAnswer === c.id;
                      const isSubmitted = selectedAnswer === c.id;
                      const isCorrectChoice = c.id === current.question!.correctId;

                      let borderClass = "border-[#E2E2E8] hover:border-[#5B5FEF] bg-white";
                      if (answerCorrect !== null) {
                        if (isCorrectChoice) {
                          borderClass = "border-[#1E9E76] bg-[#EAFAF3] text-[#1E8062]";
                        } else if (isSubmitted && !answerCorrect) {
                          borderClass = "border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]";
                        } else {
                          borderClass = "border-[#E5E7EB] bg-gray-50 opacity-60";
                        }
                      } else if (isDraft) {
                        borderClass = "border-[#5B5FEF] bg-[#EEF0FD] text-[#232946] ring-1 ring-[#5B5FEF]";
                      }

                      return (
                        <button
                          key={c.id}
                          disabled={answerCorrect !== null}
                          onClick={() => setDraftAnswer(c.id)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-[11.5px] font-medium transition-all flex items-center justify-between ${borderClass}`}
                        >
                          <span>{c.text}</span>
                          {answerCorrect !== null && isCorrectChoice && (
                            <CheckCircle2 size={15} className="text-[#1E9E76] shrink-0 ml-2" />
                          )}
                          {answerCorrect === false && isSubmitted && (
                            <XCircle size={15} className="text-[#DC2626] shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hints Box */}
                  {current.question.hints && current.question.hints.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-[#F0F0EC]">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] uppercase font-bold tracking-wider text-[#9498B3]">
                          Need Guidance?
                        </span>
                        {hintIndex < current.question.hints.length && answerCorrect !== true && (
                          <button
                            onClick={requestHint}
                            className="text-[10px] px-2.5 py-1 rounded-lg border border-[#DDDDE7] hover:border-[#5B5FEF] hover:bg-[#EEF0FD] text-[#5B5FEF] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <HelpCircle size={12} />
                            Hint {hintIndex + 1} of {current.question.hints.length}
                          </button>
                        )}
                      </div>

                      {hintIndex > 0 && (
                        <div className="space-y-1.5">
                          {current.question.hints.slice(0, hintIndex).map((h, hi) => (
                            <div
                              key={hi}
                              className="p-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[10.5px] text-[#92400E] leading-relaxed flex items-start gap-1.5"
                            >
                              <span className="font-bold shrink-0">Hint {hi + 1}:</span>
                              <span>{h}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evaluation Result Feedback */}
                  {answerCorrect === true && (
                    <div className="p-3 rounded-2xl bg-[#EAFAF3] border border-[#A7F3D0] space-y-1">
                      <div className="font-bold text-[11.5px] text-[#065F46] flex items-center gap-1.5">
                        <CheckCircle2 size={15} /> Correct reasoning!
                      </div>
                      <div className="text-[10.5px] text-[#047857] leading-relaxed">
                        Well done. State transitions have been verified against algorithmic invariants.
                      </div>
                    </div>
                  )}

                  {answerCorrect === false && selectedAnswer && (
                    <div className="p-3 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] space-y-2">
                      <div className="font-bold text-[11.5px] text-[#991B1B] flex items-center gap-1.5">
                        <XCircle size={15} /> Not quite.
                      </div>

                      {/* Structured Misconception Explanation */}
                      {current.question.misconceptions[selectedAnswer] && (
                        <div className="space-y-1.5 text-[10.5px] leading-relaxed text-[#7F1D1D]">
                          <div>
                            <span className="font-bold uppercase tracking-wider text-[8.5px] text-[#B91C1C]">
                              Why It&apos;s Wrong:
                            </span>
                            <p className="mt-0.5 font-medium">
                              {current.question.misconceptions[selectedAnswer].feedback}
                            </p>
                          </div>
                          <div>
                            <span className="font-bold uppercase tracking-wider text-[8.5px] text-[#B91C1C]">
                              Concept to Remember:
                            </span>
                            <p className="mt-0.5">
                              {current.question.misconceptions[selectedAnswer].code === "SECONDMAX_MAX_CONFUSION"
                                ? "When a new element exceeds the current maximum, the previous maximum shifts into the second maximum position."
                                : current.question.misconceptions[selectedAnswer].code === "BINARY_SEARCH_WRONG_HALF"
                                  ? "Because the array is sorted, comparing target with arr[mid] guarantees which half can be safely eliminated."
                                  : current.question.misconceptions[selectedAnswer].code === "BST_WRONG_BRANCH"
                                    ? "In a BST, values strictly less than the node proceed left, and greater values proceed right."
                                    : "Linked list reversal updates curr.next to point backward toward prev."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modal Action Controls */}
                  <div className="pt-2 flex items-center gap-2">
                    {answerCorrect === null ? (
                      <button
                        onClick={checkAnswer}
                        disabled={!draftAnswer}
                        className="w-full h-10 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-40 text-white font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        Check Answer
                      </button>
                    ) : answerCorrect === true ? (
                      <button
                        onClick={continueLesson}
                        className="w-full h-10 rounded-xl bg-[#1E9E76] hover:bg-[#15803D] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        Continue Lesson <ArrowRight size={14} />
                      </button>
                    ) : (
                      <div className="w-full flex gap-2">
                        <button
                          onClick={tryAgain}
                          className="flex-1 h-10 rounded-xl border border-[#DDDDE7] hover:bg-[#F2F2EE] text-[#4A4E68] font-semibold text-[11.5px] transition-colors"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={continueLesson}
                          className="flex-1 h-10 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-bold text-[11.5px] flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          Continue Lesson <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── PLAYBACK CONTROLS ── */}
          <div className="h-12 shrink-0 bg-white border-t border-[#E7E7E2] flex items-center px-4 gap-2 z-10">
            <button
              onClick={prev}
              disabled={!lesson || step === 0 || isQuestionModalOpen}
              title="Previous Step"
              aria-label="Previous Step"
              className="p-1.5 rounded-lg hover:bg-[#F2F2EE] disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={15} className="rotate-180" />
            </button>

            <button
              onClick={togglePlay}
              disabled={
                !lesson ||
                phase === "waiting_for_learner" ||
                phase === "completed" ||
                isQuestionModalOpen
              }
              title={playing ? "Pause" : "Play"}
              aria-label={playing ? "Pause" : "Play"}
              className="w-8 h-8 rounded-xl bg-[#5B5FEF] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[#4D51E0] transition-colors shadow-sm"
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
                step >= total - 1 ||
                isQuestionModalOpen
              }
              title="Next Step"
              aria-label="Next Step"
              className="p-1.5 rounded-lg hover:bg-[#F2F2EE] disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={15} />
            </button>

            <button
              onClick={restart}
              disabled={!lesson}
              title="Restart Lesson"
              aria-label="Restart Lesson"
              className="p-1.5 rounded-lg hover:bg-[#F2F2EE] disabled:opacity-30 transition-colors"
            >
              <RotateCcw size={14} />
            </button>

            <div className="h-4 w-px bg-[#E7E7E2] mx-1" />

            <span className="text-[9px] text-[#9498B3] font-semibold uppercase">Speed</span>
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold transition-colors ${
                  speed === s
                    ? "bg-[#232946] text-white"
                    : "hover:bg-[#F2F2EE] text-[#6B6F8A]"
                }`}
              >
                {s}×
              </button>
            ))}

            <div className="flex-1" />

            <span className="text-[9.5px] text-[#9498B3] font-mono font-medium">
              {lesson ? `Step ${step + 1} / ${total}` : "No lesson loaded"}
            </span>
            {lesson && (
              <div className="w-28 h-1.5 rounded-full bg-[#E7E7E2] overflow-hidden">
                <div
                  className="h-full bg-[#5B5FEF] transition-all duration-200"
                  style={{
                    width: `${((step + 1) / total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT: Code & State Panel ── */}
        {!rightCollapsed ? (
          <aside className="w-[305px] shrink-0 border-l border-[#E7E7E2] bg-white flex flex-col transition-all">
            <div className="h-11 border-b border-[#E7E7E2] flex items-center justify-between px-3">
              <div className="flex items-center gap-2 text-[11.5px] font-bold text-[#5B5FEF]">
                <Code2 size={15} />
                <span>Code & State</span>
              </div>
              <button
                onClick={toggleRightSidebar}
                title="Collapse Code Panel"
                aria-label="Collapse Code Panel"
                className="p-1 rounded-lg hover:bg-[#F2F2EE] text-[#6B6F8A] hover:text-[#232946] transition-colors"
              >
                <PanelRightClose size={15} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {lesson ? (
                <>
                  {/* Language Toggle */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#F0F0EC] bg-[#FAFAF8]">
                    <span className="text-[9px] text-[#9498B3] font-bold uppercase tracking-wider">
                      Language
                    </span>
                    <div className="flex rounded-lg overflow-hidden border border-[#DDDDE7]">
                      <button
                        onClick={() => setLanguage("javascript")}
                        className={`px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                          language === "javascript"
                            ? "bg-[#232946] text-white"
                            : "bg-white text-[#6B6F8A] hover:bg-[#F2F2EE]"
                        }`}
                      >
                        JS
                      </button>
                      <button
                        onClick={() => setLanguage("cpp")}
                        className={`px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                          language === "cpp"
                            ? "bg-[#232946] text-white"
                            : "bg-white text-[#6B6F8A] hover:bg-[#F2F2EE]"
                        }`}
                      >
                        C++
                      </button>
                    </div>
                  </div>

                  {/* Synchronized Code Viewer */}
                  <pre className="p-2.5 text-[10px] leading-[1.8] font-mono select-text">
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
                          <span className="text-[#B8BAD0] mr-2.5 select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {line}
                        </div>
                      );
                    })}
                  </pre>

                  {/* Synchronized Variables Table */}
                  {Object.keys(canvasState.variables).length > 0 && (
                    <div className="px-3 py-2 border-t border-[#F0F0EC] bg-[#FAFAF8]">
                      <div className="text-[8.5px] uppercase tracking-wider text-[#9498B3] font-bold mb-1">
                        State Invariants
                      </div>
                      <div className="space-y-0.5">
                        {Object.entries(canvasState.variables).map(
                          ([name, val]) => (
                            <div
                              key={name}
                              className="text-[10.5px] font-mono text-[#1E8062] flex items-center justify-between"
                            >
                              <span className="text-[#4A4E68]">{name}</span>
                              <span className="font-bold">{String(val)}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 text-[11px] text-[#9498B3] text-center mt-6">
                  Load a lesson to see synchronized code and variable state.
                </div>
              )}
            </div>

            {/* Structured Explanation Panel */}
            {lesson && current && (
              <div className="border-t border-[#E7E7E2] p-3 space-y-2 max-h-[240px] overflow-y-auto bg-white">
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
                  <div className="text-[10.5px] leading-relaxed text-[#4A4E68] mt-0.5">
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
                  <div className="text-[10px] leading-relaxed text-[#6B6F8A] mt-0.5">
                    {current.question
                      ? "Interactive decision point: Analyze the state and select the correct algorithmic action."
                      : current.codeLine === "found" || current.codeLine === "done" || current.codeLine === "return"
                        ? "Algorithm completed: Review the final invariants and complexity guarantees."
                        : "Notice how pointer movements and state transitions preserve deterministic bounds."}
                  </div>
                </div>

                {canvasState.complexity && (
                  <div className="pt-1 flex gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-[#F2F2EE] text-[9px] font-mono font-semibold text-[#232946]">
                      Time: {canvasState.complexity.time}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#F2F2EE] text-[9px] font-mono font-semibold text-[#232946]">
                      Space: {canvasState.complexity.space}
                    </span>
                  </div>
                )}
              </div>
            )}
          </aside>
        ) : (
          /* Collapsed Code Rail */
          <div className="w-11 shrink-0 border-l border-[#E7E7E2] bg-white flex flex-col items-center py-3 gap-4">
            <button
              onClick={toggleRightSidebar}
              title="Expand Code Panel"
              aria-label="Expand Code Panel"
              className="p-1.5 rounded-xl bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC] transition-colors"
            >
              <PanelRightOpen size={16} />
            </button>
            <div
              style={{ writingMode: "vertical-rl" }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#9498B3] select-none flex items-center gap-1.5"
            >
              <Code2 size={12} className="-rotate-90 text-[#5B5FEF]" />
              Code & State
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="h-7 shrink-0 border-t border-[#E7E7E2] bg-white flex items-center justify-between px-4 text-[8.5px] text-[#A2A4B7]">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[#6B6F8A]">SmartZero</span>
          <span>•</span>
          <span>AI Teacher</span>
          <span>•</span>
          <span>Interactive Canvas</span>
          <span>•</span>
          <span>Deterministic DSA Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Notes & Learning Tracker → V2</span>
        </div>
      </footer>
    </div>
  );
}
