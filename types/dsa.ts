/* ──── Semantic DSL Actions ──── */
export type DSLAction =
  | { action: "reset_scene" }
  | { action: "create_array"; id: string; values: number[] }
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

export type CanvasState = {
  array: null | {
    id: string;
    values: number[];
    highlightIndices: number[];
    dimIndices: number[];
    pointers: Record<string, number>;
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
  | "WRONG_HALF_ELIMINATED";

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

export type DSATask = {
  lessonId: string | null;
  dataStructure?: string;
  algorithm?: string;
  pattern?: string;
  objective?: string;
  difficulty?: string;
  rawQuestion: string;
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
