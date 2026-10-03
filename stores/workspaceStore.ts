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
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

export function applyDocumentTheme(theme: AppTheme) {
  if (typeof document !== "undefined") {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }
}

function persistWorkspaces(workspaces: LearningWorkspace[], activeId: string) {
  try {
    const storage = getStorage();
    if (!storage) return;
    // CRITICAL: Never write to localStorage before client rehydration has run,
    // otherwise the deterministic initial workspace shell will wipe out saved workspaces!
    if (!useWorkspaceStore.getState().isHydrated) return;
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
    if (!useWorkspaceStore.getState().isHydrated) return;
    storage.setItem(STORAGE_THEME_KEY, theme);
    applyDocumentTheme(theme);
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

export function createEmptyWorkspace(
  id?: string,
  title: string = "New Canvas"
): LearningWorkspace {
  const wsId = id || `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: wsId,
    title,
    topicId: null,
    lessonId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: "learn",
    lesson: null,
    step: 0,
    phase: "idle",
    playing: false,
    speed: 1,
    draftAnswer: null,
    selectedAnswer: null,
    answerCorrect: null,
    hintIndex: 0,
    canvasState: initialCanvas(),
    teachState: initialCanvas(),
    teachHistory: [],
    chat: [
      {
        role: "ai",
        text: "Hi! I'm your SmartZero AI Teacher. Ask me any DSA question and we'll learn it visually on the canvas together!",
      },
    ],
    clarificationOptions: null,
    language: "javascript",
    notes: [],
  };
}

export function createInitialWorkspace(
  id?: string,
  topicId?: string,
  title?: string,
  lessonId?: string,
  inputData?: number[],
  initialGreeting?: string
): LearningWorkspace {
  if (!topicId && !lessonId) {
    return createEmptyWorkspace(id, title || "New Canvas");
  }

  const wsId = id || `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const effectiveLessonId = lessonId || (topicId ? topicId : null);
  const effectiveTopicId = topicId || (effectiveLessonId ? effectiveLessonId : null);

  // Lookup topic info
  const topicMeta = effectiveTopicId ? DSA_TOPIC_REGISTRY[effectiveTopicId] : null;
  const computedTitle =
    title ||
    generateWorkspaceTitle(
      topicMeta?.name || "DSA Canvas",
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
      : "Hi! I'm your SmartZero AI Teacher. Ask me any DSA question and we'll learn it visually on the canvas together!");

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

export const DETERMINISTIC_DEFAULT_WS_ID = "ws-default-canvas";

export function createDeterministicDefaultWorkspace(): LearningWorkspace {
  return {
    id: DETERMINISTIC_DEFAULT_WS_ID,
    title: "New Canvas",
    topicId: null,
    lessonId: null,
    createdAt: 0,
    updatedAt: 0,
    mode: "learn",
    lesson: null,
    step: 0,
    phase: "idle",
    playing: false,
    speed: 1,
    draftAnswer: null,
    selectedAnswer: null,
    answerCorrect: null,
    hintIndex: 0,
    canvasState: initialCanvas(),
    teachState: initialCanvas(),
    teachHistory: [],
    chat: [
      {
        role: "ai",
        text: "Hi! I'm your SmartZero AI Teacher. Ask me any DSA question and we'll learn it visually on the canvas together!",
      },
    ],
    clarificationOptions: null,
    language: "javascript",
    notes: [],
  };
}

function loadPersistedState(): {
  workspaces: LearningWorkspace[];
  activeWorkspaceId: string;
  theme: AppTheme;
} | null {
  try {
    const storage = getStorage();
    if (!storage) return null;

    const themeRaw = storage.getItem(STORAGE_THEME_KEY);
    let theme: AppTheme = "light";
    if (themeRaw === "dark" || themeRaw === "light") {
      theme = themeRaw;
    } else if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      theme = "dark";
    }

    const workspacesRaw = storage.getItem(STORAGE_WORKSPACES_KEY);
    const activeIdRaw = storage.getItem(STORAGE_ACTIVE_ID_KEY);

    if (workspacesRaw) {
      const parsed = JSON.parse(workspacesRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate and rehydrate each workspace
        const hydrated: LearningWorkspace[] = parsed.map((ws: Partial<LearningWorkspace>) => {
          const resolvedLesson: Lesson | null =
            ws.lesson ?? (ws.lessonId ? lessonFromId(ws.lessonId) : null);
          const resolvedStep = typeof ws.step === "number" ? ws.step : 0;
          const resolvedCanvas: CanvasState =
            ws.mode === "teach"
              ? ws.teachState || initialCanvas()
              : resolvedLesson
                ? replay(resolvedLesson.steps, resolvedStep)
                : ws.canvasState || initialCanvas();

          return {
            id: ws.id || `ws-${Date.now()}`,
            title: ws.title || "DSA Canvas",
            topicId: ws.topicId ?? null,
            lessonId: ws.lessonId ?? null,
            createdAt: typeof ws.createdAt === "number" ? ws.createdAt : 0,
            updatedAt: typeof ws.updatedAt === "number" ? ws.updatedAt : 0,
            mode: ws.mode === "teach" ? "teach" : "learn",
            lesson: resolvedLesson,
            step: resolvedStep,
            phase: ws.phase || "idle",
            playing: false,
            speed: typeof ws.speed === "number" ? ws.speed : 1,
            draftAnswer: ws.draftAnswer ?? null,
            selectedAnswer: ws.selectedAnswer ?? null,
            answerCorrect: ws.answerCorrect ?? null,
            hintIndex: typeof ws.hintIndex === "number" ? ws.hintIndex : 0,
            canvasState: resolvedCanvas,
            teachState: ws.teachState || initialCanvas(),
            chat:
              Array.isArray(ws.chat) && ws.chat.length > 0
                ? ws.chat
                : [{ role: "ai", text: "Hi! I'm your SmartZero AI Teacher. Ask me any DSA question and we'll learn it visually on the canvas together!" }],
            clarificationOptions: ws.clarificationOptions ?? null,
            language:
              ws.language === "cpp"
                ? "cpp"
                : ws.language === "python"
                ? "python"
                : "javascript",
            notes: Array.isArray(ws.notes) ? ws.notes : [],
          };
        });

        const activeId =
          activeIdRaw && hydrated.some((w) => w.id === activeIdRaw)
            ? activeIdRaw
            : hydrated[0].id;

        return { workspaces: hydrated, activeWorkspaceId: activeId, theme };
      }
    }

    if (themeRaw) {
      return {
        workspaces: [createDeterministicDefaultWorkspace()],
        activeWorkspaceId: DETERMINISTIC_DEFAULT_WS_ID,
        theme,
      };
    }

    return null;
  } catch (err) {
    console.warn("Failed to load SmartZero state from localStorage; fallback to default:", err);
    return null;
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
  isHydrated: boolean;

  /* ── Hydration ── */
  rehydrateFromStorage: () => void;

  /* ── Workspace Management ── */
  getActiveWorkspace: () => LearningWorkspace;
  createEmptyCanvas: (title?: string) => string;
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
  updateWorkspace: (
    id: string,
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
const defaultWs = createDeterministicDefaultWorkspace();

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [defaultWs],
  activeWorkspaceId: defaultWs.id,
  theme: "light",
  isNotesOpen: false,
  isHydrated: false,

  rehydrateFromStorage: () => {
    if (get().isHydrated) return;
    try {
      const persisted = loadPersistedState();
      if (persisted) {
        applyDocumentTheme(persisted.theme);
        set({
          workspaces: persisted.workspaces,
          activeWorkspaceId: persisted.activeWorkspaceId,
          theme: persisted.theme,
          isHydrated: true,
        });
      } else {
        let currentTheme: AppTheme = "light";
        if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
          currentTheme = "dark";
        }
        applyDocumentTheme(currentTheme);
        set({ theme: currentTheme, isHydrated: true });
      }
    } catch (err) {
      console.warn("Failed to rehydrate SmartZero workspace store:", err);
      set({ isHydrated: true });
    }
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    const found = workspaces.find((w) => w.id === activeWorkspaceId);
    return found || workspaces[0];
  },

  createEmptyCanvas: (title?: string) => {
    const nextTitle = title || `Canvas ${get().workspaces.length + 1}`;
    const newWs = createEmptyWorkspace(undefined, nextTitle);

    set((state) => {
      const updatedList = state.workspaces.map((w) =>
        w.id === state.activeWorkspaceId ? { ...w, playing: false } : w
      );
      return {
        workspaces: [...updatedList, newWs],
        activeWorkspaceId: newWs.id,
        isHydrated: true,
      };
    });

    persistWorkspaces(get().workspaces, newWs.id);
    return newWs.id;
  },

  createWorkspace: (topicId, title, lessonId, inputData, initialGreeting) => {
    const newWs =
      !topicId && !lessonId
        ? createEmptyWorkspace(undefined, title || "New Canvas")
        : createInitialWorkspace(
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
      return {
        workspaces: nextWorkspaces,
        activeWorkspaceId: newWs.id,
        isHydrated: true,
      };
    });

    persistWorkspaces(get().workspaces, newWs.id);
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
      return {
        workspaces: updatedList,
        activeWorkspaceId: id,
        isHydrated: true,
      };
    });

    persistWorkspaces(get().workspaces, id);
  },

  deleteWorkspace: (id: string) => {
    const { workspaces, activeWorkspaceId } = get();
    if (workspaces.length <= 1) {
      // Reset the single workspace instead of leaving 0 workspaces
      const cleanWs = createInitialWorkspace();
      set({
        workspaces: [cleanWs],
        activeWorkspaceId: cleanWs.id,
        isHydrated: true,
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
      isHydrated: true,
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
      return { workspaces: updated, isHydrated: true };
    });

    persistWorkspaces(get().workspaces, get().activeWorkspaceId);
  },

  findWorkspaceByTopic: (topicId: string) => {
    const { workspaces } = get();
    return workspaces.find(
      (w) => w.topicId === topicId || w.lessonId === topicId
    );
  },

  updateWorkspace: (id: string, updater) => {
    set((state) => {
      const targetWs = state.workspaces.find((w) => w.id === id);
      if (!targetWs) return state;

      const patch = typeof updater === "function" ? updater(targetWs) : updater;
      if (!patch) return state;

      // Guard against no-op updates: check if any property actually changed
      const keys = Object.keys(patch) as (keyof LearningWorkspace)[];
      let hasChanges = false;
      for (const k of keys) {
        if (patch[k] !== targetWs[k]) {
          hasChanges = true;
          break;
        }
      }
      if (!hasChanges) return state;

      // Keep canvasState in sync if step changed and canvasState was not explicitly provided
      if (patch.step !== undefined && patch.canvasState === undefined) {
        const targetLesson = patch.lesson !== undefined ? patch.lesson : targetWs.lesson;
        const targetMode = patch.mode !== undefined ? patch.mode : targetWs.mode;
        if (targetMode === "learn" && targetLesson) {
          patch.canvasState = replay(targetLesson.steps, patch.step);
        }
      }

      const updatedWs: LearningWorkspace = {
        ...targetWs,
        ...patch,
        updatedAt: Date.now(),
      };

      const nextWorkspaces = state.workspaces.map((w) =>
        w.id === id ? updatedWs : w
      );

      return { workspaces: nextWorkspaces, isHydrated: true };
    });

    persistWorkspaces(get().workspaces, get().activeWorkspaceId);
  },

  updateActiveWorkspace: (updater) => {
    get().updateWorkspace(get().activeWorkspaceId, updater);
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
    applyDocumentTheme(theme);
    set({ theme, isHydrated: true });
    persistTheme(theme);
  },

  toggleTheme: () => {
    const nextTheme: AppTheme = get().theme === "dark" ? "light" : "dark";
    applyDocumentTheme(nextTheme);
    set({ theme: nextTheme, isHydrated: true });
    persistTheme(nextTheme);
  },
}));


