import { create } from "zustand";
import type {
  LearningWorkspace,
  WorkspaceNote,
  ChatMessage,
  AppTheme,
  Lesson,
  LessonPhase,
  CanvasState,
} from "../types/dsa";
import { initialCanvas, replay } from "../engine/core";
import { lessonFromId } from "../engine/lessons";
import { DSA_TOPIC_REGISTRY } from "../engine/registry";

/* ══════════════════════════════════════════════
   Storage Keys (Versioned)
   ══════════════════════════════════════════════ */
const STORAGE_WORKSPACES_KEY = "smartzero_workspaces_v1";
const STORAGE_ACTIVE_ID_KEY = "smartzero_active_workspace_v1";
const STORAGE_THEME_KEY = "smartzero_theme_v1";

/* ══════════════════════════════════════════════
   Helpers: Serialization & LocalStorage
   ══════════════════════════════════════════════ */
function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function persistWorkspaces(workspaces: LearningWorkspace[], activeId: string) {
  try {
    const storage = getStorage();
    if (!storage) return;
    // Strip non-serializable fields (timers, etc.)
    const cleanWorkspaces = workspaces.map((ws) => ({
      ...ws,
      playing: false, // Inactive / persisted workspaces never persist as running
    }));
    storage.setItem(STORAGE_WORKSPACES_KEY, JSON.stringify(cleanWorkspaces));
    storage.setItem(STORAGE_ACTIVE_ID_KEY, activeId);
  } catch (err) {
    console.warn("Failed to persist SmartZero workspaces to localStorage:", err);
  }
}

function persistTheme(theme: AppTheme) {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(STORAGE_THEME_KEY, theme);
    if (typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    }
  } catch (err) {
    console.warn("Failed to persist SmartZero theme:", err);
  }
}

export function generateWorkspaceTitle(
  topicName?: string,
  customData?: number[],
  targetVal?: number | string
): string {
  if (!topicName) return "New Learning Space";
  if (customData && customData.length > 0) {
    const preview = customData.slice(0, 5).join(", ") + (customData.length > 5 ? "..." : "");
    return `${topicName} — [${preview}]`;
  }
  if (targetVal !== undefined && targetVal !== null) {
    return `${topicName} — Target ${targetVal}`;
  }
  return topicName;
}

export function createInitialWorkspace(
  id?: string,
  topicId?: string,
  title?: string,
  lessonId?: string,
  inputData?: number[],
  initialGreeting?: string
): LearningWorkspace {
  const wsId = id || `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const effectiveLessonId = lessonId || (topicId ? topicId : "second-max");
  const effectiveTopicId = topicId || (effectiveLessonId ? effectiveLessonId : "second-max");

  // Lookup topic info
  const topicMeta = effectiveTopicId ? DSA_TOPIC_REGISTRY[effectiveTopicId] : null;
  const computedTitle =
    title ||
    generateWorkspaceTitle(
      topicMeta?.name || "Second Maximum Element",
      inputData,
      undefined
    );

  const lesson: Lesson | null = effectiveLessonId
    ? lessonFromId(effectiveLessonId, inputData)
    : null;

  const canvasState: CanvasState = lesson
    ? replay(lesson.steps, 0)
    : initialCanvas();

  const greeting =
    initialGreeting ||
    (topicMeta
      ? `Welcome to **${topicMeta.name}**! I'm your AI Teacher for this workspace. We will explore ${topicMeta.summary.toLowerCase()}`
      : "Hi! I'm SmartZero, your AI-powered interactive DSA teacher. Ask any question about Data Structures & Algorithms!");

  return {
    id: wsId,
    title: computedTitle,
    topicId: effectiveTopicId,
    lessonId: effectiveLessonId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: "learn",
    lesson,
    step: 0,
    phase: lesson ? "idle" : "idle",
    playing: false,
    speed: 1,
    draftAnswer: null,
    selectedAnswer: null,
    answerCorrect: null,
    hintIndex: 0,
    canvasState,
    teachState: initialCanvas(),
    chat: [{ role: "ai", text: greeting }],
    clarificationOptions: null,
    language: "javascript",
    notes: [],
  };
}

function loadPersistedState(): {
  workspaces: LearningWorkspace[];
  activeWorkspaceId: string;
  theme: AppTheme;
} {
  const defaultTheme: AppTheme = "light";
  const defaultWs = createInitialWorkspace();

  try {
    const storage = getStorage();
    if (!storage) {
      return {
        workspaces: [defaultWs],
        activeWorkspaceId: defaultWs.id,
        theme: defaultTheme,
      };
    }

    const themeRaw = storage.getItem(STORAGE_THEME_KEY);
    const theme: AppTheme = themeRaw === "dark" ? "dark" : "light";

    const workspacesRaw = storage.getItem(STORAGE_WORKSPACES_KEY);
    const activeIdRaw = storage.getItem(STORAGE_ACTIVE_ID_KEY);

    if (workspacesRaw) {
      const parsed = JSON.parse(workspacesRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate and rehydrate each workspace
        const hydrated: LearningWorkspace[] = parsed.map((ws: Partial<LearningWorkspace>) => ({
          id: ws.id || `ws-${Date.now()}`,
          title: ws.title || "DSA Canvas",
          topicId: ws.topicId ?? null,
          lessonId: ws.lessonId ?? null,
          createdAt: ws.createdAt || Date.now(),
          updatedAt: ws.updatedAt || Date.now(),
          mode: ws.mode === "teach" ? "teach" : "learn",
          lesson: ws.lesson ?? (ws.lessonId ? lessonFromId(ws.lessonId) : null),
          step: typeof ws.step === "number" ? ws.step : 0,
          phase: ws.phase || "idle",
          playing: false,
          speed: typeof ws.speed === "number" ? ws.speed : 1,
          draftAnswer: ws.draftAnswer ?? null,
          selectedAnswer: ws.selectedAnswer ?? null,
          answerCorrect: ws.answerCorrect ?? null,
          hintIndex: typeof ws.hintIndex === "number" ? ws.hintIndex : 0,
          canvasState: ws.canvasState || initialCanvas(),
          teachState: ws.teachState || initialCanvas(),
          chat: Array.isArray(ws.chat) && ws.chat.length > 0 ? ws.chat : [{ role: "ai", text: "Ready to continue learning." }],
          clarificationOptions: ws.clarificationOptions ?? null,
          language: ws.language === "cpp" ? "cpp" : "javascript",
          notes: Array.isArray(ws.notes) ? ws.notes : [],
        }));

        const activeId =
          activeIdRaw && hydrated.some((w) => w.id === activeIdRaw)
            ? activeIdRaw
            : hydrated[0].id;

        return { workspaces: hydrated, activeWorkspaceId: activeId, theme };
      }
    }

    return {
      workspaces: [defaultWs],
      activeWorkspaceId: defaultWs.id,
      theme,
    };
  } catch (err) {
    console.warn("Failed to load SmartZero state from localStorage; fallback to default:", err);
    return {
      workspaces: [defaultWs],
      activeWorkspaceId: defaultWs.id,
      theme: defaultTheme,
    };
  }
}

/* ══════════════════════════════════════════════
   Workspace Store Interface
   ══════════════════════════════════════════════ */
export interface WorkspaceStore {
  workspaces: LearningWorkspace[];
  activeWorkspaceId: string;
  theme: AppTheme;
  isNotesOpen: boolean;

  /* ── Workspace Management ── */
  getActiveWorkspace: () => LearningWorkspace;
  createWorkspace: (
    topicId?: string,
    title?: string,
    lessonId?: string,
    inputData?: number[],
    initialGreeting?: string
  ) => string;
  switchWorkspace: (id: string) => void;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, newTitle: string) => void;
  findWorkspaceByTopic: (topicId: string) => LearningWorkspace | undefined;
  updateActiveWorkspace: (
    updater:
      | Partial<LearningWorkspace>
      | ((prev: LearningWorkspace) => Partial<LearningWorkspace>)
  ) => void;
  loadLessonInActive: (lesson: Lesson, topicId?: string, customTitle?: string) => void;

  /* ── Notes Management ── */
  addNote: (title: string, content: string) => void;
  updateNote: (noteId: string, title: string, content: string) => void;
  deleteNote: (noteId: string) => void;
  setNotesOpen: (open: boolean) => void;
  toggleNotes: () => void;

  /* ── Theme Management ── */
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

/* ══════════════════════════════════════════════
   Zustand Store Creation
   ══════════════════════════════════════════════ */
const initial = loadPersistedState();

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: initial.workspaces,
  activeWorkspaceId: initial.activeWorkspaceId,
  theme: initial.theme,
  isNotesOpen: false,

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    const found = workspaces.find((w) => w.id === activeWorkspaceId);
    return found || workspaces[0];
  },

  createWorkspace: (topicId, title, lessonId, inputData, initialGreeting) => {
    const newWs = createInitialWorkspace(
      undefined,
      topicId,
      title,
      lessonId,
      inputData,
      initialGreeting
    );

    set((state) => {
      // Pause outgoing active workspace
      const updatedList = state.workspaces.map((w) =>
        w.id === state.activeWorkspaceId ? { ...w, playing: false } : w
      );
      const nextWorkspaces = [...updatedList, newWs];
      persistWorkspaces(nextWorkspaces, newWs.id);
      return {
        workspaces: nextWorkspaces,
        activeWorkspaceId: newWs.id,
      };
    });

    return newWs.id;
  },

  switchWorkspace: (id: string) => {
    const { workspaces, activeWorkspaceId } = get();
    if (id === activeWorkspaceId) return;
    const exists = workspaces.some((w) => w.id === id);
    if (!exists) return;

    set((state) => {
      // Pause outgoing workspace
      const updatedList = state.workspaces.map((w) =>
        w.id === state.activeWorkspaceId ? { ...w, playing: false } : w
      );
      persistWorkspaces(updatedList, id);
      return {
        workspaces: updatedList,
        activeWorkspaceId: id,
      };
    });
  },

  deleteWorkspace: (id: string) => {
    const { workspaces, activeWorkspaceId } = get();
    if (workspaces.length <= 1) {
      // Reset the single workspace instead of leaving 0 workspaces
      const cleanWs = createInitialWorkspace();
      set({
        workspaces: [cleanWs],
        activeWorkspaceId: cleanWs.id,
      });
      persistWorkspaces([cleanWs], cleanWs.id);
      return;
    }

    const filtered = workspaces.filter((w) => w.id !== id);
    let nextActiveId = activeWorkspaceId;
    if (activeWorkspaceId === id) {
      const idx = workspaces.findIndex((w) => w.id === id);
      const nextIdx = idx > 0 ? idx - 1 : 0;
      nextActiveId = filtered[nextIdx]?.id || filtered[0].id;
    }

    set({
      workspaces: filtered,
      activeWorkspaceId: nextActiveId,
    });
    persistWorkspaces(filtered, nextActiveId);
  },

  renameWorkspace: (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    set((state) => {
      const updated = state.workspaces.map((w) =>
        w.id === id ? { ...w, title: trimmed, updatedAt: Date.now() } : w
      );
      persistWorkspaces(updated, state.activeWorkspaceId);
      return { workspaces: updated };
    });
  },

  findWorkspaceByTopic: (topicId: string) => {
    const { workspaces } = get();
    return workspaces.find(
      (w) => w.topicId === topicId || w.lessonId === topicId
    );
  },

  updateActiveWorkspace: (updater) => {
    set((state) => {
      const activeWs = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
      if (!activeWs) return state;

      const patch = typeof updater === "function" ? updater(activeWs) : updater;
      const updatedActive: LearningWorkspace = {
        ...activeWs,
        ...patch,
        updatedAt: Date.now(),
      };

      const nextWorkspaces = state.workspaces.map((w) =>
        w.id === state.activeWorkspaceId ? updatedActive : w
      );

      persistWorkspaces(nextWorkspaces, state.activeWorkspaceId);
      return { workspaces: nextWorkspaces };
    });
  },

  loadLessonInActive: (lesson: Lesson, topicId?: string, customTitle?: string) => {
    const canvas = replay(lesson.steps, 0);
    const resolvedTopicId = topicId || lesson.id;
    const topicMeta = DSA_TOPIC_REGISTRY[resolvedTopicId];
    const newTitle =
      customTitle ||
      (topicMeta
        ? topicMeta.name
        : lesson.title || "DSA Lesson");

    get().updateActiveWorkspace({
      lesson,
      lessonId: lesson.id,
      topicId: resolvedTopicId,
      title: newTitle,
      step: 0,
      phase: "idle",
      playing: false,
      draftAnswer: null,
      selectedAnswer: null,
      answerCorrect: null,
      hintIndex: 0,
      canvasState: canvas,
      mode: "learn",
    });
  },

  /* ── Notes Actions ── */
  addNote: (title: string, content: string) => {
    const trimmedTitle = title.trim() || "Untitled Note";
    const trimmedContent = content.trim();
    if (!trimmedContent && trimmedTitle === "Untitled Note") return;

    const newNote: WorkspaceNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: trimmedTitle,
      content: trimmedContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    get().updateActiveWorkspace((prev) => ({
      notes: [newNote, ...prev.notes],
    }));
  },

  updateNote: (noteId: string, title: string, content: string) => {
    get().updateActiveWorkspace((prev) => ({
      notes: prev.notes.map((n) =>
        n.id === noteId
          ? {
              ...n,
              title: title.trim() || n.title,
              content: content.trim(),
              updatedAt: Date.now(),
            }
          : n
      ),
    }));
  },

  deleteNote: (noteId: string) => {
    get().updateActiveWorkspace((prev) => ({
      notes: prev.notes.filter((n) => n.id !== noteId),
    }));
  },

  setNotesOpen: (open: boolean) => set({ isNotesOpen: open }),
  toggleNotes: () => set((s) => ({ isNotesOpen: !s.isNotesOpen })),

  /* ── Theme Actions ── */
  setTheme: (theme: AppTheme) => {
    persistTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme: AppTheme = get().theme === "dark" ? "light" : "dark";
    persistTheme(nextTheme);
    set({ theme: nextTheme });
  },
}));
