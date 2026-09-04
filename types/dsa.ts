/* ──── Semantic DSL Actions ──── */
export type DSLAction =
  | { action: "reset_scene" }
  | { action: "create_array"; id: string; values: number[] }
  | { action: "update_array_element"; index: number; value: number }
  | { action: "swap_elements"; i: number; j: number }
  | { action: "set_sorted_region"; startIndex: number; endIndex: number }
  | { action: "create_variable"; name: string; value: string | number }
  | { action: "update_variable"; name: string; value: string | number }
  | { action: "create_pointer"; pointer: string; targetIndex: number }
  | { action: "move_pointer"; pointer: string; targetIndex: number }
  | { action: "highlight_element"; indices: number[] }
  | { action: "dim_elements"; indices: number[] }
  | { action: "compare"; text: string | null }
  | { action: "set_bounds"; low: number; mid: number; high: number }
  | { action: "create_linked_list"; values: number[] }
  | { action: "move_ll_pointer"; pointer: string; targetId: string | null }
  | { action: "relink"; order: number[]; reversedUpTo: number }
  | { action: "create_tree"; nodes: TreeNode[]; edges: [string, string][] }
  | { action: "reveal_tree_node"; id: string; edge?: [string, string] }
  | { action: "highlight_tree_node"; id: string }
  | { action: "create_stack"; items: (number | string)[] }
  | { action: "push_stack"; value: number | string }
  | { action: "pop_stack" }
  | { action: "create_queue"; items: (number | string)[] }
  | { action: "enqueue"; value: number | string }
  | { action: "dequeue" }
  | { action: "create_graph"; nodes: GraphNode[]; edges: GraphEdge[] }
  | { action: "visit_graph_node"; id: string }
  | { action: "highlight_edge"; from: string; to: string }
  | { action: "create_hash_table"; size: number }
  | { action: "hash_insert"; bucket: number; key: string | number; value?: string | number }
  | { action: "highlight_bucket"; bucket: number }
  | { action: "create_heap"; values: number[] }
  | { action: "swap_heap_nodes"; i: number; j: number }
  | { action: "show_message"; text: string }
  | { action: "show_complexity"; time: string; space: string };

/* ──── Data Structures ──── */
export type TreeNode = {
  id: string;
  value: number;
  x: number;
  y: number;
  visible: boolean;
};

export type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  visited?: boolean;
};

export type GraphEdge = {
  from: string;
  to: string;
  weight?: number;
  directed?: boolean;
  highlighted?: boolean;
};

export type CanvasState = {
  array: null | {
    id: string;
    values: number[];
    highlightIndices: number[];
    dimIndices: number[];
    pointers: Record<string, number>;
    sortedRegion?: { start: number; end: number };
  };
  variables: Record<string, string | number>;
  linkedList: null | {
    nodes: { id: string; value: number }[];
    pointers: Record<string, string | null>;
    order?: number[];
    reversedUpTo?: number;
  };
  tree: null | {
    nodes: TreeNode[];
    edges: [string, string][];
    highlightId: string | null;
  };
  stack?: null | {
    items: (string | number)[];
    topIndex: number;
  };
  queue?: null | {
    items: (string | number)[];
    front: number;
    rear: number;
  };
  graph?: null | {
    nodes: GraphNode[];
    edges: GraphEdge[];
    visited: string[];
    activeId: string | null;
  };
  hashTable?: null | {
    buckets: { index: number; items: { key: string | number; value?: string | number }[] }[];
    highlightBucket?: number | null;
  };
  heap?: null | {
    values: number[];
    activeIndices?: [number, number] | null;
  };
  bounds: null | { low: number; mid: number; high: number };
  compareText: string | null;
  message: string | null;
  complexity?: { time: string; space: string };
};

/* ──── Learner Interaction ──── */
export type MisconceptionCode =
  | "SECONDMAX_MAX_CONFUSION"
  | "INCORRECT_COMPARISON"
  | "UNCERTAIN"
  | "BINARY_SEARCH_WRONG_HALF"
  | "BST_WRONG_BRANCH"
  | "LINKED_LIST_POINTER_CONFUSION"
  | "WRONG_HALF_ELIMINATED"
  | "SORTING_WRONG_SWAP"
  | "SORTING_PARTITION_ERROR"
  | "GRAPH_CYCLE_CONFUSION"
  | "STACK_LIFO_MISCONCEPTION"
  | "QUEUE_FIFO_MISCONCEPTION"
  | "HEAP_PROPERTY_VIOLATION";

export type LessonQuestion = {
  prompt: string;
  choices: { id: string; text: string }[];
  correctId: string;
  hints: string[];
  misconceptions: Record<string, { code: string; feedback: string }>;
};

/* ──── Lesson Structure ──── */
export type LessonStep = {
  actions: DSLAction[];
  codeLine: string;
  explanation: string;
  pause?: boolean;
  question?: LessonQuestion;
};

export type Lesson = {
  id: string;
  title: string;
  dataStructure: string;
  pattern: string;
  objective: string;
  difficulty: string;
  steps: LessonStep[];
  code: { javascript: string[]; cpp: string[] };
  lineMap: {
    javascript: Record<string, number>;
    cpp: Record<string, number>;
  };
};

export type DSAIntent =
  | "visualize"
  | "explain"
  | "compare"
  | "complexity"
  | "clarification"
  | "unsupported_non_dsa";

export type DSATask = {
  intent?: DSAIntent;
  lessonId: string | null;
  topicId?: string | null;
  category?: string;
  subtopic?: string;
  algorithm?: string;
  pattern?: string;
  objective?: string;
  difficulty?: string;
  rawQuestion: string;
  inputData?: number[];
  targetValue?: number | string;
  comparisonTopics?: string[];
  explanation?: string;
  clarificationOptions?: { label: string; query: string }[];
  complexity?: { time: string; space: string; best?: string; worst?: string };
};

export type LessonPlan = Lesson;

/* ──── Lesson State Machine ──── */
export type LessonPhase =
  | "idle"
  | "teaching"
  | "waiting_for_learner"
  | "evaluating"
  | "correct"
  | "incorrect"
  | "completed";

/* ──── Workspace & Notes Model ──── */
export type AppTheme = "light" | "dark";

export type WorkspaceNote = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type ChatMessage = {
  role: "ai" | "user";
  text: string;
};

export type LearningWorkspace = {
  id: string;
  title: string;
  topicId: string | null;
  lessonId: string | null;
  createdAt: number;
  updatedAt: number;

  /* Mode */
  mode: "learn" | "teach";

  /* Lesson / Runtime state */
  lesson: Lesson | null;
  step: number;
  phase: LessonPhase;

  /* Playback state */
  playing: boolean;
  speed: number;

  /* Learner Interaction state */
  draftAnswer: string | null;
  selectedAnswer: string | null;
  answerCorrect: boolean | null;
  hintIndex: number;

  /* Canvas state */
  canvasState: CanvasState;
  teachState: CanvasState;

  /* AI Tutor conversation */
  chat: ChatMessage[];
  clarificationOptions: { label: string; query: string }[] | null;

  /* Language */
  language: "javascript" | "cpp";

  /* Notes */
  notes: WorkspaceNote[];
};

