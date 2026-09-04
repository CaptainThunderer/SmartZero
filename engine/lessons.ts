import type { Lesson, LessonStep, TreeNode } from "../types/dsa";

const fmt = (n: number) => (n === -Infinity ? "−∞" : String(n));

/* ═══════════════════════════════════════════════════════════
   SECOND MAXIMUM — Flagship Demo Lesson
   Input: [10, 5, 20, 8, 15]
   ═══════════════════════════════════════════════════════════ */
export function buildSecondMaxLesson(
  values: number[] = [10, 5, 20, 8, 15]
): Lesson {
  const steps: LessonStep[] = [];
  let max = -Infinity;
  let second = -Infinity;

  // Step 0: Initialize
  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr1", values },
      { action: "create_variable", name: "max", value: "−∞" },
      { action: "create_variable", name: "secondMax", value: "−∞" },
      { action: "create_pointer", pointer: "i", targetIndex: 0 },
    ],
    codeLine: "init",
    explanation:
      "We'll scan the array once, tracking the two largest values seen so far. max and secondMax start at −∞.",
  });

  values.forEach((value, i) => {
    // Move pointer and compare
    steps.push({
      actions: [
        { action: "move_pointer", pointer: "i", targetIndex: i },
        { action: "highlight_element", indices: [i] },
        { action: "compare", text: `Is ${value} > max (${fmt(max)})?` },
      ],
      codeLine: "loopcheck",
      explanation: `Pointer i moves to index ${i}. Current value is ${value}. We compare it with max (${fmt(max)}).`,
    });

    // Learner question at index 2 (value 20)
    if (i === 2) {
      steps.push({
        actions: [],
        codeLine: "loopcheck",
        pause: true,
        explanation:
          "This is a critical decision point. What should happen when the new value is larger than the current maximum?",
        question: {
          prompt: `We're at value ${value}. max is ${fmt(max)} and secondMax is ${fmt(second)}. What should happen?`,
          choices: [
            {
              id: "a",
              text: `Update max to ${value} and move old max (${fmt(max)}) into secondMax`,
            },
            { id: "b", text: `Ignore ${value} because max already exists` },
            { id: "c", text: `Set secondMax to ${value}` },
            { id: "d", text: "Reset both variables" },
          ],
          correctId: "a",
          hints: [
            `Compare ${value} with the current max (${fmt(max)}). Which one is bigger?`,
            `If ${value} becomes the new max, what happens to the old max value?`,
            `The old max (${fmt(max)}) becomes the secondMax, and max becomes ${value}.`,
          ],
          misconceptions: {
            b: {
              code: "SECONDMAX_MAX_CONFUSION",
              feedback: `${value} is greater than the current max (${fmt(max)}). When we find a new maximum, the old max becomes the secondMax, and max updates to ${value}.`,
            },
            c: {
              code: "SECONDMAX_MAX_CONFUSION",
              feedback: `${value} beats the current max (${fmt(max)}), so it should become the NEW max — not secondMax. The old max slides down to become secondMax.`,
            },
            d: {
              code: "INCORRECT_COMPARISON",
              feedback: `We never reset both variables. ${value} > ${fmt(max)}, so max becomes ${value} and the old max becomes secondMax.`,
            },
          },
        },
      });
    }

    const newMax = value > max;
    if (newMax) {
      second = max;
      max = value;
    } else if (value > second && value !== max) {
      second = value;
    }

    steps.push({
      actions: [
        { action: "update_variable", name: "max", value: fmt(max) },
        { action: "update_variable", name: "secondMax", value: fmt(second) },
        { action: "compare", text: null },
      ],
      codeLine: newMax ? "ifbranch" : "elsebranch",
      explanation: newMax
        ? `${value} is the new maximum. The old max (${fmt(second)}) becomes secondMax.`
        : value > second && value !== max
          ? `${value} is not larger than max (${fmt(max)}), but it's larger than secondMax, so secondMax updates to ${value}.`
          : `${value} changes neither max nor secondMax.`,
    });
  });

  // Final step
  steps.push({
    actions: [
      { action: "highlight_element", indices: [] },
      {
        action: "show_message",
        text: `Done! The second maximum element is ${second}.`,
      },
      { action: "show_complexity", time: "O(n)", space: "O(1)" },
    ],
    codeLine: "return",
    explanation: `We scanned every element once in a single pass. The second maximum is ${second}. Time complexity is O(n), space is O(1).`,
  });

  return {
    id: "second-max",
    title: "Find the Second Maximum Element",
    dataStructure: "Array",
    pattern: "Single-pass linear scan",
    objective: "Track the two largest values in one pass.",
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
      javascript: {
        init: 2,
        loopcheck: 3,
        ifbranch: 4,
        elsebranch: 7,
        return: 11,
      },
      cpp: {
        init: 2,
        loopcheck: 3,
        ifbranch: 4,
        elsebranch: 7,
        return: 11,
      },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   BINARY SEARCH
   Input: [10,20,30,40,50,60,70,80], target = 60
   ═══════════════════════════════════════════════════════════ */
export function buildBinarySearchLesson(
  values: number[] = [10, 20, 30, 40, 50, 60, 70, 80],
  target = 60
): Lesson {
  const steps: LessonStep[] = [];
  let low = 0;
  let high = values.length - 1;

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr1", values },
      { action: "create_variable", name: "target", value: target },
      {
        action: "set_bounds",
        low,
        mid: Math.floor((low + high) / 2),
        high,
      },
    ],
    codeLine: "init",
    explanation: `We want to find ${target} in this sorted array. Binary search eliminates half the search space each step.`,
  });

  let guard = 0;
  let dimmedSoFar: number[] = [];
  while (low <= high && guard++ < 20) {
    const mid = Math.floor((low + high) / 2);
    const value = values[mid];

    const stepActions: LessonStep["actions"] = [
      { action: "set_bounds", low, mid, high },
      { action: "highlight_element", indices: [mid] },
      {
        action: "compare",
        text: `arr[${mid}] = ${value}, target = ${target}`,
      },
    ];
    if (dimmedSoFar.length > 0) {
      stepActions.push({ action: "dim_elements", indices: [...dimmedSoFar] });
    }

    steps.push({
      actions: stepActions,
      codeLine: "mid",
      explanation: `mid = ${mid}; the middle value is ${value}. Compare with target ${target}.`,
    });

    if (value === target) {
      steps.push({
        actions: [
          {
            action: "show_message",
            text: `Found ${target} at index ${mid}!`,
          },
          { action: "show_complexity", time: "O(log n)", space: "O(1)" },
        ],
        codeLine: "found",
        explanation: `The middle value equals the target. Found ${target} at index ${mid}! Binary search has O(log n) time complexity.`,
      });
      break;
    }

    const eliminateLeft = value < target;
    steps.push({
      actions: [],
      codeLine: "compare",
      pause: true,
      explanation:
        "The array is sorted. Based on the comparison, which half should we keep searching?",
      question: {
        prompt: `arr[mid] = ${value} and target = ${target}. Which half can still contain the target?`,
        choices: [
          { id: "left", text: "Left half (smaller values)" },
          { id: "right", text: "Right half (larger values)" },
          { id: "both", text: "Both halves" },
          { id: "neither", text: "Neither" },
        ],
        correctId: eliminateLeft ? "right" : "left",
        hints: [
          "The array is sorted in ascending order.",
          `If ${value} ${eliminateLeft ? "<" : ">"} ${target}, which side has ${eliminateLeft ? "larger" : "smaller"} values?`,
          `Keep the ${eliminateLeft ? "right" : "left"} half where ${target} could be.`,
        ],
        misconceptions: {
          [eliminateLeft ? "left" : "right"]: {
            code: "BINARY_SEARCH_WRONG_HALF",
            feedback: eliminateLeft
              ? `${value} < ${target}. Since the array is sorted, ${target} must be in the RIGHT half (larger values). We move low to mid + 1.`
              : `${value} > ${target}. Since the array is sorted, ${target} must be in the LEFT half (smaller values). We move high to mid - 1.`,
          },
          both: {
            code: "BINARY_SEARCH_WRONG_HALF",
            feedback: `The whole point of binary search is eliminating half! Since ${value} ${eliminateLeft ? "<" : ">"} ${target}, only one half can contain it.`,
          },
          neither: {
            code: "BINARY_SEARCH_WRONG_HALF",
            feedback: `The target ${target} IS in this array. Since ${value} ${eliminateLeft ? "<" : ">"} ${target}, we know it's in the ${eliminateLeft ? "right" : "left"} half.`,
          },
        },
      },
    });

    // Dim eliminated elements
    if (eliminateLeft) {
      for (let d = low; d <= mid; d++) dimmedSoFar.push(d);
      low = mid + 1;
    } else {
      for (let d = mid; d <= high; d++) dimmedSoFar.push(d);
      high = mid - 1;
    }

    steps.push({
      actions: [
        {
          action: "set_bounds",
          low,
          mid: low <= high ? Math.floor((low + high) / 2) : low,
          high,
        },
        { action: "dim_elements", indices: [...dimmedSoFar] },
      ],
      codeLine: eliminateLeft ? "moveLow" : "moveHigh",
      explanation: eliminateLeft
        ? `Eliminate the left half. Move low to ${low}. The search space shrinks.`
        : `Eliminate the right half. Move high to ${high}. The search space shrinks.`,
    });
  }

  return {
    id: "binary-search",
    title: "Binary Search",
    dataStructure: "Array",
    pattern: "Divide and conquer",
    objective: "Eliminate half the search space each step.",
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
      javascript: {
        init: 2,
        mid: 4,
        compare: 5,
        found: 5,
        moveLow: 6,
        moveHigh: 7,
      },
      cpp: {
        init: 2,
        mid: 4,
        compare: 5,
        found: 5,
        moveLow: 6,
        moveHigh: 7,
      },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   BST INSERTION
   Insert 65 into BST: 50, 30, 70, 60, 80
   ═══════════════════════════════════════════════════════════ */
export function buildBSTLesson(insertValue = 65): Lesson {
  const nodes: TreeNode[] = [
    { id: "t50", value: 50, x: 300, y: 60, visible: true },
    { id: "t30", value: 30, x: 180, y: 150, visible: true },
    { id: "t70", value: 70, x: 420, y: 150, visible: true },
    { id: "t60", value: 60, x: 360, y: 240, visible: true },
    { id: "t80", value: 80, x: 480, y: 240, visible: true },
    { id: `t${insertValue}`, value: insertValue, x: 390, y: 330, visible: false },
  ];
  const edges: [string, string][] = [
    ["t50", "t30"],
    ["t50", "t70"],
    ["t70", "t60"],
    ["t70", "t80"],
  ];
  const path = [
    { id: "t50", value: 50, dir: "right" as const },
    { id: "t70", value: 70, dir: "left" as const },
    { id: "t60", value: 60, dir: "right" as const },
  ];

  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_tree", nodes, edges },
      ],
      codeLine: "init",
      explanation: `We need to insert ${insertValue} into this BST. We'll traverse from the root, comparing at each node to find the correct position.`,
    },
  ];

  path.forEach((node, index) => {
    const correct = insertValue < node.value ? "left" : "right";
    steps.push({
      actions: [{ action: "highlight_tree_node", id: node.id }],
      codeLine: "compare",
      explanation: `Compare ${insertValue} with node ${node.value}. ${insertValue} is ${correct === "left" ? "smaller" : "larger"} than ${node.value}.`,
    });
    steps.push({
      actions: [],
      codeLine: "compare",
      pause: true,
      explanation: "Choose the correct branch based on BST ordering.",
      question: {
        prompt: `${insertValue} vs ${node.value}. Which way should we go?`,
        choices: [
          { id: "left", text: "Go left (smaller values)" },
          { id: "right", text: "Go right (larger values)" },
        ],
        correctId: correct,
        hints: [
          `In a BST, smaller values go left and larger values go right.`,
          `Is ${insertValue} less than or greater than ${node.value}?`,
          `${insertValue} ${correct === "left" ? "<" : ">"} ${node.value}, so go ${correct}.`,
        ],
        misconceptions: {
          [correct === "left" ? "right" : "left"]: {
            code: "BST_WRONG_BRANCH",
            feedback: `${insertValue} is ${correct === "left" ? "smaller" : "larger"} than ${node.value}. In a BST, ${correct === "left" ? "smaller values go left" : "larger values go right"}.`,
          },
        },
      },
    });
    if (index === path.length - 1) {
      steps.push({
        actions: [
          {
            action: "reveal_tree_node",
            id: `t${insertValue}`,
            edge: [node.id, `t${insertValue}`],
          },
        ],
        codeLine: "insert",
        explanation: `Node ${node.value} has no ${node.dir} child, so ${insertValue} is inserted here as the ${node.dir} child of ${node.value}.`,
      });
    }
  });

  steps.push({
    actions: [
      {
        action: "show_message",
        text: `${insertValue} inserted successfully into the BST!`,
      },
      { action: "show_complexity", time: "O(h)", space: "O(1)" },
    ],
    codeLine: "done",
    explanation: `${insertValue} is now in the BST. Insertion cost is O(h) where h is the tree height. For a balanced BST, h = O(log n).`,
  });

  return {
    id: "bst-insert",
    title: `Insert ${insertValue} into a BST`,
    dataStructure: "Binary Search Tree",
    pattern: "Comparison-based descent",
    objective: "Choose the correct branch using BST ordering.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function insert(node, value) {",
        "  if (!node) return { value, left: null, right: null };",
        "  if (value < node.value)",
        "    node.left = insert(node.left, value);",
        "  else",
        "    node.right = insert(node.right, value);",
        "  return node;",
        "}",
      ],
      cpp: [
        "Node* insert(Node* node, int value) {",
        "  if (!node) return new Node(value);",
        "  if (value < node->value)",
        "    node->left = insert(node->left, value);",
        "  else",
        "    node->right = insert(node->right, value);",
        "  return node;",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, compare: 3, insert: 4, done: 7 },
      cpp: { init: 1, compare: 3, insert: 4, done: 7 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   LINKED LIST REVERSAL
   Input: [1, 2, 3, 4]
   ═══════════════════════════════════════════════════════════ */
export function buildLinkedListLesson(
  values: number[] = [1, 2, 3, 4]
): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_linked_list", values },
        { action: "move_ll_pointer", pointer: "prev", targetId: null },
        { action: "move_ll_pointer", pointer: "curr", targetId: "n0" },
      ],
      codeLine: "init",
      explanation:
        "We start with prev = null and curr pointing to the head (node 1). We'll reverse links one by one.",
    },
  ];

  for (let i = 0; i < values.length; i++) {
    // Save next
    steps.push({
      actions: [
        { action: "move_ll_pointer", pointer: "curr", targetId: `n${i}` },
        {
          action: "move_ll_pointer",
          pointer: "next",
          targetId: i + 1 < values.length ? `n${i + 1}` : null,
        },
      ],
      codeLine: "savenext",
      explanation: `Save next = ${i + 1 < values.length ? `node ${values[i + 1]}` : "null"} before we modify curr's link.`,
    });

    // Learner question at step 1 (first reversal)
    if (i === 1) {
      steps.push({
        actions: [],
        codeLine: "relink",
        pause: true,
        explanation:
          "This is the key operation in linked list reversal. What should curr.next point to?",
        question: {
          prompt: `curr is node ${values[i]}. What should curr.next point to?`,
          choices: [
            {
              id: "prev",
              text: `prev (node ${i > 0 ? values[i - 1] : "null"})`,
            },
            {
              id: "next",
              text: `next (node ${i + 1 < values.length ? values[i + 1] : "null"})`,
            },
            { id: "null", text: "null" },
            { id: "head", text: "head (node 1)" },
          ],
          correctId: "prev",
          hints: [
            "We want to REVERSE the direction of the links.",
            "Instead of pointing forward, each node should point backward.",
            "curr.next = prev — this reverses the link direction.",
          ],
          misconceptions: {
            next: {
              code: "LINKED_LIST_POINTER_CONFUSION",
              feedback:
                "curr.next already points to next. To REVERSE the list, we need curr.next to point to prev — the node behind it.",
            },
            null: {
              code: "LINKED_LIST_POINTER_CONFUSION",
              feedback:
                "Setting curr.next to null would break the chain. We set curr.next = prev to reverse the link.",
            },
            head: {
              code: "LINKED_LIST_POINTER_CONFUSION",
              feedback:
                "We don't point back to the head. We set curr.next = prev to create a backward link.",
            },
          },
        },
      });
    }

    // Relink
    steps.push({
      actions: [
        {
          action: "relink",
          order: values
            .slice(0, i + 1)
            .reverse()
            .concat(values.slice(i + 1)),
          reversedUpTo: i,
        },
      ],
      codeLine: "relink",
      explanation: `Set curr.next = prev. Node ${values[i]}'s link now points backward.`,
    });

    // Advance prev
    steps.push({
      actions: [
        { action: "move_ll_pointer", pointer: "prev", targetId: `n${i}` },
      ],
      codeLine: "advance",
      explanation: `Advance: prev moves to node ${values[i]}, curr moves to next.`,
    });
  }

  // Final
  steps.push({
    actions: [
      {
        action: "show_message",
        text: `List reversed: ${values.slice().reverse().join(" → ")}`,
      },
      { action: "show_complexity", time: "O(n)", space: "O(1)" },
    ],
    codeLine: "done",
    explanation: `The list is fully reversed: ${values.slice().reverse().join(" → ")}. We used three pointers and O(n) time, O(1) space.`,
  });

  return {
    id: "linked-list-reverse",
    title: "Reverse a Linked List",
    dataStructure: "Linked List",
    pattern: "Iterative pointer reversal",
    objective: "See prev/curr/next rewire links in place.",
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
      javascript: { init: 2, savenext: 4, relink: 5, advance: 6, done: 9 },
      cpp: { init: 2, savenext: 4, relink: 5, advance: 6, done: 9 },
    },
  };
}

import {
  buildBubbleSortLesson,
  buildSelectionSortLesson,
  buildInsertionSortLesson,
  buildMergeSortLesson,
  buildQuickSortLesson,
  buildHeapSortLesson,
  buildCountingSortLesson,
  buildRadixSortLesson,
  buildBucketSortLesson,
} from "./sorting";
import { buildBFSGraphLesson, buildDFSGraphLesson } from "./graph";
import {
  buildStackLesson,
  buildQueueLesson,
  buildHashTableLesson,
} from "./linearStructures";

/* ── Lesson Registry ── */
export function lessonFromId(id: string, customValues?: number[]): Lesson | null {
  if (id === "second-max") return buildSecondMaxLesson(customValues);
  if (id === "binary-search") return buildBinarySearchLesson();
  if (id === "bst-insert") return buildBSTLesson();
  if (id === "linked-list-reverse") return buildLinkedListLesson();

  if (id === "bubble-sort") return buildBubbleSortLesson(customValues);
  if (id === "selection-sort") return buildSelectionSortLesson(customValues);
  if (id === "insertion-sort") return buildInsertionSortLesson(customValues);
  if (id === "merge-sort") return buildMergeSortLesson(customValues);
  if (id === "quick-sort") return buildQuickSortLesson(customValues);
  if (id === "heap-sort") return buildHeapSortLesson(customValues);
  if (id === "counting-sort") return buildCountingSortLesson(customValues);
  if (id === "radix-sort") return buildRadixSortLesson(customValues);
  if (id === "bucket-sort") return buildBucketSortLesson(customValues);

  if (id === "graph-bfs") return buildBFSGraphLesson();
  if (id === "graph-dfs") return buildDFSGraphLesson();

  if (id === "stack-ops") return buildStackLesson();
  if (id === "queue-ops") return buildQueueLesson();
  if (id === "hash-table-ops") return buildHashTableLesson();

  return null;
}

export const SUPPORTED_LESSONS = [
  { id: "second-max", title: "Second Maximum Element" },
  { id: "binary-search", title: "Binary Search" },
  { id: "bst-insert", title: "BST Insertion" },
  { id: "linked-list-reverse", title: "Linked List Reversal" },
  { id: "bubble-sort", title: "Bubble Sort" },
  { id: "selection-sort", title: "Selection Sort" },
  { id: "insertion-sort", title: "Insertion Sort" },
  { id: "merge-sort", title: "Merge Sort" },
  { id: "quick-sort", title: "Quick Sort" },
  { id: "heap-sort", title: "Heap Sort" },
  { id: "counting-sort", title: "Counting Sort" },
  { id: "radix-sort", title: "Radix Sort" },
  { id: "bucket-sort", title: "Bucket Sort" },
  { id: "graph-bfs", title: "Graph BFS" },
  { id: "graph-dfs", title: "Graph DFS" },
  { id: "stack-ops", title: "Stack Operations" },
  { id: "queue-ops", title: "Queue Operations" },
  { id: "hash-table-ops", title: "Hash Table" },
] as const;
