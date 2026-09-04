import { create } from "zustand";
import type { Lesson, LessonPhase, CanvasState } from "../types/dsa";
import { initialCanvas, replay } from "../engine/core";

interface LessonStore {
  /* ── Lesson Data ── */
  lesson: Lesson | null;
  step: number;
  phase: LessonPhase;

  /* ── Playback ── */
  playing: boolean;
  speed: number;
  timerId: ReturnType<typeof setTimeout> | null;

  /* ── Learner Interaction ── */
  selectedAnswer: string | null;
  answerCorrect: boolean | null;
  hintIndex: number;

  /* ── Canvas ── */
  canvasState: CanvasState;

  /* ── Language ── */
  language: "javascript" | "cpp";

  /* ── Actions ── */
  startLesson: (lesson: Lesson) => void;
  setStep: (step: number) => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  submitAnswer: (choiceId: string) => { correct: boolean; feedback: string };
  requestHint: () => string | null;
  setLanguage: (lang: "javascript" | "cpp") => void;
  tick: () => void;
  cleanup: () => void;
}

function computeCanvas(lesson: Lesson | null, step: number): CanvasState {
  if (!lesson) return initialCanvas();
  return replay(lesson.steps, step);
}

function computePhase(
  lesson: Lesson | null,
  step: number,
  answerCorrect: boolean | null
): LessonPhase {
  if (!lesson) return "idle";
  const current = lesson.steps[step];
  if (step >= lesson.steps.length - 1 && !current?.pause) return "completed";
  if (current?.pause && answerCorrect === null) return "waiting_for_learner";
  if (current?.pause && answerCorrect === true) return "correct";
  if (current?.pause && answerCorrect === false) return "incorrect";
  return "teaching";
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  lesson: null,
  step: 0,
  phase: "idle",
  playing: false,
  speed: 1,
  timerId: null,
  selectedAnswer: null,
  answerCorrect: null,
  hintIndex: 0,
  canvasState: initialCanvas(),
  language: "javascript",

  startLesson: (lesson: Lesson) => {
    const state = get();
    // Stop any active playback timer
    if (state.timerId) clearTimeout(state.timerId);

    const canvas = computeCanvas(lesson, 0);
    set({
      lesson,
      step: 0,
      phase: computePhase(lesson, 0, null),
      playing: false,
      timerId: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      canvasState: canvas,
    });
  },

  setStep: (step: number) => {
    const { lesson } = get();
    if (!lesson) return;
    const clamped = Math.max(0, Math.min(step, lesson.steps.length - 1));
    const canvas = computeCanvas(lesson, clamped);
    set({
      step: clamped,
      canvasState: canvas,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      phase: computePhase(lesson, clamped, null),
    });
  },

  next: () => {
    const { lesson, step, phase } = get();
    if (!lesson) return;
    if (phase === "waiting_for_learner") return; // Must answer first
    if (step >= lesson.steps.length - 1) return;
    get().setStep(step + 1);
  },

  prev: () => {
    const { step } = get();
    if (step <= 0) return;
    get().setStep(step - 1);
  },

  restart: () => {
    const { lesson, timerId } = get();
    if (!lesson) return;
    if (timerId) clearTimeout(timerId);
    const canvas = computeCanvas(lesson, 0);
    set({
      step: 0,
      playing: false,
      timerId: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      canvasState: canvas,
      phase: computePhase(lesson, 0, null),
    });
  },

  play: () => {
    const { lesson, phase } = get();
    if (!lesson) return;
    if (phase === "completed" || phase === "waiting_for_learner") return;
    set({ playing: true });
  },

  pause: () => {
    const { timerId } = get();
    if (timerId) clearTimeout(timerId);
    set({ playing: false, timerId: null });
  },

  togglePlay: () => {
    const { playing } = get();
    if (playing) get().pause();
    else get().play();
  },

  setSpeed: (speed: number) => set({ speed }),

  tick: () => {
    const state = get();
    if (!state.playing || !state.lesson) return;
    const nextStep = state.step + 1;
    if (nextStep >= state.lesson.steps.length) {
      // Lesson complete
      if (state.timerId) clearTimeout(state.timerId);
      set({ playing: false, timerId: null, phase: "completed" });
      return;
    }
    const nextStepData = state.lesson.steps[nextStep];
    const canvas = computeCanvas(state.lesson, nextStep);
    const isPause = !!nextStepData?.pause;
    set({
      step: nextStep,
      canvasState: canvas,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      phase: isPause ? "waiting_for_learner" : "teaching",
      playing: !isPause && nextStep < state.lesson.steps.length - 1,
      timerId: null,
    });
    // If we reached completion
    if (nextStep >= state.lesson.steps.length - 1) {
      set({ playing: false, phase: "completed" });
    }
  },

  submitAnswer: (choiceId: string) => {
    const { lesson, step } = get();
    if (!lesson) return { correct: false, feedback: "No lesson loaded." };
    const question = lesson.steps[step]?.question;
    if (!question) return { correct: false, feedback: "No question at this step." };

    const correct = choiceId === question.correctId;
    const misconception = question.misconceptions[choiceId];
    const feedback = correct
      ? "Correct! Well done. Press Next to continue."
      : misconception?.feedback ?? "Not quite. Look at the current visual state and try to reason from it.";

    set({
      selectedAnswer: choiceId,
      answerCorrect: correct,
      phase: correct ? "correct" : "incorrect",
    });

    return { correct, feedback };
  },

  requestHint: () => {
    const { lesson, step, hintIndex } = get();
    if (!lesson) return null;
    const question = lesson.steps[step]?.question;
    if (!question || !question.hints || hintIndex >= question.hints.length) return null;
    const hint = question.hints[hintIndex];
    set({ hintIndex: hintIndex + 1 });
    return hint;
  },

  setLanguage: (lang) => set({ language: lang }),

  cleanup: () => {
    const { timerId } = get();
    if (timerId) clearTimeout(timerId);
    set({ timerId: null, playing: false });
  },
}));
