import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, Sparkles, Send,
  MousePointer2, Pencil, Eraser, Variable as VarIcon, GitBranch,
  Layers, ListTree, ArrowRightLeft, Gauge, CheckCircle2, XCircle,
  Wand2, Code2, GraduationCap, PenLine, Box
} from "lucide-react";

/* ============================================================
   1. VISUAL DSL — the only vocabulary the "AI" is allowed to speak.
   No coordinates. No pixels. Just semantic actions.
   ============================================================ */
const DSL = {
  CREATE_ARRAY: "create_array",
  CREATE_VARIABLE: "create_variable",
  UPDATE_VARIABLE: "update_variable",
  CREATE_POINTER: "create_pointer",
  MOVE_POINTER: "move_pointer",
  HIGHLIGHT_ELEMENT: "highlight_element",
  COMPARE: "compare",
  CREATE_LINKED_LIST: "create_linked_list",
  MOVE_LL_POINTER: "move_ll_pointer",
  RELINK: "relink",
  CREATE_TREE: "create_tree",
  REVEAL_TREE_NODE: "reveal_tree_node",
  HIGHLIGHT_TREE_NODE: "highlight_tree_node",
  SET_BOUNDS: "set_bounds",
  ASK_STUDENT: "ask_student",
  SHOW_MESSAGE: "show_message",
  SHOW_COMPLEXITY: "show_complexity",
  RESET_SCENE: "reset_scene",
};

/* ============================================================
   2. DETERMINISTIC DSA ENGINE — the source of algorithmic truth.
   The reducer below is the ONLY thing allowed to mutate semantic
   canvas state. The AI never touches this directly; it only emits
   DSL actions, which the engine interprets deterministically.
   ============================================================ */
const initialCanvas = () => ({
  array: null,        // { id, values, highlightIndices:[], pointers:{name:index} }
  variables: {},       // { name: value }
  linkedList: null,    // { nodes:[{id,value}], pointers:{name:id}, brokenIndex }
  tree: null,           // { nodes:[{id,value,x,y,visible}], edges:[[from,to]], highlightId }
  bounds: null,         // { low, mid, high } for binary search
  compareText: null,
  message: null,
});

function applyAction(state, action) {
  switch (action.action) {
    case DSL.RESET_SCENE:
      return initialCanvas();

    case DSL.CREATE_ARRAY:
      return {
        ...state,
        array: { id: action.id, values: action.values, highlightIndices: [], pointers: {} },
      };

    case DSL.CREATE_VARIABLE:
      return { ...state, variables: { ...state.variables, [action.name]: action.value } };

    case DSL.UPDATE_VARIABLE:
      return { ...state, variables: { ...state.variables, [action.name]: action.value } };

    case DSL.CREATE_POINTER:
    case DSL.MOVE_POINTER:
      if (!state.array) return state;
      return {
        ...state,
        array: {
          ...state.array,
          pointers: { ...state.array.pointers, [action.pointer]: action.targetIndex },
        },
      };

    case DSL.HIGHLIGHT_ELEMENT:
      if (!state.array) return state;
      return { ...state, array: { ...state.array, highlightIndices: action.indices } };

    case DSL.COMPARE:
      return { ...state, compareText: action.text };

    case DSL.SET_BOUNDS:
      return { ...state, bounds: { low: action.low, mid: action.mid, high: action.high } };

    case DSL.CREATE_LINKED_LIST:
      return {
        ...state,
        linkedList: {
          nodes: action.values.map((v, i) => ({ id: `n${i}`, value: v })),
          pointers: {},
        },
      };

    case DSL.MOVE_LL_POINTER:
      if (!state.linkedList) return state;
      return {
        ...state,
        linkedList: {
          ...state.linkedList,
          pointers: { ...state.linkedList.pointers, [action.pointer]: action.targetId },
        },
      };

    case DSL.RELINK:
      if (!state.linkedList) return state;
      return {
        ...state,
        linkedList: { ...state.linkedList, order: action.order, reversedUpTo: action.reversedUpTo },
      };

    case DSL.CREATE_TREE:
      return { ...state, tree: { nodes: action.nodes, edges: action.edges, highlightId: null } };

    case DSL.REVEAL_TREE_NODE:
      if (!state.tree) return state;
      return {
        ...state,
        tree: {
          ...state.tree,
          nodes: state.tree.nodes.map((n) => (n.id === action.id ? { ...n, visible: true } : n)),
          edges: [...state.tree.edges, ...(action.edge ? [action.edge] : [])],
        },
      };

    case DSL.HIGHLIGHT_TREE_NODE:
      if (!state.tree) return state;
      return { ...state, tree: { ...state.tree, highlightId: action.id } };

    case DSL.SHOW_MESSAGE:
      return { ...state, message: action.text };

    case DSL.SHOW_COMPLEXITY:
      return { ...state, complexity: { time: action.time, space: action.space } };

    default:
      return state;
  }
}

function replay(steps, uptoIndex) {
  let s = initialCanvas();
  for (let i = 0; i <= uptoIndex && i < steps.length; i++) {
    for (const a of steps[i].actions || []) s = applyAction(s, a);
  }
  return s;
}

/* ============================================================
   3. ARRAY ENGINE — builds the "second maximum" lesson (primary demo)
   and the "binary search" lesson (secondary demo). Every value shown
   is computed here, deterministically. The AI never invents numbers.
   ============================================================ */
function buildSecondMaxLesson(values) {
  const steps = [];
  let max = -Infinity, secondMax = -Infinity;

  steps.push({
    actions: [
      { action: DSL.RESET_SCENE },
      { action: DSL.CREATE_ARRAY, id: "arr1", values },
      { action: DSL.CREATE_VARIABLE, name: "max", value: "−∞" },
      { action: DSL.CREATE_VARIABLE, name: "secondMax", value: "−∞" },
      { action: DSL.CREATE_POINTER, pointer: "i", targetIndex: 0 },
    ],
    codeLine: "init",
    explanation:
      "We'll scan the array once, tracking the two largest values we've seen so far: max and secondMax.",
  });

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    steps.push({
      actions: [
        { action: DSL.MOVE_POINTER, pointer: "i", targetIndex: i },
        { action: DSL.HIGHLIGHT_ELEMENT, indices: [i] },
        { action: DSL.COMPARE, text: `Is ${v} > max (${fmt(max)})?` },
      ],
      codeLine: "loopcheck",
      explanation: `Pointer i moves to index ${i}. Current value is ${v}. We compare it against max (${fmt(max)}).`,
    });

    if (i === 2) {
      // The canonical "what happens at 20?" pause point.
      steps.push({
        actions: [],
        codeLine: "loopcheck",
        pause: true,
        question: {
          prompt: `We're at index 2, value ${v}. max is currently ${fmt(max)} and secondMax is ${fmt(secondMax)}. What should happen now?`,
          choices: [
            { id: "a", text: `max becomes ${v}` },
            { id: "b", text: `secondMax becomes ${v}` },
            { id: "c", text: "Nothing changes" },
            { id: "d", text: "I'm not sure" },
          ],
          correctId: "a",
          misconceptions: {
            b: {
              code: "SECONDMAX_MAX_CONFUSION",
              feedback: `Close, but not quite. When the new element (${v}) beats the current max, max updates first — and the old max slides down into secondMax. So max becomes ${v}, and secondMax becomes the old max (${fmt(max)}), not the other way around.`,
            },
            c: {
              code: "INCORRECT_COMPARISON",
              feedback: `${v} is greater than the current max (${fmt(max)}), so something does change. Whenever we meet a new largest value, max must update to reflect it.`,
            },
            d: {
              code: "UNCERTAIN",
              feedback: `No problem — let's work it out together. We compare ${v} to max (${fmt(max)}). Since ${v} is bigger, max updates to ${v}, and whatever max used to be (${fmt(max)}) becomes the new secondMax.`,
            },
          },
        },
      });
    }

    let branch, explanation;
    if (v > max) {
      secondMax = max;
      max = v;
      branch = "ifbranch";
      explanation = `${v} is greater than max, so the old max (${fmt(secondMax === -Infinity ? "−∞" : secondMax)}) demotes to secondMax, and max becomes ${v}.`;
    } else if (v > secondMax && v !== max) {
      secondMax = v;
      branch = "elsebranch";
      explanation = `${v} isn't bigger than max, but it beats the current secondMax, so secondMax becomes ${v}.`;
    } else {
      branch = "elsebranch";
      explanation = `${v} doesn't beat max or secondMax, so both variables stay the same.`;
    }

    steps.push({
      actions: [
        { action: DSL.UPDATE_VARIABLE, name: "max", value: fmt(max) },
        { action: DSL.UPDATE_VARIABLE, name: "secondMax", value: fmt(secondMax) },
        { action: DSL.COMPARE, text: null },
      ],
      codeLine: branch,
      explanation,
    });
  }

  steps.push({
    actions: [
      { action: DSL.HIGHLIGHT_ELEMENT, indices: [] },
      { action: DSL.SHOW_MESSAGE, text: `Done. The second maximum element is ${secondMax}.` },
      { action: DSL.SHOW_COMPLEXITY, time: "O(n)", space: "O(1)" },
    ],
    codeLine: "return",
    explanation: `We've scanned every element exactly once. The second maximum is ${secondMax}.`,
  });

  return {
    id: "second-max",
    title: "Find the Second Maximum Element",
    dataStructure: "Array",
    pattern: "Single-pass linear scan, tracking two running maxima",
    objective: "Understand how to track two values while scanning an array once, in O(n) time and O(1) space.",
    difficulty: "Beginner–Intermediate",
    steps,
    code: {
      javascript: [
        "function secondMax(arr) {",
        "  let max = -Infinity, secondMax = -Infinity;",
        "  for (let i = 0; i < arr.length; i++) {",
        "    if (arr[i] > max) {",
        "      secondMax = max;",
        "      max = arr[i];",
        "    } else if (arr[i] > secondMax && arr[i] !== max) {",
        "      secondMax = arr[i];",
        "    }",
        "  }",
        "  return secondMax;",
        "}",
      ],
      cpp: [
        "int secondMax(vector<int>& arr) {",
        "  long max = LONG_MIN, secondMax = LONG_MIN;",
        "  for (int i = 0; i < arr.size(); i++) {",
        "    if (arr[i] > max) {",
        "      secondMax = max;",
        "      max = arr[i];",
        "    } else if (arr[i] > secondMax && arr[i] != max) {",
        "      secondMax = arr[i];",
        "    }",
        "  }",
        "  return secondMax;",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, loopcheck: 2, ifbranch: 3, elsebranch: 6, return: 10 },
      cpp: { init: 1, loopcheck: 2, ifbranch: 3, elsebranch: 6, return: 10 },
    },
  };
}

function fmt(n) {
  if (n === -Infinity) return "−∞";
  return n;
}

function buildBinarySearchLesson(values, target) {
  const steps = [];
  let low = 0, high = values.length - 1;

  steps.push({
    actions: [
      { action: DSL.RESET_SCENE },
      { action: DSL.CREATE_ARRAY, id: "arr1", values },
      { action: DSL.CREATE_VARIABLE, name: "target", value: target },
      { action: DSL.SET_BOUNDS, low, mid: Math.floor((low + high) / 2), high },
    ],
    codeLine: "init",
    explanation: `We're searching a sorted array for ${target}. low starts at 0, high starts at ${high}.`,
  });

  let found = false;
  let guard = 0;
  while (low <= high && guard < 8) {
    guard++;
    const mid = Math.floor((low + high) / 2);
    const midVal = values[mid];

    steps.push({
      actions: [
        { action: DSL.SET_BOUNDS, low, mid, high },
        { action: DSL.HIGHLIGHT_ELEMENT, indices: [mid] },
        { action: DSL.COMPARE, text: `arr[mid] = ${midVal}, target = ${target}` },
      ],
      codeLine: "mid",
      explanation: `mid = (${low} + ${high}) / 2 = ${mid}. The value there is ${midVal}.`,
    });

    if (midVal === target) {
      steps.push({
        actions: [
          { action: DSL.SHOW_MESSAGE, text: `Found ${target} at index ${mid}!` },
          { action: DSL.SHOW_COMPLEXITY, time: "O(log n)", space: "O(1)" },
        ],
        codeLine: "found",
        explanation: `${midVal} equals the target. Search complete.`,
      });
      found = true;
      break;
    }

    const eliminateLeft = midVal < target;
    steps.push({
      actions: [],
      pause: true,
      codeLine: "compare",
      question: {
        prompt: `${midVal} ${eliminateLeft ? "<" : ">"} ${target}. Which half should we eliminate?`,
        choices: [
          { id: "left", text: `Left half (indices ${low}–${mid})` },
          { id: "right", text: `Right half (indices ${mid}–${high})` },
        ],
        correctId: eliminateLeft ? "left" : "right",
        misconceptions: {
          [eliminateLeft ? "right" : "left"]: {
            code: "WRONG_HALF_ELIMINATED",
            feedback: eliminateLeft
              ? `Since arr[mid] (${midVal}) is smaller than the target (${target}), the target must be further right — so everything from low to mid, including mid, can be safely eliminated.`
              : `Since arr[mid] (${midVal}) is larger than the target (${target}), the target must be further left — so everything from mid to high, including mid, can be safely eliminated.`,
          },
        },
      },
    });

    if (eliminateLeft) low = mid + 1; else high = mid - 1;

    steps.push({
      actions: [{ action: DSL.SET_BOUNDS, low, mid: Math.floor((low + high) / 2), high }],
      codeLine: eliminateLeft ? "moveLow" : "moveHigh",
      explanation: eliminateLeft
        ? `We move low to ${low}, discarding the left half.`
        : `We move high to ${high}, discarding the right half.`,
    });
  }

  if (!found) {
    steps.push({
      actions: [{ action: DSL.SHOW_MESSAGE, text: `${target} is not in the array.` }],
      codeLine: "found",
      explanation: "low has crossed high, so the search space is empty.",
    });
  }

  return {
    id: "binary-search",
    title: "Binary Search",
    dataStructure: "Array",
    pattern: "Divide and conquer on a sorted array",
    objective: "See how eliminating half the search space each step gives O(log n) search time.",
    difficulty: "Beginner",
    steps,
    code: {
      javascript: [
        "function binarySearch(arr, target) {",
        "  let low = 0, high = arr.length - 1;",
        "  while (low <= high) {",
        "    const mid = Math.floor((low + high) / 2);",
        "    if (arr[mid] === target) return mid;",
        "    if (arr[mid] < target) low = mid + 1;",
        "    else high = mid - 1;",
        "  }",
        "  return -1;",
        "}",
      ],
      cpp: [
        "int binarySearch(vector<int>& arr, int target) {",
        "  int low = 0, high = arr.size() - 1;",
        "  while (low <= high) {",
        "    int mid = low + (high - low) / 2;",
        "    if (arr[mid] == target) return mid;",
        "    if (arr[mid] < target) low = mid + 1;",
        "    else high = mid - 1;",
        "  }",
        "  return -1;",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, mid: 3, compare: 4, found: 4, moveLow: 5, moveHigh: 6 },
      cpp: { init: 1, mid: 3, compare: 4, found: 4, moveLow: 5, moveHigh: 6 },
    },
  };
}

/* ============================================================
   4. TREE ENGINE — fixed-layout BST insertion demo (kept small on
   purpose: V1 scope explicitly excludes a generic tree-layout engine).
   ============================================================ */
const BST_LAYOUT = {
  50: { x: 300, y: 40 }, 30: { x: 180, y: 130 }, 70: { x: 420, y: 130 },
  60: { x: 360, y: 220 }, 80: { x: 480, y: 220 }, 65: { x: 400, y: 300 },
};
function buildBSTLesson(insertValue) {
  const baseNodes = [50, 30, 70, 60, 80].map((v) => ({
    id: `t${v}`, value: v, ...BST_LAYOUT[v], visible: true,
  }));
  const baseEdges = [["t50", "t30"], ["t50", "t70"], ["t70", "t60"], ["t70", "t80"]];
  const newNode = { id: `t${insertValue}`, value: insertValue, ...BST_LAYOUT[insertValue], visible: false };

  const steps = [
    {
      actions: [
        { action: DSL.RESET_SCENE },
        { action: DSL.CREATE_TREE, nodes: [...baseNodes, newNode], edges: baseEdges },
      ],
      codeLine: "init",
      explanation: `We'll insert ${insertValue} into the BST by comparing it against each node, starting at the root.`,
    },
  ];

  // path 50 -> 70 -> 60 -> insert as right child of 60 (for value 65 specifically)
  const path = [
    { id: "t50", value: 50, next: "t70", dir: "right", edge: null },
    { id: "t70", value: 70, next: "t60", dir: "left", edge: null },
    { id: "t60", value: 60, next: null, dir: "right", edge: ["t60", `t${insertValue}`] },
  ];

  path.forEach((node) => {
    steps.push({
      actions: [{ action: DSL.HIGHLIGHT_TREE_NODE, id: node.id }],
      codeLine: "compare",
      explanation: `At node ${node.value}: is ${insertValue} less than or greater than ${node.value}?`,
    });

    const correctDir = insertValue < node.value ? "left" : "right";
    steps.push({
      actions: [],
      pause: true,
      codeLine: "compare",
      question: {
        prompt: `${insertValue} vs ${node.value}. Which way should we go?`,
        choices: [{ id: "left", text: "Go left" }, { id: "right", text: "Go right" }],
        correctId: correctDir,
        misconceptions: {
          [correctDir === "left" ? "right" : "left"]: {
            code: "BST_WRONG_BRANCH",
            feedback: `${insertValue} is ${correctDir === "left" ? "smaller" : "larger"} than ${node.value}, and in a BST, ${correctDir === "left" ? "smaller" : "larger"} values always go ${correctDir}. So from ${node.value}, we should move ${correctDir}, not ${correctDir === "left" ? "right" : "left"}.`,
          },
        },
      },
    });

    if (node.edge) {
      steps.push({
        actions: [{ action: DSL.REVEAL_TREE_NODE, id: `t${insertValue}`, edge: node.edge }],
        codeLine: "insert",
        explanation: `${node.value} has no ${node.dir} child, so ${insertValue} is inserted there.`,
      });
    }
  });

  steps.push({
    actions: [{ action: DSL.SHOW_MESSAGE, text: `${insertValue} inserted successfully.` }, { action: DSL.SHOW_COMPLEXITY, time: "O(h)", space: "O(1)" }],
    codeLine: "done",
    explanation: `Insertion complete. Cost is proportional to the tree's height, h.`,
  });

  return {
    id: "bst-insert",
    title: `Insert ${insertValue} into a BST`,
    dataStructure: "Binary Search Tree",
    pattern: "Recursive/iterative comparison-based descent",
    objective: "Practice choosing the correct branch at each node using BST ordering.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function insert(node, value) {",
        "  if (!node) return { value, left: null, right: null };",
        "  if (value < node.value) node.left = insert(node.left, value);",
        "  else node.right = insert(node.right, value);",
        "  return node;",
        "}",
      ],
      cpp: [
        "Node* insert(Node* node, int value) {",
        "  if (!node) return new Node(value);",
        "  if (value < node->value) node->left = insert(node->left, value);",
        "  else node->right = insert(node->right, value);",
        "  return node;",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, compare: 3, insert: 4, done: 5 },
      cpp: { init: 1, compare: 3, insert: 4, done: 5 },
    },
  };
}

/* ============================================================
   5. LINKED LIST ENGINE — reversal demo.
   ============================================================ */
function buildLinkedListLesson(values) {
  const steps = [];
  steps.push({
    actions: [
      { action: DSL.RESET_SCENE },
      { action: DSL.CREATE_LINKED_LIST, values },
      { action: DSL.MOVE_LL_POINTER, pointer: "prev", targetId: null },
      { action: DSL.MOVE_LL_POINTER, pointer: "curr", targetId: "n0" },
    ],
    codeLine: "init",
    explanation: "prev starts at null, curr starts at the head. We'll reverse links one node at a time.",
  });

  for (let i = 0; i < values.length; i++) {
    const currId = `n${i}`;
    const nextId = i + 1 < values.length ? `n${i + 1}` : null;
    steps.push({
      actions: [
        { action: DSL.MOVE_LL_POINTER, pointer: "curr", targetId: currId },
        { action: DSL.MOVE_LL_POINTER, pointer: "next", targetId: nextId },
      ],
      codeLine: "savenext",
      explanation: `We save next = ${nextId ? `node(${values[i + 1]})` : "null"} before we lose the forward link.`,
    });
    steps.push({
      actions: [{ action: DSL.RELINK, order: values.slice(0, i + 1).reverse().concat(values.slice(i + 1)), reversedUpTo: i }],
      codeLine: "relink",
      explanation: `node(${values[i]}).next now points backward to prev, reversing this link.`,
    });
    steps.push({
      actions: [{ action: DSL.MOVE_LL_POINTER, pointer: "prev", targetId: currId }],
      codeLine: "advance",
      explanation: `prev advances to node(${values[i]}); curr will advance to next on the following step.`,
    });
  }

  steps.push({
    actions: [{ action: DSL.SHOW_MESSAGE, text: `List reversed: ${values.slice().reverse().join(" → ")}` }, { action: DSL.SHOW_COMPLEXITY, time: "O(n)", space: "O(1)" }],
    codeLine: "done",
    explanation: "curr is now null, so prev points to the new head. The list is fully reversed.",
  });

  return {
    id: "linked-list-reverse",
    title: "Reverse a Linked List",
    dataStructure: "Linked List",
    pattern: "Iterative in-place pointer reversal",
    objective: "See how prev/curr/next pointers rewire each link without extra memory.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function reverse(head) {",
        "  let prev = null, curr = head;",
        "  while (curr) {",
        "    const next = curr.next;",
        "    curr.next = prev;",
        "    prev = curr;",
        "    curr = next;",
        "  }",
        "  return prev;",
        "}",
      ],
      cpp: [
        "Node* reverse(Node* head) {",
        "  Node* prev = nullptr; Node* curr = head;",
        "  while (curr) {",
        "    Node* next = curr->next;",
        "    curr->next = prev;",
        "    prev = curr;",
        "    curr = next;",
        "  }",
        "  return prev;",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, savenext: 3, relink: 4, advance: 5, done: 8 },
      cpp: { init: 1, savenext: 3, relink: 4, advance: 5, done: 8 },
    },
  };
}

/* ============================================================
   6. AGENT / AI-TEACHER LAYER
   interpretQuestion -> planner -> lesson. This function stands in for
   the real AIProvider.interpretQuestion + createLesson pair. In
   production this call happens server-side against Featherless.ai;
   here it runs a deterministic keyword interpreter so the demo NEVER
   depends on network access — this *is* the fallback/demo-mode path
   the spec requires, active by default for reliability.
   ============================================================ */
function interpretQuestion(raw) {
  const q = raw.toLowerCase();
  if (/second\s*max|second\s*largest/.test(q)) return { lessonId: "second-max" };
  if (/binary\s*search/.test(q)) return { lessonId: "binary-search" };
  if (/bst|binary search tree|insert.*tree|tree.*insert/.test(q)) return { lessonId: "bst-insert" };
  if (/reverse.*linked list|linked list.*reverse/.test(q)) return { lessonId: "linked-list-reverse" };
  if (/linked list/.test(q)) return { lessonId: "linked-list-reverse" };
  if (/stack|queue|graph|bfs|dfs/.test(q)) return { lessonId: null, note: "coverage-gap" };
  return { lessonId: null, note: "unclear" };
}

function buildLesson(lessonId) {
  switch (lessonId) {
    case "second-max": return buildSecondMaxLesson([10, 5, 20, 8, 15]);
    case "binary-search": return buildBinarySearchLesson([10, 20, 30, 40, 50, 60, 70, 80], 60);
    case "bst-insert": return buildBSTLesson(65);
    case "linked-list-reverse": return buildLinkedListLesson([1, 2, 3, 4]);
    default: return null;
  }
}

const SUGGESTED_PROMPTS = [
  "Find the second maximum element in an array.",
  "Explain binary search.",
  "Insert 65 into this BST.",
  "Reverse a linked list.",
];

/* ============================================================
   7. RENDER LAYER — Excalidraw-style hand-sketched semantic canvas.
   (This sandbox has no network access to fetch @excalidraw/excalidraw
   from npm, so the renderer below is a purpose-built SVG substitute
   that honors the same rule: it only ever draws what the semantic
   canvasState says exists — it never invents layout on its own.)
   ============================================================ */
const INK = "#232946";
const ACCENT = "#5B5FEF";
const ACCENT_SOFT = "#EEF0FD";
const GOOD = "#1E9E76";
const WARN = "#C97A2B";

function ArrayCanvas({ arr, bounds }) {
  if (!arr) return null;
  const boxW = 56, gap = 10, startX = 40;
  const pointerNames = Object.keys(arr.pointers || {});
  return (
    <svg viewBox="0 0 640 200" className="w-full h-full">
      {arr.values.map((v, i) => {
        const x = startX + i * (boxW + gap);
        const highlighted = arr.highlightIndices?.includes(i);
        const inLow = bounds && i === bounds.low;
        const inHigh = bounds && i === bounds.high;
        const inMid = bounds && i === bounds.mid;
        return (
          <g key={i}>
            <rect
              x={x} y={90} width={boxW} height={boxW} rx={10}
              fill={highlighted || inMid ? ACCENT_SOFT : "#FFFFFF"}
              stroke={highlighted || inMid ? ACCENT : "#C9CCE0"}
              strokeWidth={highlighted || inMid ? 2.5 : 1.5}
              style={{ transition: "all 300ms ease" }}
            />
            <text x={x + boxW / 2} y={90 + boxW / 2 + 6} textAnchor="middle" fontSize="18" fontWeight="600" fill={INK}>{v}</text>
            <text x={x + boxW / 2} y={90 + boxW + 18} textAnchor="middle" fontSize="11" fill="#9498B3">{i}</text>
            {inLow && <text x={x + boxW / 2} y={78} textAnchor="middle" fontSize="10" fontWeight="700" fill={WARN}>low</text>}
            {inHigh && <text x={x + boxW / 2} y={78} textAnchor="middle" fontSize="10" fontWeight="700" fill={WARN}>high</text>}
            {inMid && <text x={x + boxW / 2} y={78} textAnchor="middle" fontSize="10" fontWeight="700" fill={ACCENT}>mid</text>}
          </g>
        );
      })}
      {pointerNames.map((name) => {
        const idx = arr.pointers[name];
        const x = startX + idx * (boxW + gap) + boxW / 2;
        return (
          <g key={name} style={{ transition: "transform 350ms ease" }}>
            <line x1={x} y1={55} x2={x} y2={86} stroke={ACCENT} strokeWidth={2} markerEnd="url(#arrow)" />
            <text x={x} y={44} textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT}>{name}</text>
          </g>
        );
      })}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={ACCENT} />
        </marker>
      </defs>
    </svg>
  );
}

function TreeCanvas({ tree }) {
  if (!tree) return null;
  const nodeById = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox="0 0 600 340" className="w-full h-full">
      {tree.edges.map(([from, to], i) => {
        const a = nodeById[from], b = nodeById[to];
        if (!a || !b || !a.visible || !b.visible) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#C9CCE0" strokeWidth={2} />;
      })}
      {tree.nodes.filter((n) => n.visible).map((n) => {
        const active = tree.highlightId === n.id;
        return (
          <g key={n.id} style={{ transition: "opacity 300ms ease" }}>
            <circle cx={n.x} cy={n.y} r={22} fill={active ? ACCENT_SOFT : "#FFFFFF"} stroke={active ? ACCENT : "#C9CCE0"} strokeWidth={active ? 2.5 : 1.5} />
            <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="15" fontWeight="600" fill={INK}>{n.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LinkedListCanvas({ ll }) {
  if (!ll) return null;
  const order = ll.order || ll.nodes.map((n) => n.value);
  const boxW = 60, gap = 34, startX = 40;
  const pointerNames = Object.keys(ll.pointers || {});
  const idOf = (val) => {
    const node = ll.nodes.find((n) => n.value === val);
    return node ? node.id : null;
  };
  return (
    <svg viewBox="0 0 640 180" className="w-full h-full">
      {order.map((v, i) => {
        const x = startX + i * (boxW + gap);
        const isLast = i === order.length - 1;
        const reversedSegment = ll.reversedUpTo !== undefined && i <= ll.reversedUpTo;
        return (
          <g key={v}>
            <rect x={x} y={80} width={boxW} height={44} rx={8} fill="#FFFFFF" stroke="#C9CCE0" strokeWidth={1.5} />
            <text x={x + boxW / 2} y={107} textAnchor="middle" fontSize="16" fontWeight="600" fill={INK}>{v}</text>
            {!isLast && (
              <line
                x1={reversedSegment ? x : x + boxW} y1={102}
                x2={reversedSegment ? x + boxW + gap : x + boxW + gap} y2={102}
                stroke="#9498B3" strokeWidth={2}
                markerEnd={reversedSegment ? undefined : "url(#llarrow)"}
                markerStart={reversedSegment ? "url(#llarrowrev)" : undefined}
              />
            )}
          </g>
        );
      })}
      {pointerNames.map((name) => {
        const targetId = ll.pointers[name];
        const node = ll.nodes.find((n) => n.id === targetId);
        if (!node) return null;
        const i = order.indexOf(node.value);
        if (i < 0) return null;
        const x = startX + i * (boxW + gap) + boxW / 2;
        const colors = { prev: WARN, curr: ACCENT, next: GOOD };
        return (
          <g key={name}>
            <line x1={x} y1={40} x2={x} y2={77} stroke={colors[name] || ACCENT} strokeWidth={2} markerEnd="url(#llptr)" />
            <text x={x} y={30} textAnchor="middle" fontSize="12" fontWeight="700" fill={colors[name] || ACCENT}>{name}</text>
          </g>
        );
      })}
      <defs>
        <marker id="llarrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#9498B3" /></marker>
        <marker id="llarrowrev" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 Z" fill={ACCENT} /></marker>
        <marker id="llptr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={ACCENT} /></marker>
      </defs>
    </svg>
  );
}

/* ============================================================
   8. UI SHELL
   ============================================================ */
export default function SmartZero() {
  const [mode, setMode] = useState("learn"); // 'learn' | 'teach'
  const [lesson, setLesson] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [language, setLanguage] = useState("javascript");
  const [chat, setChat] = useState([
    { role: "ai", text: "Hi, I'm the SmartZero teacher. Ask me any DSA question, or try Demo Mode." },
  ]);
  const [input, setInput] = useState("");
  const [answeredForStep, setAnsweredForStep] = useState({}); // stepIndex -> {choiceId, correct}
  const chatEndRef = useRef(null);

  const canvasState = useMemo(() => (lesson ? replay(lesson.steps, stepIndex) : initialCanvas()), [lesson, stepIndex]);
  const currentStep = lesson?.steps?.[stepIndex];
  const isPaused = !!currentStep?.pause && !answeredForStep[stepIndex];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  useEffect(() => {
    if (!playing || !lesson) return;
    if (isPaused) { setPlaying(false); return; }
    if (stepIndex >= lesson.steps.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStepIndex((i) => i + 1), 1400 / speed);
    return () => clearTimeout(t);
  }, [playing, stepIndex, lesson, speed, isPaused]);

  function loadLesson(lessonId, aiPreamble) {
    const built = buildLesson(lessonId);
    if (!built) return;
    setLesson(built);
    setStepIndex(0);
    setPlaying(false);
    setAnsweredForStep({});
    setChat((c) => [
      ...c,
      ...(aiPreamble ? [{ role: "ai", text: aiPreamble }] : []),
      {
        role: "ai",
        text: `Data structure: ${built.dataStructure} · Pattern: ${built.pattern}\nObjective: ${built.objective}`,
        meta: true,
      },
      { role: "ai", text: `Lesson ready: "${built.title}". I've set up the canvas — press Next or Play to begin.` },
    ]);
  }

  function handleAsk(text) {
    const q = text.trim();
    if (!q) return;
    setChat((c) => [...c, { role: "user", text: q }]);
    setInput("");
    const { lessonId, note } = interpretQuestion(q);
    if (lessonId) {
      loadLesson(lessonId, `Got it — let me set that up.`);
    } else if (note === "coverage-gap") {
      setChat((c) => [...c, { role: "ai", text: "That data structure isn't wired into this V1 demo yet (Stack, Queue, Graph/BFS engines are stubbed for V2 polish). Try one of the four demos below instead — Array, Binary Search, BST, or Linked List." }]);
    } else {
      setChat((c) => [...c, { role: "ai", text: "I couldn't confidently map that to one of this build's four demo lessons, so here's the most reliable path: try one of the suggested prompts, or hit Demo Mode." }]);
    }
  }

  function handleAnswer(choiceId) {
    const q = currentStep.question;
    const correct = choiceId === q.correctId;
    setAnsweredForStep((a) => ({ ...a, [stepIndex]: { choiceId, correct } }));
    if (correct) {
      setChat((c) => [...c, { role: "ai", text: "Correct. " + (q.choices.find(ch => ch.id === choiceId)?.text || "") + " — nice reasoning." }]);
    } else {
      const m = q.misconceptions[choiceId];
      setChat((c) => [...c, { role: "ai", text: (m?.feedback || "Not quite — let's look at the state again.") + (m ? `\n\n[misconception: ${m.code}]` : "") }]);
    }
  }

  function next() {
    if (!lesson) return;
    if (isPaused) return;
    setStepIndex((i) => Math.min(i + 1, lesson.steps.length - 1));
  }
  function prev() { setStepIndex((i) => Math.max(i - 1, 0)); }
  function reset() { setStepIndex(0); setPlaying(false); setAnsweredForStep({}); }

  const totalSteps = lesson?.steps?.length || 0;
  const complexity = canvasState.complexity;
  const activeCodeLine = lesson && currentStep ? lesson.lineMap[language][currentStep.codeLine] : null;
  const codeLines = lesson ? lesson.code[language] : [];

  return (
    <div className="h-full w-full flex flex-col bg-[#FAFAF8] text-[#232946]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {/* NAVBAR */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-[#E7E7E2] bg-white/70 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
            <Wand2 size={15} color="white" />
          </div>
          <span className="font-semibold tracking-tight text-[15px]">SmartZero</span>
        </div>
        <div className="h-4 w-px bg-[#E7E7E2]" />
        <div className="flex items-center gap-1 text-[13px]">
          <button onClick={() => setMode("learn")} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === "learn" ? "bg-[#EEF0FD] text-[#5B5FEF]" : "text-[#6B6F8A] hover:bg-[#F2F2EE]"}`}>Learn</button>
          <button onClick={() => setMode("teach")} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === "teach" ? "bg-[#EEF0FD] text-[#5B5FEF]" : "text-[#6B6F8A] hover:bg-[#F2F2EE]"}`}>Teach</button>
          <button disabled className="px-3 py-1.5 rounded-md font-medium text-[#B8BAD0] cursor-not-allowed">Practice</button>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => loadLesson("second-max", "Launching Demo Mode.")}
          className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md text-white"
          style={{ background: ACCENT }}
        >
          <Sparkles size={14} /> Demo Mode
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: AI TEACHER */}
        <div className="w-[300px] border-r border-[#E7E7E2] flex flex-col bg-white/50 shrink-0">
          <div className="px-4 py-3 border-b border-[#E7E7E2] flex items-center gap-2">
            <GraduationCap size={16} color={ACCENT} />
            <span className="text-[13px] font-semibold">AI Teacher</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px] leading-relaxed">
            {chat.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[92%] px-3 py-2 rounded-xl whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-[#232946] text-white rounded-br-sm"
                      : m.meta
                      ? "bg-[#F5F4FE] text-[#5B5FEF] border border-[#DEDCFA] font-mono text-[11.5px]"
                      : "bg-[#F2F2EE] text-[#232946] rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 pt-2 pb-3 border-t border-[#E7E7E2] space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map((p) => (
                <button key={p} onClick={() => handleAsk(p)} className="text-[11px] px-2 py-1 rounded-full border border-[#DCDCE6] text-[#6B6F8A] hover:border-[#5B5FEF] hover:text-[#5B5FEF] transition-colors">
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk(input)}
                placeholder="Ask any DSA question..."
                className="flex-1 text-[13px] px-3 py-2 rounded-lg border border-[#DCDCE6] focus:outline-none focus:border-[#5B5FEF] bg-white"
              />
              <button onClick={() => handleAsk(input)} className="p-2 rounded-lg text-white shrink-0" style={{ background: ACCENT }}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* CENTER: CANVAS */}
        <div className="flex-1 flex flex-col min-w-0">
          {mode === "teach" && <TeachToolbar />}
          <div className="flex-1 relative p-6 flex items-center justify-center">
            {!lesson && mode === "learn" ? (
              <EmptyCanvas onDemo={() => loadLesson("second-max", "Launching Demo Mode.")} />
            ) : (
              <div className="w-full max-w-3xl space-y-6">
                {canvasState.array && (
                  <Panel label="Array">
                    <ArrayCanvas arr={canvasState.array} bounds={canvasState.bounds} />
                  </Panel>
                )}
                {canvasState.tree && (
                  <Panel label="Binary Search Tree">
                    <TreeCanvas tree={canvasState.tree} />
                  </Panel>
                )}
                {canvasState.linkedList && (
                  <Panel label="Linked List">
                    <LinkedListCanvas ll={canvasState.linkedList} />
                  </Panel>
                )}
                {Object.keys(canvasState.variables).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(canvasState.variables).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E7E7E2] text-[13px]">
                        <span className="text-[#9498B3] font-mono">{k} =</span>
                        <span className="font-semibold" style={{ color: ACCENT }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {canvasState.compareText && (
                  <div className="text-[13px] text-[#6B6F8A] font-mono px-3 py-1.5 rounded-lg bg-[#FBF6EC] border border-[#F0E4C8] inline-block" style={{ color: WARN }}>
                    {canvasState.compareText}
                  </div>
                )}
                {canvasState.message && (
                  <div className="flex items-center gap-2 text-[14px] font-medium px-4 py-2.5 rounded-lg" style={{ background: "#EAFAF3", color: GOOD }}>
                    <CheckCircle2 size={16} /> {canvasState.message}
                  </div>
                )}
              </div>
            )}

            {mode === "learn" && currentStep?.pause && (
              <QuestionOverlay
                step={currentStep}
                answer={answeredForStep[stepIndex]}
                onAnswer={handleAnswer}
              />
            )}
          </div>
        </div>

        {/* RIGHT: CODE + STATE */}
        <div className="w-[300px] border-l border-[#E7E7E2] flex flex-col bg-white/50 shrink-0">
          <div className="px-4 py-3 border-b border-[#E7E7E2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 size={15} color={ACCENT} />
              <span className="text-[13px] font-semibold">Code</span>
            </div>
            <div className="flex text-[11px] rounded-md overflow-hidden border border-[#DCDCE6]">
              {["javascript", "cpp"].map((l) => (
                <button key={l} onClick={() => setLanguage(l)} className={`px-2 py-1 font-medium ${language === l ? "bg-[#232946] text-white" : "bg-white text-[#6B6F8A]"}`}>
                  {l === "javascript" ? "JS" : "C++"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {lesson ? (
              <pre className="text-[12px] font-mono leading-[1.9] px-3 py-3">
                {codeLines.map((line, i) => (
                  <div key={i} className={`px-2 -mx-2 rounded ${activeCodeLine === i + 1 ? "bg-[#EEF0FD]" : ""}`}>
                    <span className="text-[#B8BAD0] select-none mr-3">{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: activeCodeLine === i + 1 ? ACCENT : INK }}>{line}</span>
                  </div>
                ))}
              </pre>
            ) : (
              <div className="px-4 py-6 text-[12.5px] text-[#9498B3]">Code appears here once a lesson is loaded.</div>
            )}
          </div>
          {lesson && (
            <div className="border-t border-[#E7E7E2] px-4 py-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-[#9498B3] font-medium">Step {stepIndex + 1} of {totalSteps}</div>
              <div className="text-[12.5px] leading-relaxed text-[#4A4E68]">{currentStep?.explanation || (currentStep?.pause ? "Answer the question on the canvas to continue." : "")}</div>
              {complexity && (
                <div className="flex gap-2 pt-1">
                  <span className="text-[11px] font-mono px-2 py-1 rounded bg-[#F2F2EE]">Time {complexity.time}</span>
                  <span className="text-[11px] font-mono px-2 py-1 rounded bg-[#F2F2EE]">Space {complexity.space}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="h-14 border-t border-[#E7E7E2] bg-white/70 backdrop-blur flex items-center gap-3 px-5 shrink-0">
        <button onClick={prev} disabled={!lesson || stepIndex === 0} className="p-2 rounded-md text-[#4A4E68] hover:bg-[#F2F2EE] disabled:opacity-30"><SkipBack size={16} /></button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={!lesson || (isPaused && !playing)}
          className="p-2.5 rounded-full text-white disabled:opacity-30"
          style={{ background: ACCENT }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={next} disabled={!lesson || isPaused || stepIndex >= totalSteps - 1} className="p-2 rounded-md text-[#4A4E68] hover:bg-[#F2F2EE] disabled:opacity-30"><SkipForward size={16} /></button>
        <button onClick={reset} disabled={!lesson} className="p-2 rounded-md text-[#4A4E68] hover:bg-[#F2F2EE] disabled:opacity-30"><RotateCcw size={16} /></button>

        <div className="h-5 w-px bg-[#E7E7E2] mx-1" />

        <div className="flex items-center gap-1.5 text-[12px] text-[#6B6F8A]">
          <Gauge size={13} />
          {[0.5, 1, 2].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`px-1.5 py-0.5 rounded font-medium ${speed === s ? "bg-[#232946] text-white" : "hover:bg-[#F2F2EE]"}`}>{s}×</button>
          ))}
        </div>

        <div className="flex-1" />

        {lesson && (
          <div className="w-40 h-1.5 rounded-full bg-[#E7E7E2] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%`, background: ACCENT }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ label, children }) {
  return (
    <div className="bg-white border border-[#E7E7E2] rounded-2xl p-4 shadow-[0_1px_2px_rgba(35,41,70,0.04)]">
      <div className="text-[11px] uppercase tracking-wide text-[#9498B3] font-medium mb-1">{label}</div>
      <div className="h-[190px]">{children}</div>
    </div>
  );
}

function EmptyCanvas({ onDemo }) {
  return (
    <div className="text-center max-w-sm">
      <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: ACCENT_SOFT }}>
        <Box size={22} color={ACCENT} />
      </div>
      <h2 className="text-[16px] font-semibold text-[#232946] mb-1.5">The canvas is empty — for now</h2>
      <p className="text-[13px] text-[#6B6F8A] leading-relaxed mb-4">
        Ask the AI teacher a question on the left, or jump straight into the flagship lesson.
      </p>
      <button onClick={onDemo} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white" style={{ background: ACCENT }}>
        Start Demo Mode
      </button>
    </div>
  );
}

function QuestionOverlay({ step, answer, onAnswer }) {
  const q = step.question;
  return (
    <div className="absolute inset-x-6 bottom-6 bg-white border border-[#E7E7E2] rounded-2xl shadow-lg p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium mb-2" style={{ color: ACCENT }}>
        <GraduationCap size={13} /> Your turn
      </div>
      <div className="text-[13.5px] text-[#232946] mb-3 leading-relaxed">{q.prompt}</div>
      <div className="grid grid-cols-2 gap-2">
        {q.choices.map((c) => {
          const chosen = answer?.choiceId === c.id;
          const showCorrect = answer && c.id === q.correctId;
          return (
            <button
              key={c.id}
              disabled={!!answer}
              onClick={() => onAnswer(c.id)}
              className={`text-left text-[12.5px] px-3 py-2 rounded-lg border transition-colors ${
                showCorrect
                  ? "border-[#1E9E76] bg-[#EAFAF3] text-[#1E9E76]"
                  : chosen
                  ? "border-[#C97A2B] bg-[#FBF6EC] text-[#C97A2B]"
                  : "border-[#DCDCE6] text-[#4A4E68] hover:border-[#5B5FEF]"
              } ${answer ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="flex items-center gap-1.5">
                {showCorrect && <CheckCircle2 size={13} />}
                {chosen && !showCorrect && <XCircle size={13} />}
                {c.text}
              </span>
            </button>
          );
        })}
      </div>
      {answer && <div className="text-[11.5px] text-[#9498B3] mt-2.5">See the AI Teacher panel for the full explanation · press Next to continue</div>}
    </div>
  );
}

const TEACH_TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "array", icon: Layers, label: "Array" },
  { id: "list", icon: ArrowRightLeft, label: "Linked List" },
  { id: "tree", icon: ListTree, label: "Tree" },
  { id: "variable", icon: VarIcon, label: "Variable" },
  { id: "pointer", icon: GitBranch, label: "Pointer" },
  { id: "pen", icon: Pencil, label: "Pen" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
];

function TeachToolbar() {
  const [active, setActive] = useState("select");
  return (
    <div className="border-b border-[#E7E7E2] px-4 py-2 flex items-center gap-1 bg-white/70">
      <PenLine size={13} color="#9498B3" />
      <span className="text-[11px] text-[#9498B3] mr-2">Teach Mode — build the whiteboard yourself</span>
      <div className="flex-1" />
      {TEACH_TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          title={t.label}
          className={`p-1.5 rounded-md transition-colors ${active === t.id ? "bg-[#EEF0FD] text-[#5B5FEF]" : "text-[#6B6F8A] hover:bg-[#F2F2EE]"}`}
        >
          <t.icon size={15} />
        </button>
      ))}
    </div>
  );
}
