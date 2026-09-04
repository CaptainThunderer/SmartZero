"use client";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Link2,
  Moon,
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
  Sun,
  TreePine,
  Undo2,
  Variable,
  XCircle,
} from "lucide-react";
import SemanticCanvas from "./SemanticCanvas";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import NotesPanel from "./NotesPanel";
import { applyAction, initialCanvas, replay } from "../engine/core";
import { lessonFromId, SUPPORTED_LESSONS } from "../engine/lessons";
import { DSA_CATEGORIES } from "../engine/registry";
import { useWorkspaceStore, generateWorkspaceTitle } from "../stores/workspaceStore";
import type { Lesson, LessonPhase, CanvasState, LessonStep, ChatMessage } from "../types/dsa";

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */
const SUGGESTED_PROMPTS = [
  "Sort [8, 3, 5, 1, 9] using quick sort",
  "Explain merge sort visually",
  "Insert 65 into this BST",
  "Show BFS on this graph",
  "Reverse a linked list",
  "Compare merge sort and quicksort",
  "Explain dynamic programming",
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
  /* ── Workspace Store ── */
  const {
    activeWorkspaceId,
    theme,
    toggleTheme,
    getActiveWorkspace,
    updateActiveWorkspace,
    createWorkspace,
    switchWorkspace,
    findWorkspaceByTopic,
    toggleNotes,
  } = useWorkspaceStore();

  const activeWs = getActiveWorkspace();

  /* ── Mode ── */
  const [mode, setMode] = useState<"learn" | "teach">(activeWs.mode);

  /* ── Sidebar Minimization ── */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  /* ── Lesson Runtime ── */
  const [lesson, setLesson] = useState<Lesson | null>(activeWs.lesson);
  const [step, setStep] = useState(activeWs.step);
  const [phase, setPhase] = useState<LessonPhase>(activeWs.phase);

  /* ── Playback ── */
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(activeWs.speed);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Learner Interaction Modal State ── */
  const [draftAnswer, setDraftAnswer] = useState<string | null>(activeWs.draftAnswer);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(activeWs.selectedAnswer);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(activeWs.answerCorrect);
  const [hintIndex, setHintIndex] = useState(activeWs.hintIndex);

  /* ── AI Chat ── */
  const [chat, setChat] = useState<ChatMessage[]>(activeWs.chat);
  const [clarificationOptions, setClarificationOptions] = useState<
    { label: string; query: string }[] | null
  >(activeWs.clarificationOptions);
  const [input, setInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  /* ── Language ── */
  const [language, setLanguage] = useState<"javascript" | "cpp">(activeWs.language);

  /* ── Teach Mode ── */
  const [teachState, setTeachState] = useState<CanvasState>(activeWs.teachState);

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

  /* ── Synchronize workspace switch: load incoming workspace cleanly ── */
  const prevActiveIdRef = useRef(activeWorkspaceId);
  useEffect(() => {
    if (prevActiveIdRef.current !== activeWorkspaceId) {
      // 1. Clear any running playback timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      prevActiveIdRef.current = activeWorkspaceId;

      // 2. Load incoming workspace state
      const ws = getActiveWorkspace();
      setLesson(ws.lesson);
      setStep(ws.step);
      setPhase(ws.phase);
      setPlaying(false);
      setSpeed(ws.speed);
      setDraftAnswer(ws.draftAnswer);
      setSelectedAnswer(ws.selectedAnswer);
      setAnswerCorrect(ws.answerCorrect);
      setHintIndex(ws.hintIndex);
      setTeachState(ws.teachState);
      setChat(ws.chat);
      setClarificationOptions(ws.clarificationOptions);
      setLanguage(ws.language);
      setMode(ws.mode);
    }
  }, [activeWorkspaceId, getActiveWorkspace]);

  /* ── Synchronize changes back to the active workspace in store ── */
  useEffect(() => {
    if (prevActiveIdRef.current === activeWorkspaceId) {
      updateActiveWorkspace({
        lesson,
        step,
        phase,
        playing,
        speed,
        draftAnswer,
        selectedAnswer,
        answerCorrect,
        hintIndex,
        canvasState,
        teachState,
        chat,
        clarificationOptions,
        language,
        mode,
      });
    }
  }, [
    lesson,
    step,
    phase,
    playing,
    speed,
    draftAnswer,
    selectedAnswer,
    answerCorrect,
    hintIndex,
    canvasState,
    teachState,
    chat,
    clarificationOptions,
    language,
    mode,
    activeWorkspaceId,
    updateActiveWorkspace,
  ]);

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

  /* ══════════════════════════════════════════
     Lesson Loader & State Machine
     ══════════════════════════════════════════ */
  function computePhase(curStep: number, answerCorrectVal: boolean | null): LessonPhase {
    if (!lesson) return "idle";
    const st = lesson.steps[curStep];
    if (curStep >= total - 1 && !st?.pause) return "completed";
    if (st?.pause && answerCorrectVal === null) return "waiting_for_learner";
    if (st?.pause && answerCorrectVal === true) return "correct";
    if (st?.pause && answerCorrectVal === false) return "incorrect";
    return "teaching";
  }

  const startLesson = useCallback(
    (l: Lesson, preamble?: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setLesson(l);
      setStep(0);
      setPlaying(false);
      setDraftAnswer(null);
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setHintIndex(0);
      setMode("learn");
      setPhase("idle");

      const intro =
        preamble ||
        `**Lesson Loaded: ${l.title}**\n\n${l.objective}\n\n• **Data Structure**: ${l.dataStructure}\n• **Pattern**: ${l.pattern}\n• **Difficulty**: ${l.difficulty}\n\nPress **Play** or **Next** to walk through the algorithm step by step.`;

      setChat((c) => [...c, { role: "ai", text: intro }]);
    },
    []
  );

  function loadLesson(id: string, preamble?: string, customValues?: number[]) {
    const l = lessonFromId(id, customValues);
    if (!l) return;
    startLesson(l, preamble);
  }

  /* ══════════════════════════════════════════
     AI Question Handler with Intelligent Routing
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

      if (task.clarificationOptions) {
        setClarificationOptions(task.clarificationOptions);
      } else {
        setClarificationOptions(null);
      }

      // Check if question belongs to a different DSA topic (unrelated)
      const isUnrelatedTopic = Boolean(
        task.topicId &&
        activeWs.topicId &&
        task.topicId !== activeWs.topicId &&
        activeWs.lesson !== null
      );

      if (isUnrelatedTopic && (task.intent === "visualize" || task.intent === "explain")) {
        const existingWs = findWorkspaceByTopic(task.topicId!);
        if (existingWs) {
          // Switch to existing workspace for this topic
          switchWorkspace(existingWs.id);
          setChat((c) => [...c, { role: "user", text: q }]);
          if (task.explanation) {
            setChat((c) => [...c, { role: "ai", text: task.explanation }]);
          }
          if (task.lessonId) {
            loadLesson(task.lessonId, undefined, task.inputData);
          }
          return;
        } else {
          // Create new dedicated workspace for this topic
          const title = generateWorkspaceTitle(
            task.algorithm || task.topicId!,
            task.inputData,
            task.targetValue
          );
          const greeting =
            task.explanation ||
            `Welcome to **${title}**! Let's explore this algorithm step by step.`;
          createWorkspace(
            task.topicId!,
            title,
            task.lessonId || undefined,
            task.inputData,
            greeting
          );
          return;
        }
      }

      // Stays in current workspace
      if (task.intent === "unsupported_non_dsa") {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text:
              task.explanation ||
              "I am SmartZero, specialized in Data Structures and Algorithms. Feel free to ask about sorting, trees, graphs, dynamic programming, and more!",
          },
        ]);
      } else if (task.intent === "clarification") {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text:
              task.explanation ||
              "Which specific algorithm would you like to explore?",
          },
        ]);
      } else if (task.intent === "compare" || task.intent === "complexity") {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text:
              task.explanation ||
              `Here is the analysis for ${task.algorithm || "this topic"}.`,
          },
        ]);
      } else if (
        task.lessonId &&
        (task.intent === "visualize" || !task.explanation)
      ) {
        loadLesson(
          task.lessonId,
          `I understand the question. Building interactive visualization for ${task.algorithm || task.lessonId}.`,
          task.inputData
        );
      } else if (task.explanation) {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text: task.explanation,
          },
        ]);
        if (task.lessonId) {
          loadLesson(
            task.lessonId,
            `Interactive lesson loaded for ${task.algorithm || task.lessonId}. Use Play or Next to explore.`,
            task.inputData
          );
        }
      } else {
        setChat((c) => [
          ...c,
          {
            role: "ai",
            text: "I teach Data Structures & Algorithms across arrays, linked lists, stacks, queues, hash tables, trees, heaps, graphs, sorting, searching, recursion, and dynamic programming. Ask any question to begin!",
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
    setPlaying(false);
    setStep(0);
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

  /* ── Playback Timer ── */
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!playing || !lesson) return;

    timerRef.current = setTimeout(() => {
      const nextStep = step + 1;
      if (nextStep >= total) {
        setPlaying(false);
        setPhase("completed");
        return;
      }
      const nextStepData = lesson.steps[nextStep];
      const isPause = !!nextStepData?.pause;
      setStep(nextStep);
      setSelectedAnswer(null);
      setDraftAnswer(null);
      setAnswerCorrect(null);
      setHintIndex(0);
      if (isPause) {
        setPhase("waiting_for_learner");
        setPlaying(false);
      } else {
        setPhase(nextStep === total - 1 ? "completed" : "teaching");
        setPlaying(nextStep < total - 1);
      }
    }, 1200 / speed);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, step, lesson, speed, total]);

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

  const isDark = theme === "dark";

  return (
    <div
      className={`h-full flex flex-col select-none transition-colors duration-200 ${
        isDark ? "bg-[#12121A] text-[#F1F5F9]" : "bg-[#FAFAF8] text-[#232946]"
      }`}
    >
      {/* ── NAVBAR ── */}
      <header
        className={`h-14 shrink-0 border-b flex items-center px-4 gap-4 z-20 transition-colors duration-200 ${
          isDark
            ? "border-[#27273D] bg-[#181824]/95 text-white"
            : "border-[#E7E7E2] bg-white/95 text-[#232946]"
        }`}
      >
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
                ? isDark
                  ? "bg-[#252646] text-[#A5B4FC]"
                  : "bg-[#EEF0FD] text-[#5B5FEF]"
                : isDark
                  ? "text-[#A0A6C2] hover:bg-[#1E1E2E]"
                  : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
            }`}
          >
            Learn
          </button>
          <button
            onClick={switchToTeach}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              mode === "teach"
                ? isDark
                  ? "bg-[#252646] text-[#A5B4FC]"
                  : "bg-[#EEF0FD] text-[#5B5FEF]"
                : isDark
                  ? "text-[#A0A6C2] hover:bg-[#1E1E2E]"
                  : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
            }`}
          >
            Teach
          </button>
        </nav>

        <div className="flex-1" />

        {/* Header Controls: Theme Toggle & Start Learning */}
        <div className="flex items-center gap-2.5">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={`h-8 px-2.5 rounded-xl border flex items-center gap-1.5 text-[11.5px] font-medium transition-colors ${
              isDark
                ? "bg-[#1E1E2E] border-[#373A58] text-[#E0E7FF] hover:bg-[#282942]"
                : "bg-[#F2F2EE] border-[#E7E7E2] text-[#4A4E68] hover:bg-[#E5E5E0]"
            }`}
          >
            {isDark ? (
              <>
                <Sun size={13} className="text-[#FBBF24]" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-[#5B5FEF]" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Start Learning Flagship Lesson */}
          <button
            onClick={() =>
              loadLesson(
                "second-max",
                "Let's explore finding the second maximum element in an array using a single pass."
              )
            }
            className="h-8.5 px-3.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Sparkles size={13} />
            <span>Start Learning</span>
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
        <div
          className={`h-11 shrink-0 border-b flex items-center px-4 gap-1.5 overflow-x-auto z-10 ${
            isDark ? "bg-[#181824] border-[#27273D]" : "bg-white border-[#E7E7E2]"
          }`}
        >
          <span className="text-[10px] text-[#9498B3] mr-2 font-bold uppercase tracking-wider">
            Teach Palette
          </span>
          {TEACH_TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => teachToolClick(t.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isDark
                    ? "text-[#C7C9D9] hover:bg-[#252646] hover:text-white"
                    : "text-[#4A4E68] hover:bg-[#F2F2EE] hover:text-[#232946]"
                }`}
              >
                <Icon size={13} className="text-[#5B5FEF]" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── LEFT SIDEBAR: AI TEACHER ── */}
        {!leftCollapsed ? (
          <aside
            className={`w-80 shrink-0 border-r flex flex-col z-10 transition-colors duration-200 ${
              isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-white"
            }`}
          >
            <div
              className={`h-10 border-b flex items-center justify-between px-3.5 shrink-0 ${
                isDark ? "border-[#27273D]" : "border-[#E7E7E2]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B5FEF]">
                <GraduationCap size={15} />
                <span>AI Teacher</span>
              </div>
              <button
                onClick={toggleLeftSidebar}
                title="Collapse AI Teacher"
                aria-label="Collapse AI Teacher"
                className={`p-1 rounded-lg transition-colors ${
                  isDark ? "text-[#9498B3] hover:bg-[#252646]" : "text-[#9498B3] hover:bg-[#F2F2EE]"
                }`}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>

            {/* Chat message history */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chat.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[11.5px] leading-relaxed shadow-2xs whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#5B5FEF] text-white rounded-br-none"
                        : isDark
                          ? "bg-[#1E1E2E] border border-[#2A2D48] text-[#E2E8F0] rounded-bl-none"
                          : "bg-[#FAFAF8] border border-[#EBEBE6] text-[#232946] rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {aiBusy && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#9498B3] px-2">
                  <Sparkles size={13} className="animate-spin text-[#5B5FEF]" />
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Clarification Chips */}
            {clarificationOptions && clarificationOptions.length > 0 && (
              <div
                className={`p-2.5 border-t space-y-1.5 shrink-0 ${
                  isDark ? "border-[#27273D] bg-[#12121A]/70" : "border-[#E7E7E2] bg-[#F7F7F5]"
                }`}
              >
                <div className="text-[9px] font-bold text-[#9498B3] uppercase tracking-wider">
                  Clarification Options
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clarificationOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => ask(opt.query)}
                      className={`text-[10.5px] px-2.5 py-1 rounded-lg border transition-colors ${
                        isDark
                          ? "bg-[#1E1E2E] border-[#373A58] text-[#A5B4FC] hover:bg-[#282946] hover:border-[#6366F1]"
                          : "bg-white border-[#D6D8EA] text-[#5B5FEF] hover:bg-[#EEF0FD]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Question Pills */}
            <div
              className={`p-2.5 border-t space-y-1.5 shrink-0 ${
                isDark ? "border-[#27273D] bg-[#12121A]/50" : "border-[#E7E7E2] bg-[#FAFAF8]"
              }`}
            >
              <div className="text-[9px] font-bold text-[#9498B3] uppercase tracking-wider">
                Explore Curriculum
              </div>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_PROMPTS.slice(0, 4).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => ask(p)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                      isDark
                        ? "bg-[#181824] border-[#2A2D48] text-[#9498B3] hover:bg-[#252646] hover:text-white"
                        : "bg-white border-[#E7E7E2] text-[#6B6F8A] hover:bg-[#F2F2EE] hover:text-[#232946]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input form */}
            <div className={`p-2.5 border-t shrink-0 ${isDark ? "border-[#27273D]" : "border-[#E7E7E2]"}`}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask any DSA question..."
                  className={`flex-1 h-9 px-3 rounded-xl border text-[11.5px] outline-none transition-colors ${
                    isDark
                      ? "bg-[#12121A] border-[#2E314D] text-white placeholder-[#6C7293] focus:border-[#6366F1]"
                      : "bg-white border-[#DDDDE7] text-[#232946] placeholder-[#A2A4B7] focus:border-[#5B5FEF]"
                  }`}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || aiBusy}
                  className="w-9 h-9 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0 shadow-sm"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </aside>
        ) : (
          /* Collapsed Rail */
          <div
            className={`w-11 shrink-0 border-r flex flex-col items-center py-3 gap-4 ${
              isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-white"
            }`}
          >
            <button
              onClick={toggleLeftSidebar}
              title="Expand AI Teacher"
              aria-label="Expand AI Teacher"
              className={`p-1.5 rounded-xl transition-colors ${
                isDark ? "bg-[#252646] text-[#A5B4FC]" : "bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC]"
              }`}
            >
              <PanelLeftOpen size={16} />
            </button>
            <div
              style={{ writingMode: "vertical-rl" }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#9498B3] select-none flex items-center gap-1.5"
            >
              <GraduationCap size={12} className="-rotate-90 text-[#5B5FEF]" />
              AI Teacher
            </div>
          </div>
        )}

        {/* ── CENTER: INTERACTIVE CANVAS AREA ── */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Multi-Canvas Workspace Switcher Tabs */}
          <WorkspaceSwitcher theme={theme} />

          {/* Semantic Excalidraw Whiteboard: Exactly ONE instance mounted at any time */}
          <div className="flex-1 relative overflow-hidden">
            <SemanticCanvas key={activeWorkspaceId} state={canvasState} theme={theme} />

            {/* Learner Interaction Question Modal */}
            {isQuestionModalOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <div
                  className={`w-full max-w-lg rounded-2xl shadow-2xl border p-5 space-y-4 ${
                    isDark
                      ? "bg-[#181824] border-[#2E314D] text-[#F1F5F9]"
                      : "bg-white border-[#E7E7E2] text-[#232946]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center">
                        <HelpCircle size={16} />
                      </div>
                      <span className="text-[10.5px] uppercase tracking-wider font-bold text-[#5B5FEF]">
                        Learner Decision Point
                      </span>
                    </div>
                    {current?.question?.hints && (
                      <button
                        onClick={requestHint}
                        className={`text-[10.5px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                          isDark
                            ? "border-[#373A58] text-[#FBBF24] hover:bg-[#252646]"
                            : "border-[#DDDDE7] text-[#C97A2B] hover:bg-[#F2F2EE]"
                        }`}
                      >
                        <Lightbulb size={12} />
                        Hint ({hintIndex}/{current.question.hints.length})
                      </button>
                    )}
                  </div>

                  <p className="text-[13px] font-semibold leading-snug">
                    {current?.question?.prompt}
                  </p>

                  {/* Multiple Choice Options */}
                  <div className="space-y-2">
                    {current?.question?.choices.map((c) => {
                      const isSelected = selectedAnswer === c.id || draftAnswer === c.id;
                      const isEvaluated = selectedAnswer === c.id;
                      return (
                        <button
                          key={c.id}
                          disabled={phase === "correct"}
                          onClick={() => setDraftAnswer(c.id)}
                          className={`w-full text-left p-3 rounded-xl border text-[11.5px] transition-all flex items-start gap-2.5 ${
                            isEvaluated && answerCorrect === true
                              ? isDark
                                ? "bg-[#064E3B] border-[#059669] text-[#A7F3D0]"
                                : "bg-[#E6F4EA] border-[#1E8062] text-[#1E8062]"
                              : isEvaluated && answerCorrect === false
                                ? isDark
                                  ? "bg-[#451A03] border-[#D97706] text-[#FDE68A]"
                                  : "bg-[#FCE8E6] border-[#D93025] text-[#D93025]"
                                : isSelected
                                  ? isDark
                                    ? "bg-[#252646] border-[#6366F1] text-white"
                                    : "bg-[#EEF0FD] border-[#5B5FEF] text-[#232946]"
                                  : isDark
                                    ? "bg-[#1E1E2E] border-[#2A2D48] text-[#D1D5DB] hover:bg-[#252646]"
                                    : "bg-white border-[#DDDDE7] text-[#4A4E68] hover:bg-[#FAFAF8]"
                          }`}
                        >
                          <span className="font-bold text-[11px] uppercase mt-0.5">{c.id})</span>
                          <span className="flex-1 leading-relaxed">{c.text}</span>
                          {isEvaluated && answerCorrect === true && (
                            <CheckCircle2 size={16} className="text-[#10B981] shrink-0 mt-0.5" />
                          )}
                          {isEvaluated && answerCorrect === false && (
                            <XCircle size={16} className="text-[#EF4444] shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Banner */}
                  {selectedAnswer && (
                    <div
                      className={`p-3 rounded-xl text-[11px] leading-relaxed border ${
                        answerCorrect === true
                          ? isDark
                            ? "bg-[#064E3B]/80 border-[#059669] text-[#A7F3D0]"
                            : "bg-[#E6F4EA] border-[#1E8062] text-[#1E8062]"
                          : isDark
                            ? "bg-[#451A03]/80 border-[#D97706] text-[#FDE68A]"
                            : "bg-[#FCE8E6] border-[#D93025] text-[#A51D24]"
                      }`}
                    >
                      {answerCorrect === true ? (
                        <div>
                          <strong>Correct!</strong> Your algorithmic deduction is accurate.
                        </div>
                      ) : (
                        <div>
                          <strong>Insight:</strong>{" "}
                          {current?.question?.misconceptions[selectedAnswer]?.feedback ||
                            "Not quite. Notice how the visual state invariant behaves."}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {selectedAnswer && answerCorrect === false && (
                      <button
                        onClick={tryAgain}
                        className={`px-3.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                          isDark
                            ? "border-[#373A58] text-[#C7C9D9] hover:bg-[#252646]"
                            : "border-[#DDDDE7] text-[#4A4E68] hover:bg-[#F2F2EE]"
                        }`}
                      >
                        Try Again
                      </button>
                    )}
                    {!selectedAnswer ? (
                      <button
                        disabled={!draftAnswer}
                        onClick={checkAnswer}
                        className="px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-40 text-white text-[11.5px] font-semibold transition-colors shadow-sm"
                      >
                        Check Answer
                      </button>
                    ) : (
                      <button
                        onClick={continueLesson}
                        className="px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-[11.5px] font-semibold transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <span>Continue</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Playback & Stepper Controls Bar */}
          <div
            className={`h-11 shrink-0 border-t flex items-center justify-between px-4 z-10 select-none ${
              isDark ? "bg-[#181824] border-[#27273D]" : "bg-white border-[#E7E7E2]"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={restart}
                disabled={!lesson}
                className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  isDark
                    ? "border-[#2A2D48] text-[#A0A6C2] hover:bg-[#252646]"
                    : "border-[#DDDDE7] text-[#6B6F8A] hover:bg-[#F2F2EE]"
                }`}
                title="Restart lesson"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={prev}
                disabled={!lesson || step <= 0}
                className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  isDark
                    ? "border-[#2A2D48] text-[#A0A6C2] hover:bg-[#252646]"
                    : "border-[#DDDDE7] text-[#6B6F8A] hover:bg-[#F2F2EE]"
                }`}
                title="Previous step"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={togglePlay}
                disabled={!lesson || phase === "waiting_for_learner" || phase === "completed"}
                className="px-3 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-40 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                <span>{playing ? "Pause" : "Play"}</span>
              </button>
              <button
                onClick={next}
                disabled={!lesson || step >= total - 1 || phase === "waiting_for_learner"}
                className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  isDark
                    ? "border-[#2A2D48] text-[#A0A6C2] hover:bg-[#252646]"
                    : "border-[#DDDDE7] text-[#6B6F8A] hover:bg-[#F2F2EE]"
                }`}
                title="Next step"
              >
                <ArrowRight size={14} />
              </button>

              {/* Step indicator */}
              <span className="text-[11px] font-mono text-[#9498B3] ml-2">
                {lesson ? `Step ${step + 1} / ${total}` : "Idle"}
              </span>
            </div>

            {/* Playback speed selector */}
            <div className="flex items-center gap-1.5 text-[11px] text-[#9498B3]">
              <span className="text-[10px] uppercase font-bold tracking-wider">Speed:</span>
              {[1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                    speed === s
                      ? isDark
                        ? "bg-[#252646] text-[#A5B4FC]"
                        : "bg-[#EEF0FD] text-[#5B5FEF]"
                      : isDark
                        ? "text-[#A0A6C2] hover:bg-[#1E1E2E]"
                        : "text-[#6B6F8A] hover:bg-[#F2F2EE]"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: SYNCHRONIZED CODE & STATE ── */}
        {!rightCollapsed ? (
          <aside
            className={`w-80 shrink-0 border-l flex flex-col z-10 transition-colors duration-200 ${
              isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-white"
            }`}
          >
            <div
              className={`h-10 border-b flex items-center justify-between px-3.5 shrink-0 ${
                isDark ? "border-[#27273D]" : "border-[#E7E7E2]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B5FEF]">
                <Code2 size={15} />
                <span>Code & State</span>
              </div>
              <button
                onClick={toggleRightSidebar}
                title="Collapse Code Panel"
                aria-label="Collapse Code Panel"
                className={`p-1 rounded-lg transition-colors ${
                  isDark ? "text-[#9498B3] hover:bg-[#252646]" : "text-[#9498B3] hover:bg-[#F2F2EE]"
                }`}
              >
                <PanelRightClose size={15} />
              </button>
            </div>

            {/* Code panel body */}
            <div className="flex-1 overflow-y-auto">
              {lesson ? (
                <>
                  {/* Language switch */}
                  <div
                    className={`px-3 py-2 border-b flex items-center justify-between ${
                      isDark ? "border-[#27273D] bg-[#12121A]/50" : "border-[#F0F0EC] bg-[#FAFAF8]"
                    }`}
                  >
                    <span className="text-[9px] text-[#9498B3] font-bold uppercase tracking-wider">
                      Language
                    </span>
                    <div
                      className={`flex rounded-lg overflow-hidden border ${
                        isDark ? "border-[#2A2D48]" : "border-[#DDDDE7]"
                      }`}
                    >
                      <button
                        onClick={() => setLanguage("javascript")}
                        className={`px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                          language === "javascript"
                            ? isDark
                              ? "bg-[#5B5FEF] text-white"
                              : "bg-[#232946] text-white"
                            : isDark
                              ? "bg-[#181824] text-[#A0A6C2] hover:bg-[#252646]"
                              : "bg-white text-[#6B6F8A] hover:bg-[#F2F2EE]"
                        }`}
                      >
                        JS
                      </button>
                      <button
                        onClick={() => setLanguage("cpp")}
                        className={`px-2 py-0.5 text-[9px] font-semibold transition-colors ${
                          language === "cpp"
                            ? isDark
                              ? "bg-[#5B5FEF] text-white"
                              : "bg-[#232946] text-white"
                            : isDark
                              ? "bg-[#181824] text-[#A0A6C2] hover:bg-[#252646]"
                              : "bg-white text-[#6B6F8A] hover:bg-[#F2F2EE]"
                        }`}
                      >
                        C++
                      </button>
                    </div>
                  </div>

                  {/* Synchronized Code Viewer */}
                  <pre
                    className={`p-2.5 text-[10px] leading-[1.8] font-mono select-text ${
                      isDark ? "bg-[#12121A]" : "bg-white"
                    }`}
                  >
                    {lesson.code[language].map((line, i) => {
                      const highlighted =
                        lesson.lineMap[language][current?.codeLine || ""] ===
                        i + 1;
                      return (
                        <div
                          key={i}
                          className={`px-2 rounded transition-colors ${
                            highlighted
                              ? isDark
                                ? "bg-[#252646] text-[#A5B4FC] font-semibold border-l-2 border-[#6366F1]"
                                : "bg-[#EEF0FD] text-[#5B5FEF] font-semibold"
                              : isDark
                                ? "text-[#C7C9D9]"
                                : "text-[#4A4E68]"
                          }`}
                        >
                          <span className="text-[#6C7293] mr-2.5 select-none">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {line}
                        </div>
                      );
                    })}
                  </pre>

                  {/* Synchronized Variables Table */}
                  {Object.keys(canvasState.variables).length > 0 && (
                    <div
                      className={`px-3 py-2 border-t ${
                        isDark ? "border-[#27273D] bg-[#181824]" : "border-[#F0F0EC] bg-[#FAFAF8]"
                      }`}
                    >
                      <div className="text-[8.5px] uppercase tracking-wider text-[#9498B3] font-bold mb-1">
                        State Invariants
                      </div>
                      <div className="space-y-0.5">
                        {Object.entries(canvasState.variables).map(([name, val]) => (
                          <div
                            key={name}
                            className="text-[10.5px] font-mono text-[#10B981] flex items-center justify-between"
                          >
                            <span className={isDark ? "text-[#C7C9D9]" : "text-[#4A4E68]"}>{name}</span>
                            <span className="font-bold">{String(val)}</span>
                          </div>
                        ))}
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
              <div
                className={`border-t p-3 space-y-2 max-h-[240px] overflow-y-auto ${
                  isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-white"
                }`}
              >
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-[#5B5FEF] font-bold">
                    Current Step ({step + 1}/{total})
                  </div>
                  <div
                    className={`text-[11px] font-semibold mt-0.5 ${
                      isDark ? "text-[#F1F5F9]" : "text-[#232946]"
                    }`}
                  >
                    {current.codeLine ? `Phase: ${current.codeLine}` : "Step Execution"}
                  </div>
                </div>

                <div>
                  <div className="text-[8px] uppercase tracking-wider text-[#9498B3] font-bold">
                    Why
                  </div>
                  <div
                    className={`text-[10.5px] leading-relaxed mt-0.5 ${
                      isDark ? "text-[#C7C9D9]" : "text-[#4A4E68]"
                    }`}
                  >
                    {current.explanation}
                  </div>
                </div>

                {changesInCurrentStep.length > 0 && (
                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-[#10B981] font-bold">
                      What Changed
                    </div>
                    <div className="text-[10px] font-mono text-[#10B981] mt-0.5 space-y-0.5">
                      {changesInCurrentStep.map((c, ci) => (
                        <div key={ci}>• {c}</div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[8px] uppercase tracking-wider text-[#F59E0B] font-bold">
                    What to Notice
                  </div>
                  <div
                    className={`text-[10px] leading-relaxed mt-0.5 ${
                      isDark ? "text-[#9498B3]" : "text-[#6B6F8A]"
                    }`}
                  >
                    {current.question
                      ? "Interactive decision point: Analyze the state and select the correct algorithmic action."
                      : current.codeLine === "found" || current.codeLine === "done" || current.codeLine === "return"
                        ? "Algorithm completed: Review the final invariants and complexity guarantees."
                        : "Notice how pointer movements and state transitions preserve deterministic bounds."}
                  </div>
                </div>

                {canvasState.complexity && (
                  <div className="pt-1 flex gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-semibold ${
                        isDark ? "bg-[#252646] text-[#A5B4FC]" : "bg-[#F2F2EE] text-[#232946]"
                      }`}
                    >
                      Time: {canvasState.complexity.time}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-semibold ${
                        isDark ? "bg-[#252646] text-[#A5B4FC]" : "bg-[#F2F2EE] text-[#232946]"
                      }`}
                    >
                      Space: {canvasState.complexity.space}
                    </span>
                  </div>
                )}
              </div>
            )}
          </aside>
        ) : (
          /* Collapsed Code Rail */
          <div
            className={`w-11 shrink-0 border-l flex flex-col items-center py-3 gap-4 ${
              isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-white"
            }`}
          >
            <button
              onClick={toggleRightSidebar}
              title="Expand Code Panel"
              aria-label="Expand Code Panel"
              className={`p-1.5 rounded-xl transition-colors ${
                isDark ? "bg-[#252646] text-[#A5B4FC]" : "bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC]"
              }`}
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
      <footer
        className={`h-7 shrink-0 border-t flex items-center justify-between px-4 text-[8.5px] transition-colors duration-200 ${
          isDark ? "border-[#27273D] bg-[#181824] text-[#6C7293]" : "border-[#E7E7E2] bg-white text-[#A2A4B7]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`font-semibold ${isDark ? "text-[#A0A6C2]" : "text-[#6B6F8A]"}`}>
            SmartZero
          </span>
          <span>•</span>
          <span>AI Teacher</span>
          <span>•</span>
          <span>Interactive Canvas</span>
          <span>•</span>
          <span>Deterministic DSA Engine</span>
        </div>

        {/* Notes Button: Replaces the disabled V2 label in the exact same location */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleNotes}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[9.5px] font-semibold transition-colors ${
              isDark
                ? "bg-[#252646] text-[#A5B4FC] hover:bg-[#313360]"
                : "bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC]"
            }`}
            title="Open workspace notes"
            aria-label="Open workspace notes"
          >
            <FileText size={11} />
            <span>Notes {activeWs.notes.length > 0 ? `(${activeWs.notes.length})` : ""}</span>
          </button>
        </div>
      </footer>

      {/* Workspace-Scoped Notes Modal */}
      <NotesPanel theme={theme} />
    </div>
  );
}
