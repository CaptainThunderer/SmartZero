/* ──── Whiteboard & Pedagogical Visual Models ──── */
export type BoardHeader = {
  title: string;
  subtitle?: string;
  badge?: string;
};

export type CalloutBox = {
  text: string;
  boxType?: "info" | "insight" | "warning" | "success";
};

export type InsightCard = {
  title: string;
  text: string;
};

export type TransformationArrow = {
  fromLabel: string;
  toLabel: string;
  text?: string;
};

export type SlidingWindow = {
  startIndex: number;
  endIndex: number;
  label?: string;
  conditionOrSum?: string;
};

export type SetContainer = {
  title?: string;
  elements: (string | number)[];
  highlightElements?: (string | number)[];
  operation?: string;
  note?: string;
};

export type CallStackFrame = {
  fnName: string;
  args: string;
  returnValue?: string;
  active?: boolean;
};

export type DecisionTreeNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  state?: "active" | "chosen" | "backtracked" | "pruned";
};

export type DPTable = {
  title?: string;
  headers?: string[];
  rowHeaders?: string[];
  rows: (string | number)[][];
  highlightCell?: [number, number];
  formula?: string;
  meaning?: string;
};

export type MergeTreeLevel = {
  label: string;
  arrays: number[][];
};

export type ComparisonBoard = {
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
  verdict?: string;
};

/* ──── Semantic DSL Actions ──── */
export type DSLAction =
  | { action: "reset_scene" }
  | { action: "set_board_header"; title: string; subtitle?: string; badge?: string }
  | { action: "show_callout"; text: string; boxType?: "info" | "insight" | "warning" | "success" }
  | { action: "show_insight_card"; title: string; text: string }
  | { action: "show_transformation"; fromLabel: string; toLabel: string; text?: string }
  | { action: "set_sliding_window"; startIndex: number; endIndex: number; label?: string; conditionOrSum?: string }
  | { action: "clear_sliding_window" }
  | { action: "create_set_container"; title?: string; elements: (string | number)[]; highlightElements?: (string | number)[]; operation?: string; note?: string }
  | { action: "create_call_stack"; frames: CallStackFrame[] }
  | { action: "create_decision_tree"; nodes: DecisionTreeNode[]; edges: [string, string][] }
  | { action: "create_dp_table"; table: DPTable }
  | { action: "create_merge_tree"; levels: MergeTreeLevel[]; activeLevel?: number }
  | { action: "show_comparison_board"; board: ComparisonBoard }
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
  boardHeader?: BoardHeader | null;
  callout?: CalloutBox | null;
  insightCard?: InsightCard | null;
  transformation?: TransformationArrow | null;
  slidingWindow?: SlidingWindow | null;
  setContainer?: SetContainer | null;
  callStack?: { frames: CallStackFrame[] } | null;
  decisionTree?: { nodes: DecisionTreeNode[]; edges: [string, string][] } | null;
  dpTable?: DPTable | null;
  mergeTree?: { levels: MergeTreeLevel[]; activeLevel?: number } | null;
  comparisonBoard?: ComparisonBoard | null;
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

/* ──── Structured Step Narrative (Whiteboard Pedagogy) ──── */
export type StepExplanation = {
  currentStep: string;
  why: string;
  whatChanged: string;
  whatToNotice: string;
  keyInsight: string;
  nextStep: string;
};

/* ──── Lesson Structure ──── */
export type LessonStep = {
  actions: DSLAction[];
  codeLine: string;
  explanation: string;
  narrative?: StepExplanation;
  pause?: boolean;
  question?: LessonQuestion;
};

export type SupportedLanguage = "javascript" | "cpp" | "python";

/* ──── Universal Problem Solution Plan Model ──── */
export type ProblemCandidateApproach = {
  name: string;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  tradeoffs?: string;
  recommended?: boolean;
};

export type ProblemDryRunStep = {
  step: number;
  stateDescription: string;
  activeVariables: Record<string, string | number | boolean>;
  explanation: string;
};

export type ProblemVisualStep = {
  stepNumber: number;
  title: string;
  actions: DSLAction[];
  codeLine?: string;
  narrative: StepExplanation;
};

export type ProblemSolutionPlan = {
  problemStatement: string;
  normalizedProblem: string;
  objective: string;
  storyContext?: string;
  inputs: string[];
  outputs: string;
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  edgeCases: string[];

  topic: string;
  category: string;
  dataStructures: string[];
  patterns: string[];

  candidateApproaches: ProblemCandidateApproach[];
  selectedApproach: {
    name: string;
    timeComplexity: string;
    spaceComplexity: string;
    whySelected: string;
  };
  reasoning: string;
  correctnessExplanation: string;

  visualSteps?: ProblemVisualStep[];
  dryRun: ProblemDryRunStep[];

  implementations: {
    javascript: string;
    cpp: string;
    python: string;
  };

  complexity: {
    time: string;
    space: string;
    rationale: string;
  };
  finalAnswer: string;
  learnerQuestion?: LessonQuestion;
};

export type Lesson = {
  id: string;
  title: string;
  dataStructure: string;
  pattern: string;
  objective: string;
  difficulty: string;
  steps: LessonStep[];
  code: { javascript: string[]; cpp: string[]; python?: string[] };
  lineMap: {
    javascript: Record<string, number>;
    cpp: Record<string, number>;
    python?: Record<string, number>;
  };
};

export type DSAIntent =
  | "visualize"
  | "explain"
  | "theory"
  | "implementation"
  | "trace"
  | "complexity"
  | "compare"
  | "problem_solving"
  | "debugging"
  | "code_explanation"
  | "example"
  | "edge_case"
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
  codeSnippet?: { language: string; code: string };
  codeSnippets?: { javascript?: string; cpp?: string; python?: string };
  problemPlan?: ProblemSolutionPlan;
  customLesson?: Lesson;
};

export type ProblemSpec = {
  originalQuestion: string;
  cleanedStatement: string;
  task: string;
  inputs: string[];
  outputs: string;
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  edgeCases: string[];
  knownTopic?: string | null;
  algorithmCandidates?: string[];
  requestedLanguage?: "javascript" | "cpp" | "python";
  visualizationPotential?: boolean;
  ambiguity?: string;
  confidence: number;
};

export type ModelTaskType =
  | "TEXT_PROBLEM_SOLVING"
  | "DSA_REASONING"
  | "CODE_GENERATION"
  | "CODE_DEBUGGING"
  | "LONG_CONTEXT"
  | "VISION"
  | "GENERAL_EXPLANATION"
  | "COMPARISON"
  | "COMPLEX_REASONING";

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
  teachHistory?: CanvasState[];

  /* AI Tutor conversation */
  chat: ChatMessage[];
  clarificationOptions: { label: string; query: string }[] | null;

  /* Language */
  language: SupportedLanguage;

  /* Notes */
  notes: WorkspaceNote[];
};

