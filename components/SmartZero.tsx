"use client";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Link2,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Pen,
  Play,
  Plus,
  Pointer,
  RotateCcw,
  Send,
  Sparkles,
  SquareFunction,
  Sun,
  Trash2,
  TreePine,
  Undo2,
  Variable,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import SemanticCanvas from "./SemanticCanvas";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import NotesPanel from "./NotesPanel";
import { applyAction, initialCanvas, replay } from "../engine/core";
import { lessonFromId, SUPPORTED_LESSONS } from "../engine/lessons";
import { useWorkspaceStore, generateWorkspaceTitle } from "../stores/workspaceStore";
import {
  FeatherlessNarrationController,
  getConciseStepNarration,
  type VoiceStatus,
} from "../lib/featherlessNarration";
import { parseTeachCommand } from "../teach/commandParser";
import { executeTeachCommand } from "../teach/commandExecutor";
import {
  buildProblemSolvingLesson,
  normalizeToProblemSpec,
  solveDSAProblem,
  parseProblemStatement,
} from "../agent/problemSolver";
import type { Lesson, LessonPhase, CanvasState, LessonStep, ChatMessage, DSLAction, SupportedLanguage } from "../types/dsa";

/* ══════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════ */

const TEACH_TOOLS = [
  { id: "array", label: "Array", icon: Layers },
  { id: "list", label: "Linked List", icon: Link2 },
  { id: "tree", label: "Tree", icon: TreePine },
  { id: "variable", label: "Variable", icon: Variable },
  { id: "pointer", label: "Pointer", icon: Pointer },
  { id: "loop", label: "Loop", icon: SquareFunction },
  { id: "pen", label: "Pen", icon: Pen },
  { id: "undo", label: "Undo", icon: Undo2 },
  { id: "clear", label: "Clear", icon: Trash2 },
] as const;

function formatWorkspaceTitle(raw: string): string {
  if (!raw) return "Canvas";
  const clean = raw.trim();
  if (clean.length <= 26) return clean;
  return clean.slice(0, 24) + "...";
}

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
    updateWorkspace,
    createWorkspace,
    switchWorkspace,
    findWorkspaceByTopic,
    toggleNotes,
    rehydrateFromStorage,
  } = useWorkspaceStore();

  /* ── Safe Client-Side Rehydration from LocalStorage ── */
  useEffect(() => {
    rehydrateFromStorage();
  }, [rehydrateFromStorage]);

  /* ── Active Workspace is the Single Source of Truth (Reactive Selector) ── */
  const activeWs = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId) || s.workspaces[0]
  );
  const {
    mode,
    lesson,
    step,
    phase,
    playing,
    speed,
    draftAnswer,
    selectedAnswer,
    answerCorrect,
    hintIndex,
    chat,
    clarificationOptions,
    language,
    teachState,
  } = activeWs;

  /* ── Sidebar Minimization & Transient UI State ── */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef<Record<string, number>>({});
  const narrationControllerRef = useRef<FeatherlessNarrationController | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");

  /* ── Featherless Audio Controller Lifecycle ── */
  useEffect(() => {
    if (!narrationControllerRef.current) {
      narrationControllerRef.current = new FeatherlessNarrationController();
    }
    return () => {
      narrationControllerRef.current?.stop();
      narrationControllerRef.current?.clearCache();
    };
  }, []);

  /* ── Stop Narration on Workspace Switch ── */
  useEffect(() => {
    narrationControllerRef.current?.stop();
    setVoiceStatus(activeWs.voiceMuted ? "muted" : "idle");
  }, [activeWorkspaceId, activeWs.voiceMuted]);

  /* ── Teach Mode UI State (Palette Dialogs) ── */
  const [activeTeachDialog, setActiveTeachDialog] = useState<
    "array" | "list" | "tree" | "variable" | "pointer" | "loop" | null
  >(null);
  const [dlgArray, setDlgArray] = useState("10, 5, 20, 8, 15");
  const [dlgList, setDlgList] = useState("1, 2, 3, 4");
  const [dlgTreeType, setDlgTreeType] = useState<"bst" | "tree">("bst");
  const [dlgTree, setDlgTree] = useState("50, 30, 70, 20, 40");
  const [dlgVarName, setDlgVarName] = useState("max");
  const [dlgVarVal, setDlgVarVal] = useState("10");
  const [dlgPtrName, setDlgPtrName] = useState("i");
  const [dlgPtrIdx, setDlgPtrIdx] = useState("0");
  const [dlgLoopText, setDlgLoopText] = useState("for (let i = 0; i < n; i++)");

  /* ── Helper Callbacks to Update Active Workspace ── */
  const setDraftAnswer = useCallback(
    (val: string | null) => {
      updateActiveWorkspace({ draftAnswer: val });
    },
    [updateActiveWorkspace]
  );

  const setSpeed = useCallback(
    (s: number) => {
      updateActiveWorkspace({ speed: s });
    },
    [updateActiveWorkspace]
  );

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      updateActiveWorkspace({ language: lang });
    },
    [updateActiveWorkspace]
  );

  /* ── Computed Canvas State ── */
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

  /* ══════════════════════════════════════════
     Lesson Loader & State Machine
     ══════════════════════════════════════════ */
  function computePhase(
    curStep: number,
    answerCorrectVal: boolean | null,
    targetLesson: Lesson | null = lesson
  ): LessonPhase {
    if (!targetLesson) return "idle";
    const totalSteps = targetLesson.steps.length;
    const st = targetLesson.steps[curStep];
    if (curStep >= totalSteps - 1 && !st?.pause) return "completed";
    if (st?.pause && answerCorrectVal === null) return "waiting_for_learner";
    if (st?.pause && answerCorrectVal === true) return "correct";
    if (st?.pause && answerCorrectVal === false) return "incorrect";
    return "teaching";
  }

  /* ── Summarize Teach State for Context ── */
  const summarizeTeachState = useCallback((state: CanvasState): string => {
    const parts: string[] = [];
    if (state.array && state.array.values.length > 0) {
      parts.push(`Array: [${state.array.values.join(", ")}]`);
      if (state.array.pointers && Object.keys(state.array.pointers).length > 0) {
        parts.push(
          `Pointers: ${Object.entries(state.array.pointers)
            .map(([pName, pIdx]) => `${pName}@${pIdx}`)
            .join(", ")}`
        );
      }
    }
    if (state.linkedList && state.linkedList.nodes.length > 0) {
      parts.push(`Linked List: ${state.linkedList.nodes.map((n) => n.value).join(" -> ")}`);
    }
    if (state.tree && state.tree.nodes.length > 0) {
      parts.push(`Tree Nodes: [${state.tree.nodes.map((n) => n.value).join(", ")}]`);
    }
    if (state.variables && Object.keys(state.variables).length > 0) {
      parts.push(`Variables: ${JSON.stringify(state.variables)}`);
    }
    if (state.stack && state.stack.items.length > 0) {
      parts.push(`Stack: [${state.stack.items.join(", ")}]`);
    }
    if (state.queue && state.queue.items.length > 0) {
      parts.push(`Queue: [${state.queue.items.join(", ")}]`);
    }
    if (state.graph && state.graph.nodes.length > 0) {
      parts.push(`Graph: ${state.graph.nodes.length} nodes, ${state.graph.edges.length} edges`);
    }
    return parts.length > 0 ? parts.join(" | ") : "Empty canvas";
  }, []);

  const startLesson = useCallback(
    (l: Lesson, preamble?: string, wsId?: string) => {
      const targetId = wsId || activeWs.id || useWorkspaceStore.getState().activeWorkspaceId;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const intro =
        preamble ||
        `**Lesson Loaded: ${l.title}**\n\n${l.objective}\n\n• **Data Structure**: ${l.dataStructure}\n• **Pattern**: ${l.pattern}\n• **Difficulty**: ${l.difficulty}\n\nPress **Play** or **Next** to walk through the algorithm step by step.`;

      updateWorkspace(targetId, (prev) => ({
        lesson: l,
        lessonId: l.id,
        topicId: l.id,
        title: formatWorkspaceTitle(l.title),
        step: 0,
        phase: "idle",
        playing: false,
        draftAnswer: null,
        selectedAnswer: null,
        answerCorrect: null,
        hintIndex: 0,
        mode: "learn",
        canvasState: replay(l.steps, 0),
        chat: [...prev.chat, { role: "ai", text: intro }],
      }));
    },
    [activeWorkspaceId, updateWorkspace]
  );

  const loadLesson = useCallback(
    (id: string, preamble?: string, customValues?: number[], wsId?: string) => {
      const l = lessonFromId(id, customValues);
      if (!l) return;
      startLesson(l, preamble, wsId);
    },
    [startLesson]
  );

  /* ══════════════════════════════════════════
     AI Question Handler with Intelligent Routing
     ══════════════════════════════════════════ */
  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    narrationControllerRef.current?.stop();
    const targetWsId = activeWorkspaceId;
    const currentSeq = (requestSeqRef.current[targetWsId] || 0) + 1;
    requestSeqRef.current[targetWsId] = currentSeq;

    updateWorkspace(targetWsId, (prev) => ({
      playing: false,
      chat: [...prev.chat, { role: "user", text: q }],
    }));
    setAiBusy(true);

    try {
      const currentWs = useWorkspaceStore
        .getState()
        .workspaces.find((w) => w.id === targetWsId);

      const contextPayload: Record<string, unknown> = {
        topicId: currentWs?.topicId || null,
        lessonId: currentWs?.lessonId || null,
        language: currentWs?.language || "javascript",
        mode: currentWs?.mode || "learn",
      };
      if (currentWs?.mode === "teach") {
        contextPayload.teachSummary = summarizeTeachState(currentWs.teachState);
      }

      const r = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          context: contextPayload,
        }),
      });

      let task: any;
      try {
        const contentType = r.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          task = await r.json();
        } else {
          const rawText = await r.text();
          throw new Error(
            `Server returned non-JSON response (${r.status}): ${rawText.slice(0, 100)}`
          );
        }
      } catch (parseErr: any) {
        throw new Error(parseErr?.message || "Failed to parse response from server.");
      }

      if (requestSeqRef.current[targetWsId] !== currentSeq) {
        return;
      }

      if (!r.ok) {
        throw new Error(task?.error || `Request failed with status ${r.status}`);
      }

      // If user is in Teach mode, do not override canvas or force switch to learn unless explicitly requested
      if (currentWs?.mode === "teach") {
        const wantsLearnMode = /\b(switch to learn|load lesson|open lesson|leave teach|learn mode)\b/i.test(q);
        if (!wantsLearnMode) {
          const explanation =
            task.explanation ||
            (task.problemPlan
              ? `${task.problemPlan.objective}\n\n${task.problemPlan.reasoning}\n\n**Complexity**: Time ${task.problemPlan.complexity.time}, Space ${task.problemPlan.complexity.space}`
              : "I have analyzed your question in the context of your current Teach canvas.");
          updateWorkspace(targetWsId, (prev) => ({
            chat: [...prev.chat, { role: "ai", text: explanation }],
            clarificationOptions: task.clarificationOptions || null,
          }));
          return;
        }
      }

      updateWorkspace(targetWsId, {
        clarificationOptions: task.clarificationOptions || null,
      });

      if (/\b(python|py)\b/i.test(q)) {
        updateWorkspace(targetWsId, { language: "python" });
      } else if (/\b(c\+\+|cpp)\b/i.test(q)) {
        updateWorkspace(targetWsId, { language: "cpp" });
      } else if (/\b(javascript|js|node)\b/i.test(q)) {
        updateWorkspace(targetWsId, { language: "javascript" });
      }

      // Stays in current target workspace
      if (task.intent === "unsupported_non_dsa") {
        updateWorkspace(targetWsId, (prev) => ({
          chat: [
            ...prev.chat,
            {
              role: "ai",
              text:
                task.explanation ||
                "I am SmartZero, specialized in Data Structures and Algorithms. Feel free to ask about sorting, trees, graphs, dynamic programming, and more!",
            },
          ],
        }));
      } else if (task.intent === "clarification") {
        updateWorkspace(targetWsId, (prev) => ({
          chat: [
            ...prev.chat,
            {
              role: "ai",
              text:
                task.explanation ||
                "Which specific algorithm would you like to explore?",
            },
          ],
        }));
      } else if (task.customLesson) {
        startLesson(task.customLesson, task.explanation, targetWsId);
      } else if (task.problemPlan) {
        const customLesson = buildProblemSolvingLesson(task.problemPlan);
        startLesson(customLesson, task.explanation, targetWsId);
      } else if (task.lessonId && lessonFromId(task.lessonId, task.inputData)) {
        const regLesson = lessonFromId(task.lessonId, task.inputData)!;
        startLesson(regLesson, task.explanation, targetWsId);
      } else if (
        task.intent === "problem_solving" ||
        task.intent === "implementation" ||
        task.intent === "visualize"
      ) {
        const spec = normalizeToProblemSpec(q);
        const parsed = parseProblemStatement(q) || {
          problemType: "generic-programming-problem",
          numbers: [1, 2, 3, 4, 5],
          storyContext: q,
          problemSpec: spec,
        };
        const plan = solveDSAProblem(q, parsed);
        const customLesson = buildProblemSolvingLesson(plan);
        startLesson(customLesson, task.explanation, targetWsId);
      } else if (task.explanation) {
        updateWorkspace(targetWsId, (prev) => ({
          chat: [
            ...prev.chat,
            {
              role: "ai",
              text: task.explanation,
            },
          ],
        }));
      } else {
        updateWorkspace(targetWsId, (prev) => ({
          chat: [
            ...prev.chat,
            {
              role: "ai",
              text: "I teach Data Structures & Algorithms across arrays, linked lists, stacks, queues, hash tables, trees, heaps, graphs, sorting, searching, recursion, and dynamic programming. Ask any question to begin!",
            },
          ],
        }));
      }
    } catch (e) {
      if (requestSeqRef.current[targetWsId] !== currentSeq) {
        return;
      }
      updateWorkspace(targetWsId, (prev) => ({
        chat: [
          ...prev.chat,
          {
            role: "ai",
            text: e instanceof Error ? e.message : "Something went wrong.",
          },
        ],
      }));
    } finally {
      if (requestSeqRef.current[targetWsId] === currentSeq) {
        setAiBusy(false);
      }
    }
  }

  /* ══════════════════════════════════════════
     Learner Interaction: Check Answer
     ══════════════════════════════════════════ */
  function checkAnswer() {
    if (!draftAnswer || !current?.question) return;
    const correct = draftAnswer === current.question.correctId;
    const choiceText =
      current.question.choices.find((c) => c.id === draftAnswer)?.text || "";

    const feedbackMsg: ChatMessage = correct
      ? {
          role: "ai",
          text: `✅ Correct! ${choiceText}\n\nGreat algorithmic intuition. Let's continue the lesson.`,
        }
      : {
          role: "ai",
          text: current.question.misconceptions[draftAnswer]?.feedback
            ? `❌ ${current.question.misconceptions[draftAnswer].feedback}\n\nReview the explanation on screen and continue when ready.`
            : "❌ Not quite. Review the visual state and try again, or continue when ready.",
        };

    updateActiveWorkspace((prev) => ({
      selectedAnswer: draftAnswer,
      answerCorrect: correct,
      phase: correct ? "correct" : "incorrect",
      chat: [...prev.chat, feedbackMsg],
    }));
  }

  /* ══════════════════════════════════════════
     Learner Interaction: Try Again
     ══════════════════════════════════════════ */
  function tryAgain() {
    updateActiveWorkspace({
      selectedAnswer: null,
      answerCorrect: null,
      draftAnswer: null,
      phase: "waiting_for_learner",
    });
  }

  /* ══════════════════════════════════════════
     Learner Interaction: Continue Lesson
     ══════════════════════════════════════════ */
  function continueLesson() {
    if (!lesson) return;
    const nextStep = step + 1;
    if (nextStep < total) {
      updateActiveWorkspace({
        step: nextStep,
        draftAnswer: null,
        selectedAnswer: null,
        answerCorrect: null,
        hintIndex: 0,
        phase: computePhase(nextStep, null, lesson),
        canvasState: replay(lesson.steps, nextStep),
      });
    } else {
      updateActiveWorkspace({
        draftAnswer: null,
        selectedAnswer: null,
        answerCorrect: null,
        hintIndex: 0,
        phase: "completed",
      });
    }
  }

  /* ══════════════════════════════════════════
     Hint System (Progressive)
     ══════════════════════════════════════════ */
  function requestHint() {
    if (!current?.question?.hints) return;
    const hints = current.question.hints;
    if (hintIndex >= hints.length) {
      updateActiveWorkspace((prev) => ({
        chat: [
          ...prev.chat,
          { role: "ai", text: "All hints revealed! Analyze the current canvas values." },
        ],
      }));
      return;
    }
    const hint = hints[hintIndex];
    updateActiveWorkspace((prev) => ({
      hintIndex: prev.hintIndex + 1,
      chat: [
        ...prev.chat,
        { role: "ai", text: `💡 Hint ${prev.hintIndex + 1}: ${hint}` },
      ],
    }));
  }

  /* ══════════════════════════════════════════
     Playback Controls
     ══════════════════════════════════════════ */
  function next() {
    narrationControllerRef.current?.stop();
    if (!lesson) return;
    if (phase === "waiting_for_learner") return;
    if (step >= total - 1) return;
    const nextStep = step + 1;
    updateActiveWorkspace({
      step: nextStep,
      draftAnswer: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      phase: computePhase(nextStep, null, lesson),
      canvasState: replay(lesson.steps, nextStep),
    });
  }

  function prev() {
    narrationControllerRef.current?.stop();
    if (!lesson || step <= 0) return;
    const prevStep = step - 1;
    updateActiveWorkspace({
      step: prevStep,
      draftAnswer: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      phase: computePhase(prevStep, null, lesson),
      canvasState: replay(lesson.steps, prevStep),
    });
  }

  function restart() {
    narrationControllerRef.current?.stop();
    narrationControllerRef.current?.resetAvailability();
    setVoiceStatus(activeWs.voiceMuted ? "muted" : "idle");
    if (!lesson) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    updateActiveWorkspace({
      playing: false,
      step: 0,
      draftAnswer: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      phase: computePhase(0, null, lesson),
      canvasState: replay(lesson.steps, 0),
    });
  }

  function togglePlay() {
    if (playing) {
      narrationControllerRef.current?.pause();
      updateActiveWorkspace({ playing: false });
      setVoiceStatus(activeWs.voiceMuted ? "muted" : "idle");
    } else if (lesson && phase !== "waiting_for_learner" && phase !== "completed") {
      narrationControllerRef.current?.resetAvailability();
      setVoiceStatus(activeWs.voiceMuted ? "muted" : "idle");
      updateActiveWorkspace({ playing: true, phase: "teaching" });
    }
  }

  function toggleVoiceMute() {
    const nextMuted = !activeWs.voiceMuted;
    updateActiveWorkspace({ voiceMuted: nextMuted });
    if (nextMuted) {
      narrationControllerRef.current?.stop();
      setVoiceStatus("muted");
    } else {
      narrationControllerRef.current?.resetAvailability();
      setVoiceStatus("idle");
    }
  }

  /* ── Playback & Voice Narration Synchronization ── */
  const voiceMuted = !!activeWs.voiceMuted;

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!playing || !lesson) {
      narrationControllerRef.current?.stop();
      setVoiceStatus(voiceMuted ? "muted" : "idle");
      return;
    }

    const currentWsId = activeWorkspaceId;
    const currentStepIndex = step;
    const stepData = lesson.steps[currentStepIndex];

    const advanceToNext = () => {
      // Guard against cross-workspace mutations
      if (useWorkspaceStore.getState().activeWorkspaceId !== currentWsId) return;

      const nextStep = currentStepIndex + 1;
      if (nextStep >= total) {
        updateActiveWorkspace({
          playing: false,
          phase: "completed",
        });
        setVoiceStatus(voiceMuted ? "muted" : "idle");
        return;
      }

      const nextStepData = lesson.steps[nextStep];
      const isPause = !!nextStepData?.pause;

      if (isPause) {
        updateActiveWorkspace({
          step: nextStep,
          selectedAnswer: null,
          draftAnswer: null,
          answerCorrect: null,
          hintIndex: 0,
          phase: "waiting_for_learner",
          playing: false,
          canvasState: replay(lesson.steps, nextStep),
        });
        setVoiceStatus(voiceMuted ? "muted" : "idle");
      } else {
        updateActiveWorkspace({
          step: nextStep,
          selectedAnswer: null,
          draftAnswer: null,
          answerCorrect: null,
          hintIndex: 0,
          phase: nextStep === total - 1 ? "completed" : "teaching",
          playing: nextStep < total - 1,
          canvasState: replay(lesson.steps, nextStep),
        });
      }
    };

    if (stepData?.pause && phase === "waiting_for_learner") {
      updateActiveWorkspace({ playing: false });
      setVoiceStatus(voiceMuted ? "muted" : "idle");
      return;
    }

    // Branch 1: Muted -> Deterministic Timer Progression
    if (voiceMuted) {
      setVoiceStatus("muted");
      timerRef.current = setTimeout(() => {
        advanceToNext();
      }, 1200 / speed);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }

    // Branch 2: Voice Narration via Featherless.ai
    const controller = narrationControllerRef.current;
    const textToSpeak = getConciseStepNarration(stepData, currentStepIndex, total, lesson.title);
    setVoiceStatus("generating");

    controller?.playStepNarration({
      text: textToSpeak,
      speed,
      onStart: () => {
        if (useWorkspaceStore.getState().activeWorkspaceId === currentWsId) {
          setVoiceStatus("speaking");
        }
      },
      onEnded: () => {
        if (useWorkspaceStore.getState().activeWorkspaceId === currentWsId) {
          setVoiceStatus("idle");
          advanceToNext();
        }
      },
      onError: () => {
        if (useWorkspaceStore.getState().activeWorkspaceId === currentWsId) {
          setVoiceStatus("unavailable");
          timerRef.current = setTimeout(() => {
            advanceToNext();
          }, 1200 / speed);
        }
      },
    });

    return () => {
      controller?.stop();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    playing,
    step,
    lesson,
    speed,
    total,
    voiceMuted,
    phase,
    activeWorkspaceId,
    updateActiveWorkspace,
  ]);

  /* ══════════════════════════════════════════
     Mode Switching
     ══════════════════════════════════════════ */
  function switchToLearn() {
    if (mode === "learn") return;
    updateActiveWorkspace({
      mode: "learn",
      teachState: initialCanvas(),
    });
  }

  function switchToTeach() {
    if (mode === "teach") return;
    narrationControllerRef.current?.stop();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    updateActiveWorkspace({
      playing: false,
      lesson: null,
      lessonId: null,
      step: 0,
      draftAnswer: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      phase: "idle",
      teachState: initialCanvas(),
      mode: "teach",
    });
  }

  /* ══════════════════════════════════════════
     Teach Mode Command & Tool Handlers
     ══════════════════════════════════════════ */
  const runTeachCommand = useCallback(
    (rawCmd: string) => {
      const trimmed = rawCmd.trim();
      if (!trimmed) return;

      const parsed = parseTeachCommand(trimmed);
      if (!parsed.success || !parsed.command) {
        return;
      }

      const currentHistory = activeWs.teachHistory || [];
      const res = executeTeachCommand(parsed.command, activeWs.teachState, currentHistory);
      if (!res.success) {
        return;
      }

      updateActiveWorkspace({
        teachState: res.newState,
        teachHistory: res.history,
      });
    },
    [activeWs.teachHistory, activeWs.teachState, updateActiveWorkspace]
  );

  function teachToolClick(toolId: string) {
    switch (toolId) {
      case "array":
        if (activeWs.teachState.array && activeWs.teachState.array.values.length > 0) {
          setDlgArray(activeWs.teachState.array.values.join(", "));
        } else {
          setDlgArray("10, 5, 20, 8, 15");
        }
        setActiveTeachDialog("array");
        break;
      case "list":
        if (activeWs.teachState.linkedList && activeWs.teachState.linkedList.nodes.length > 0) {
          setDlgList(activeWs.teachState.linkedList.nodes.map((n) => n.value).join(", "));
        } else {
          setDlgList("1, 2, 3, 4");
        }
        setActiveTeachDialog("list");
        break;
      case "tree":
        if (activeWs.teachState.tree && activeWs.teachState.tree.nodes.length > 0) {
          setDlgTree(activeWs.teachState.tree.nodes.map((n) => n.value).join(", "));
        } else {
          setDlgTree("50, 30, 70, 20, 40");
        }
        setActiveTeachDialog("tree");
        break;
      case "variable":
        setActiveTeachDialog("variable");
        break;
      case "pointer":
        setActiveTeachDialog("pointer");
        break;
      case "loop":
        setActiveTeachDialog("loop");
        break;
      case "pen":
        updateActiveWorkspace((prev) => ({
          teachState: {
            ...prev.teachState,
            message: "Pen active. Use palette tools or slash commands to structure your canvas.",
          },
        }));
        break;
      case "undo":
        runTeachCommand("/undo");
        break;
      case "clear":
        runTeachCommand("/clear");
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

      {/* ── TEACH PALETTE TOOLBAR ── */}
      {mode === "teach" && (
        <div
          className={`shrink-0 border-b z-10 ${
            isDark ? "bg-[#181824] border-[#27273D]" : "bg-white border-[#E7E7E2]"
          }`}
        >
          <div className="h-11 flex items-center px-4 gap-1.5 overflow-x-auto">
            <span className="text-[10px] text-[#9498B3] mr-2 font-bold uppercase tracking-wider shrink-0">
              Teach Palette
            </span>
            {TEACH_TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => teachToolClick(t.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors shrink-0 ${
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
                  data-testid="chat-message"
                  data-role={msg.role}
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

          {/* Bottom Controls Bar */}
          <div
            className={`h-11 shrink-0 border-t flex items-center justify-between px-4 z-10 select-none ${
              isDark ? "bg-[#181824] border-[#27273D]" : "bg-white border-[#E7E7E2]"
            }`}
          >
            {mode === "teach" ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-[11px] text-[#9498B3]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>
                    {activeWs.teachState.array
                      ? `Array (${activeWs.teachState.array.values.length})`
                      : activeWs.teachState.tree
                        ? `Tree (${activeWs.teachState.tree.nodes.length})`
                        : activeWs.teachState.linkedList
                          ? `List (${activeWs.teachState.linkedList.nodes.length})`
                          : "Interactive Canvas"}
                  </span>
                  {Object.keys(activeWs.teachState.variables).length > 0 && (
                    <>
                      <span>•</span>
                      <span>Vars: {Object.keys(activeWs.teachState.variables).join(", ")}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#9498B3]">Quick templates:</span>
                  <button
                    type="button"
                    onClick={() => runTeachCommand("/array(10,5,20,8,15)")}
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                      isDark
                        ? "border-[#2E314D] hover:bg-[#252646] text-[#A5B4FC]"
                        : "border-[#DDDDE7] hover:bg-[#F2F2EE] text-[#5B5FEF]"
                    }`}
                  >
                    /array(...)
                  </button>
                  <button
                    type="button"
                    onClick={() => runTeachCommand("/pointer(i,0)")}
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                      isDark
                        ? "border-[#2E314D] hover:bg-[#252646] text-[#A5B4FC]"
                        : "border-[#DDDDE7] hover:bg-[#F2F2EE] text-[#5B5FEF]"
                    }`}
                  >
                    /pointer(i,0)
                  </button>
                  <button
                    type="button"
                    onClick={() => runTeachCommand("/var(max=10)")}
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                      isDark
                        ? "border-[#2E314D] hover:bg-[#252646] text-[#A5B4FC]"
                        : "border-[#DDDDE7] hover:bg-[#F2F2EE] text-[#5B5FEF]"
                    }`}
                  >
                    /var(...)
                  </button>
                </div>
              </div>
            ) : (
              <>
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

                  {/* Narration Voice Mute/Unmute toggle */}
                  <button
                    onClick={toggleVoiceMute}
                    disabled={!lesson}
                    className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 flex items-center gap-1 text-[11px] font-medium ${
                      activeWs.voiceMuted
                        ? isDark
                          ? "border-[#2A2D48] text-[#9498B3] hover:bg-[#252646]"
                          : "border-[#DDDDE7] text-[#9498B3] hover:bg-[#F2F2EE]"
                        : isDark
                          ? "border-[#5B5FEF]/40 bg-[#5B5FEF]/10 text-[#A5B4FC] hover:bg-[#5B5FEF]/20"
                          : "border-[#5B5FEF]/30 bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC]"
                    }`}
                    title={
                      activeWs.voiceMuted
                        ? "Unmute AI Voice Narration"
                        : voiceStatus === "unavailable"
                          ? "Voice unavailable (fallback timer active)"
                          : "Mute AI Voice Narration"
                    }
                    aria-label={activeWs.voiceMuted ? "Unmute AI Voice" : "Mute AI Voice"}
                  >
                    {activeWs.voiceMuted ? (
                      <VolumeX size={14} className="text-[#9498B3]" />
                    ) : (
                      <Volume2 size={14} className={voiceStatus === "speaking" ? "animate-pulse text-[#5B5FEF] dark:text-[#A5B4FC]" : ""} />
                    )}
                    {voiceStatus === "unavailable" && !activeWs.voiceMuted && (
                      <span className="text-[10px] text-[#E5A83B] font-normal hidden sm:inline">Voice offline</span>
                    )}
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
              </>
            )}
          </div>

          {/* ── TEACH PALETTE INTERACTIVE DIALOG MODAL ── */}
          {activeTeachDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <div
                className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 ${
                  isDark ? "bg-[#181824] border-[#2E314D] text-[#F1F5F9]" : "bg-white border-[#E7E7E2] text-[#232946]"
                }`}
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-[13px] font-bold">
                    {activeTeachDialog === "array" && "Array Configuration"}
                    {activeTeachDialog === "list" && "Linked List Configuration"}
                    {activeTeachDialog === "tree" && "Tree / BST Configuration"}
                    {activeTeachDialog === "variable" && "Declare / Update Variable"}
                    {activeTeachDialog === "pointer" && "Attach Pointer"}
                    {activeTeachDialog === "loop" && "Annotate Loop"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTeachDialog(null)}
                    className="p-1 rounded-lg hover:opacity-75 text-[#9498B3]"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Array Dialog */}
                {activeTeachDialog === "array" && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-medium block">
                      Elements (comma-separated):
                      <input
                        type="text"
                        value={dlgArray}
                        onChange={(e) => setDlgArray(e.target.value)}
                        placeholder="e.g. 10, 5, 20, 8, 15"
                        className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                          isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                        }`}
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTeachDialog(null)}
                        className="px-3 py-1.5 rounded-lg border text-[11px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          runTeachCommand(`/array(${dlgArray})`);
                          setActiveTeachDialog(null);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] text-white text-[11px] font-medium"
                      >
                        Apply Array
                      </button>
                    </div>
                  </div>
                )}

                {/* Linked List Dialog */}
                {activeTeachDialog === "list" && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-medium block">
                      Node Values (comma-separated):
                      <input
                        type="text"
                        value={dlgList}
                        onChange={(e) => setDlgList(e.target.value)}
                        placeholder="e.g. 1, 2, 3, 4"
                        className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                          isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                        }`}
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTeachDialog(null)}
                        className="px-3 py-1.5 rounded-lg border text-[11px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          runTeachCommand(`/list(${dlgList})`);
                          setActiveTeachDialog(null);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] text-white text-[11px] font-medium"
                      >
                        Create List
                      </button>
                    </div>
                  </div>
                )}

                {/* Tree Dialog */}
                {activeTeachDialog === "tree" && (
                  <div className="space-y-3">
                    <div className="flex gap-4 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="treeType"
                          checked={dlgTreeType === "bst"}
                          onChange={() => setDlgTreeType("bst")}
                        />
                        <span>Binary Search Tree (BST)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="treeType"
                          checked={dlgTreeType === "tree"}
                          onChange={() => setDlgTreeType("tree")}
                        />
                        <span>General Tree</span>
                      </label>
                    </div>
                    <label className="text-[11px] font-medium block">
                      Node Values (comma-separated):
                      <input
                        type="text"
                        value={dlgTree}
                        onChange={(e) => setDlgTree(e.target.value)}
                        placeholder="e.g. 50, 30, 70, 20, 40"
                        className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                          isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                        }`}
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTeachDialog(null)}
                        className="px-3 py-1.5 rounded-lg border text-[11px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          runTeachCommand(`/${dlgTreeType}(${dlgTree})`);
                          setActiveTeachDialog(null);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] text-white text-[11px] font-medium"
                      >
                        Create Tree
                      </button>
                    </div>
                  </div>
                )}

                {/* Variable Dialog */}
                {activeTeachDialog === "variable" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-medium block">
                        Variable Name:
                        <input
                          type="text"
                          value={dlgVarName}
                          onChange={(e) => setDlgVarName(e.target.value)}
                          placeholder="e.g. max"
                          className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                            isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                          }`}
                        />
                      </label>
                      <label className="text-[11px] font-medium block">
                        Value:
                        <input
                          type="text"
                          value={dlgVarVal}
                          onChange={(e) => setDlgVarVal(e.target.value)}
                          placeholder="e.g. 10"
                          className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                            isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                          }`}
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTeachDialog(null)}
                        className="px-3 py-1.5 rounded-lg border text-[11px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          runTeachCommand(`/var(${dlgVarName}=${dlgVarVal})`);
                          setActiveTeachDialog(null);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] text-white text-[11px] font-medium"
                      >
                        Set Variable
                      </button>
                    </div>
                  </div>
                )}

                {/* Pointer Dialog */}
                {activeTeachDialog === "pointer" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-medium block">
                        Pointer Name:
                        <input
                          type="text"
                          value={dlgPtrName}
                          onChange={(e) => setDlgPtrName(e.target.value)}
                          placeholder="e.g. i"
                          className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                            isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                          }`}
                        />
                      </label>
                      <label className="text-[11px] font-medium block">
                        Target Index:
                        <input
                          type="number"
                          value={dlgPtrIdx}
                          onChange={(e) => setDlgPtrIdx(e.target.value)}
                          placeholder="e.g. 0"
                          className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                            isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                          }`}
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTeachDialog(null)}
                        className="px-3 py-1.5 rounded-lg border text-[11px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          runTeachCommand(`/pointer(${dlgPtrName},${dlgPtrIdx})`);
                          setActiveTeachDialog(null);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] text-white text-[11px] font-medium"
                      >
                        Attach Pointer
                      </button>
                    </div>
                  </div>
                )}

                {/* Loop Dialog */}
                {activeTeachDialog === "loop" && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-medium block">
                      Loop Annotation:
                      <input
                        type="text"
                        value={dlgLoopText}
                        onChange={(e) => setDlgLoopText(e.target.value)}
                        placeholder="e.g. for (let i = 0; i < n; i++)"
                        className={`mt-1 w-full h-8 px-3 rounded-lg border text-[11.5px] font-mono outline-none ${
                          isDark ? "bg-[#12121A] border-[#2E314D] text-white" : "bg-white border-[#DDDDE7] text-[#232946]"
                        }`}
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTeachDialog(null)}
                        className="px-3 py-1.5 rounded-lg border text-[11px] font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateActiveWorkspace((prev) => ({
                            teachState: {
                              ...prev.teachState,
                              message: dlgLoopText,
                            },
                          }));
                          setActiveTeachDialog(null);
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#5B5FEF] text-white text-[11px] font-medium"
                      >
                        Set Loop
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT SIDEBAR: SYNCHRONIZED CODE & STATE ── */}
        {!rightCollapsed ? (
          <aside
            className={`w-[380px] shrink-0 border-l flex flex-col z-10 transition-colors duration-200 ${
              isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-white"
            }`}
          >
            {/* Header: CODE & STATE [Notes] [Collapse] */}
            <div
              className={`h-11 border-b flex items-center justify-between px-3.5 shrink-0 ${
                isDark ? "border-[#27273D]" : "border-[#E7E7E2]"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#5B5FEF]">
                <Code2 size={16} />
                <span>Code & State</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleNotes}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    isDark
                      ? "bg-[#252646] text-[#A5B4FC] hover:bg-[#313360]"
                      : "bg-[#EEF0FD] text-[#5B5FEF] hover:bg-[#E0E4FC]"
                  }`}
                  title="Open workspace notes"
                  aria-label="Open workspace notes"
                >
                  <FileText size={13} />
                  <span>Notes{activeWs.notes.length > 0 ? ` (${activeWs.notes.length})` : ""}</span>
                </button>
                <button
                  onClick={toggleRightSidebar}
                  title="Collapse Code Panel"
                  aria-label="Collapse Code Panel"
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? "text-[#9498B3] hover:bg-[#252646]" : "text-[#9498B3] hover:bg-[#F2F2EE]"
                  }`}
                >
                  <PanelRightClose size={16} />
                </button>
              </div>
            </div>

            {/* UPPER SECTION: Synchronized Code Viewer (independent scroll container) */}
            {lesson ? (
              <div className="shrink-0 flex flex-col border-b border-inherit">
                {/* Language switch */}
                <div
                  className={`px-3.5 py-2 border-b flex items-center justify-between shrink-0 ${
                    isDark ? "border-[#27273D] bg-[#12121A]/60" : "border-[#F0F0EC] bg-[#FAFAF8]"
                  }`}
                >
                  <span className="text-[10px] text-[#9498B3] font-bold uppercase tracking-wider">
                    Language
                  </span>
                  <div
                    className={`flex rounded-lg overflow-hidden border ${
                      isDark ? "border-[#2A2D48]" : "border-[#DDDDE7]"
                    }`}
                  >
                    <button
                      onClick={() => setLanguage("javascript")}
                      className={`px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
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
                      className={`px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
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
                    <button
                      onClick={() => setLanguage("python")}
                      className={`px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                        language === "python"
                          ? isDark
                            ? "bg-[#5B5FEF] text-white"
                            : "bg-[#232946] text-white"
                          : isDark
                            ? "bg-[#181824] text-[#A0A6C2] hover:bg-[#252646]"
                            : "bg-white text-[#6B6F8A] hover:bg-[#F2F2EE]"
                      }`}
                    >
                      Python
                    </button>
                  </div>
                </div>

                {/* Synchronized Code pre */}
                <div className="max-h-[38vh] min-h-[140px] overflow-y-auto">
                  <pre
                    className={`p-3 text-[13px] leading-[1.7] font-mono select-text ${
                      isDark ? "bg-[#12121A]" : "bg-white"
                    }`}
                  >
                    {((lesson.code && lesson.code[language]) || lesson.code.javascript || []).map((line, i) => {
                      const lineMapping = (lesson.lineMap && lesson.lineMap[language]) || lesson.lineMap.javascript || {};
                      const highlighted =
                        lineMapping[current?.codeLine || ""] === i + 1;
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
                          <span className="text-[#6C7293] mr-2.5 select-none text-[11px]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {line}
                        </div>
                      );
                    })}
                  </pre>
                </div>

                {/* Synchronized Variables / State Invariants */}
                {Object.keys(canvasState.variables).length > 0 && (
                  <div
                    className={`px-3.5 py-2 border-t ${
                      isDark ? "border-[#27273D] bg-[#181824]" : "border-[#F0F0EC] bg-[#FAFAF8]"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[#9498B3] font-bold mb-1">
                      State Invariants
                    </div>
                    <div className="space-y-1">
                      {Object.entries(canvasState.variables).map(([name, val]) => (
                        <div
                          key={name}
                          className="text-[12.5px] font-mono text-[#10B981] flex items-center justify-between"
                        >
                          <span className={isDark ? "text-[#C7C9D9]" : "text-[#4A4E68]"}>{name}</span>
                          <span className="font-bold">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-[13px] text-[#9498B3] text-center border-b border-inherit py-6">
                {mode === "teach"
                  ? "No synchronized lesson code."
                  : "Load a lesson to see synchronized code and variable state."}
              </div>
            )}

            {/* Display teach mode variables if present and no lesson */}
            {!lesson && mode === "teach" && Object.keys(canvasState.variables).length > 0 && (
              <div
                className={`px-3.5 py-2 border-b shrink-0 ${
                  isDark ? "border-[#27273D] bg-[#181824]" : "border-[#F0F0EC] bg-[#FAFAF8]"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-[#9498B3] font-bold mb-1">
                  Teach Variables
                </div>
                <div className="space-y-1">
                  {Object.entries(canvasState.variables).map(([name, val]) => (
                    <div
                      key={name}
                      className="text-[12.5px] font-mono text-[#10B981] flex items-center justify-between"
                    >
                      <span className={isDark ? "text-[#C7C9D9]" : "text-[#4A4E68]"}>{name}</span>
                      <span className="font-bold">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LOWER SECTION: Structured Teaching Explanation / State Inspector (independent scroll) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {lesson && current ? (
                <>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#5B5FEF] font-bold">
                      Current Step ({step + 1}/{total})
                    </div>
                    <div
                      className={`text-[16px] font-bold mt-1 ${
                        isDark ? "text-[#F1F5F9]" : "text-[#232946]"
                      }`}
                    >
                      {current.narrative?.currentStep || (current.codeLine ? `Phase: ${current.codeLine}` : "Step Execution")}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#9498B3] font-bold">
                      Why
                    </div>
                    <div
                      className={`text-[14px] leading-relaxed mt-1 ${
                        isDark ? "text-[#C7C9D9]" : "text-[#4A4E68]"
                      }`}
                    >
                      {current.narrative?.why || current.explanation}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#10B981] font-bold">
                      What Changed
                    </div>
                    <div className="text-[13.5px] text-[#10B981] mt-1 leading-relaxed">
                      {current.narrative?.whatChanged || (
                        changesInCurrentStep.length > 0 ? (
                          <div className="space-y-1">
                            {changesInCurrentStep.map((c, ci) => (
                              <div key={ci}>• {c}</div>
                            ))}
                          </div>
                        ) : (
                          "Pointer moved or state examined."
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[#F59E0B] font-bold">
                      What to Notice
                    </div>
                    <div
                      className={`text-[13.5px] leading-relaxed mt-1 ${
                        isDark ? "text-[#9498B3]" : "text-[#6B6F8A]"
                      }`}
                    >
                      {current.narrative?.whatToNotice || (
                        current.question
                          ? "Interactive decision point: Analyze the state and select the correct algorithmic action."
                          : current.codeLine === "found" || current.codeLine === "done" || current.codeLine === "return"
                            ? "Algorithm completed: Review the final invariants and complexity guarantees."
                            : "Notice how pointer movements and state transitions preserve deterministic bounds."
                      )}
                    </div>
                  </div>

                  {current.narrative?.keyInsight && (
                    <div className="p-3.5 rounded-xl bg-[#5B5FEF]/10 border border-[#5B5FEF]/20">
                      <div className="text-[10px] uppercase tracking-wider text-[#5B5FEF] font-bold">
                        Key Insight
                      </div>
                      <div className={`text-[13.5px] leading-relaxed mt-1 font-medium ${isDark ? "text-[#E0E7FF]" : "text-[#3730A3]"}`}>
                        {current.narrative.keyInsight}
                      </div>
                    </div>
                  )}

                  {current.narrative?.nextStep && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-[#9498B3] font-bold">
                        Next Step
                      </div>
                      <div className={`text-[13.5px] mt-1 ${isDark ? "text-[#9498B3]" : "text-[#6B6F8A]"}`}>
                        {current.narrative.nextStep}
                      </div>
                    </div>
                  )}

                  {canvasState.complexity && (
                    <div className="pt-2 flex gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold ${
                          isDark ? "bg-[#252646] text-[#A5B4FC]" : "bg-[#F2F2EE] text-[#232946]"
                        }`}
                      >
                        Time: {canvasState.complexity.time}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold ${
                          isDark ? "bg-[#252646] text-[#A5B4FC]" : "bg-[#F2F2EE] text-[#232946]"
                        }`}
                      >
                        Space: {canvasState.complexity.space}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#9498B3] text-center p-4">
                  <BookOpen size={28} className="mb-2 opacity-50 text-[#5B5FEF]" />
                  <div className="text-[13px] font-semibold">Inspector Ready</div>
                  <div className="text-[11.5px] mt-1 opacity-70">
                    Step explanations and runtime insights will appear here when a lesson is active.
                  </div>
                </div>
              )}
            </div>
          </aside>
        ) : (
          /* Collapsed Code Rail */
          <div
            className={`w-11 shrink-0 border-l flex flex-col items-center py-3 gap-3 ${
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
            <button
              onClick={toggleNotes}
              title="Open workspace notes"
              aria-label="Open workspace notes"
              className={`p-1.5 rounded-xl transition-colors relative ${
                isDark ? "text-[#A5B4FC] hover:bg-[#252646]" : "text-[#5B5FEF] hover:bg-[#EEF0FD]"
              }`}
            >
              <FileText size={16} />
              {activeWs.notes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#5B5FEF] text-white text-[9px] flex items-center justify-center font-bold">
                  {activeWs.notes.length}
                </span>
              )}
            </button>
            <div
              style={{ writingMode: "vertical-rl" }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#9498B3] select-none flex items-center gap-1.5 mt-2"
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
      </footer>

      {/* Workspace-Scoped Notes Modal */}
      <NotesPanel theme={theme} />
    </div>
  );
}
