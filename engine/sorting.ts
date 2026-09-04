import type { Lesson, LessonStep, DSLAction } from "../types/dsa";

/* ═══════════════════════════════════════════════════════════
   1. BUBBLE SORT
   ═══════════════════════════════════════════════════════════ */
export function buildBubbleSortLesson(values: number[] = [9, 4, 7, 3, 10]): Lesson {
  const arr = [...values];
  const n = arr.length;
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-bubble", values: [...arr] },
      { action: "create_variable", name: "passes", value: 0 },
      { action: "create_pointer", pointer: "i", targetIndex: 0 },
      { action: "create_pointer", pointer: "j", targetIndex: 0 },
    ],
    codeLine: "init",
    explanation: "Bubble Sort: repeatedly compare adjacent items and swap them if left > right. The largest item 'bubbles' up to the end each pass.",
  });

  let questionAdded = false;

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      const needSwap = arr[j] > arr[j + 1];

      // Comparison step
      steps.push({
        actions: [
          { action: "move_pointer", pointer: "j", targetIndex: j },
          { action: "highlight_element", indices: [j, j + 1] },
          { action: "compare", text: `Is ${arr[j]} > ${arr[j + 1]}?` },
          { action: "update_variable", name: "passes", value: i },
        ],
        codeLine: "compare",
        explanation: `Compare adjacent elements at index ${j} (${arr[j]}) and ${j + 1} (${arr[j + 1]}). ${needSwap ? "Left is greater, so swap." : "They are in order, no swap."}`,
      });

      // Insert interactive question on first required swap
      if (needSwap && !questionAdded) {
        questionAdded = true;
        steps.push({
          actions: [],
          codeLine: "compare",
          pause: true,
          explanation: "Decision point: What should happen when adjacent items are out of order?",
          question: {
            prompt: `arr[${j}] = ${arr[j]} is greater than arr[${j + 1}] = ${arr[j + 1]}. What is the next Bubble Sort action?`,
            choices: [
              { id: "a", text: `Swap arr[${j}] (${arr[j]}) and arr[${j + 1}] (${arr[j + 1]})` },
              { id: "b", text: "Ignore and continue" },
              { id: "c", text: "Reset the entire array" },
              { id: "d", text: "Reverse the array" },
            ],
            correctId: "a",
            hints: [
              "Bubble Sort ensures larger items move rightward.",
              "If the left item is larger than the right item, their positions must be exchanged.",
              "Select the swap option to proceed.",
            ],
            misconceptions: {
              b: {
                code: "SORTING_WRONG_SWAP",
                feedback: "Skipping an out-of-order pair leaves the inverted order unresolved.",
              },
              c: {
                code: "SORTING_WRONG_SWAP",
                feedback: "Resetting is unnecessary; Bubble Sort operates via local adjacent swaps.",
              },
            },
          },
        });
      }

      if (needSwap) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;

        steps.push({
          actions: [
            { action: "swap_elements", i: j, j: j + 1 },
            { action: "highlight_element", indices: [j, j + 1] },
            { action: "show_message", text: `Swapped ${arr[j + 1]} and ${arr[j]}` },
          ],
          codeLine: "swap",
          explanation: `Swapped elements at index ${j} and ${j + 1}. Now arr[${j}]=${arr[j]} and arr[${j + 1}]=${arr[j + 1]}.`,
        });
      }
    }

    // Mark sorted suffix
    steps.push({
      actions: [
        { action: "set_sorted_region", startIndex: n - 1 - i, endIndex: n - 1 },
        { action: "show_message", text: `Element ${arr[n - 1 - i]} locked into final sorted position` },
      ],
      codeLine: "loop",
      explanation: `Pass ${i + 1} complete. The largest unsorted element has bubbled to index ${n - 1 - i}.`,
    });
  }

  // Final step
  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: n - 1 },
      { action: "compare", text: null },
      { action: "show_message", text: "Bubble Sort Complete: array is fully sorted!" },
      { action: "show_complexity", time: "O(n²)", space: "O(1)" },
    ],
    codeLine: "done",
    explanation: "All passes complete. The array is fully sorted in O(n²) time using O(1) auxiliary space.",
  });

  return {
    id: "bubble-sort",
    title: "Bubble Sort",
    dataStructure: "Array",
    pattern: "Adjacent Pair Swapping",
    objective: "Sort an array by bubbling the maximum unsorted element to the end in each pass",
    difficulty: "Easy",
    steps,
    code: {
      javascript: [
        "function bubbleSort(arr) {",
        "  const n = arr.length;",
        "  for (let i = 0; i < n - 1; i++) {",
        "    for (let j = 0; j < n - i - 1; j++) {",
        "      if (arr[j] > arr[j + 1]) {",
        "        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];",
        "      }",
        "    }",
        "  }",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void bubbleSort(vector<int>& arr) {",
        "  int n = arr.size();",
        "  for (int i = 0; i < n - 1; i++) {",
        "    for (int j = 0; j < n - i - 1; j++) {",
        "      if (arr[j] > arr[j + 1]) {",
        "        swap(arr[j], arr[j + 1]);",
        "      }",
        "    }",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 2, loop: 3, compare: 5, swap: 6, done: 10 },
      cpp: { init: 2, loop: 3, compare: 5, swap: 6, done: 10 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   2. SELECTION SORT
   ═══════════════════════════════════════════════════════════ */
export function buildSelectionSortLesson(values: number[] = [29, 10, 14, 37, 13]): Lesson {
  const arr = [...values];
  const n = arr.length;
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-selection", values: [...arr] },
      { action: "create_variable", name: "minIdx", value: 0 },
      { action: "create_pointer", pointer: "i", targetIndex: 0 },
      { action: "create_pointer", pointer: "j", targetIndex: 1 },
    ],
    codeLine: "init",
    explanation: "Selection Sort: scan the unsorted suffix to find the minimum element, then swap it into index i.",
  });

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    steps.push({
      actions: [
        { action: "move_pointer", pointer: "i", targetIndex: i },
        { action: "update_variable", name: "minIdx", value: i },
        { action: "highlight_element", indices: [i] },
      ],
      codeLine: "outer",
      explanation: `Starting pass for index ${i}. Assume current minimum is at index ${i} (${arr[i]}).`,
    });

    for (let j = i + 1; j < n; j++) {
      steps.push({
        actions: [
          { action: "move_pointer", pointer: "j", targetIndex: j },
          { action: "compare", text: `Is arr[${j}] (${arr[j]}) < arr[${minIdx}] (${arr[minIdx]})?` },
        ],
        codeLine: "inner",
        explanation: `Comparing arr[${j}] (${arr[j]}) with current minimum at index ${minIdx} (${arr[minIdx]}).`,
      });

      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        steps.push({
          actions: [
            { action: "update_variable", name: "minIdx", value: minIdx },
            { action: "highlight_element", indices: [minIdx] },
            { action: "show_message", text: `New minimum found: ${arr[minIdx]} at index ${minIdx}` },
          ],
          codeLine: "updatemin",
          explanation: `Found smaller element! New minimum is index ${minIdx} (${arr[minIdx]}).`,
        });
      }
    }

    if (minIdx !== i) {
      const tmp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = tmp;

      steps.push({
        actions: [
          { action: "swap_elements", i, j: minIdx },
          { action: "set_sorted_region", startIndex: 0, endIndex: i },
          { action: "show_message", text: `Swapped minimum ${arr[i]} into index ${i}` },
        ],
        codeLine: "swap",
        explanation: `Swapped minimum element ${arr[i]} with arr[${i}]. Prefix up to index ${i} is now sorted.`,
      });
    } else {
      steps.push({
        actions: [
          { action: "set_sorted_region", startIndex: 0, endIndex: i },
          { action: "show_message", text: `arr[${i}] is already the minimum, no swap needed` },
        ],
        codeLine: "outer",
        explanation: `Element at index ${i} is already the minimum for this pass.`,
      });
    }
  }

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: n - 1 },
      { action: "show_message", text: "Selection Sort Complete!" },
      { action: "show_complexity", time: "O(n²)", space: "O(1)" },
    ],
    codeLine: "done",
    explanation: "Selection sort completed with exactly n-1 passes. Time complexity is O(n²), auxiliary space O(1).",
  });

  return {
    id: "selection-sort",
    title: "Selection Sort",
    dataStructure: "Array",
    pattern: "Minimum Element Selection",
    objective: "Sort an array by repeatedly finding the minimum element from the unsorted region",
    difficulty: "Easy",
    steps,
    code: {
      javascript: [
        "function selectionSort(arr) {",
        "  const n = arr.length;",
        "  for (let i = 0; i < n - 1; i++) {",
        "    let minIdx = i;",
        "    for (let j = i + 1; j < n; j++) {",
        "      if (arr[j] < arr[minIdx]) minIdx = j;",
        "    }",
        "    if (minIdx !== i) [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];",
        "  }",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void selectionSort(vector<int>& arr) {",
        "  int n = arr.size();",
        "  for (int i = 0; i < n - 1; i++) {",
        "    int minIdx = i;",
        "    for (int j = i + 1; j < n; j++) {",
        "      if (arr[j] < arr[minIdx]) minIdx = j;",
        "    }",
        "    if (minIdx !== i) swap(arr[i], arr[minIdx]);",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 2, outer: 3, inner: 5, updatemin: 6, swap: 8, done: 10 },
      cpp: { init: 2, outer: 3, inner: 5, updatemin: 6, swap: 8, done: 10 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   3. INSERTION SORT
   ═══════════════════════════════════════════════════════════ */
export function buildInsertionSortLesson(values: number[] = [12, 11, 13, 5, 6]): Lesson {
  const arr = [...values];
  const n = arr.length;
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-insertion", values: [...arr] },
      { action: "create_variable", name: "key", value: arr[1] },
      { action: "create_pointer", pointer: "i", targetIndex: 1 },
      { action: "set_sorted_region", startIndex: 0, endIndex: 0 },
    ],
    codeLine: "init",
    explanation: "Insertion Sort: Index 0 is trivially sorted. For each item at index i, shift larger prefix items right and insert key into place.",
  });

  for (let i = 1; i < n; i++) {
    const key = arr[i];
    let j = i - 1;

    steps.push({
      actions: [
        { action: "move_pointer", pointer: "i", targetIndex: i },
        { action: "update_variable", name: "key", value: key },
        { action: "highlight_element", indices: [i] },
        { action: "show_message", text: `Extract key = ${key} at index ${i}` },
      ],
      codeLine: "extractkey",
      explanation: `Extract element at index ${i} (${key}) as key to insert into sorted prefix [0..${i - 1}].`,
    });

    while (j >= 0 && arr[j] > key) {
      steps.push({
        actions: [
          { action: "highlight_element", indices: [j] },
          { action: "compare", text: `arr[${j}] (${arr[j]}) > key (${key})` },
        ],
        codeLine: "shiftcheck",
        explanation: `arr[${j}] (${arr[j]}) is greater than key (${key}), so shift it right to index ${j + 1}.`,
      });

      arr[j + 1] = arr[j];
      steps.push({
        actions: [
          { action: "update_array_element", index: j + 1, value: arr[j] },
          { action: "highlight_element", indices: [j + 1] },
        ],
        codeLine: "shift",
        explanation: `Shifted value ${arr[j]} into index ${j + 1}.`,
      });
      j--;
    }

    arr[j + 1] = key;
    steps.push({
      actions: [
        { action: "update_array_element", index: j + 1, value: key },
        { action: "set_sorted_region", startIndex: 0, endIndex: i },
        { action: "show_message", text: `Inserted key ${key} at index ${j + 1}` },
      ],
      codeLine: "insert",
      explanation: `Inserted key ${key} into position ${j + 1}. Prefix [0..${i}] is now sorted.`,
    });
  }

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: n - 1 },
      { action: "show_message", text: "Insertion Sort Complete!" },
      { action: "show_complexity", time: "O(n²)", space: "O(1)" },
    ],
    codeLine: "done",
    explanation: "Insertion Sort complete. Efficient O(n) on nearly sorted data, O(n²) worst case.",
  });

  return {
    id: "insertion-sort",
    title: "Insertion Sort",
    dataStructure: "Array",
    pattern: "Incremental Sorted Prefix",
    objective: "Sort an array by inserting each element into its correct place in the sorted prefix",
    difficulty: "Easy",
    steps,
    code: {
      javascript: [
        "function insertionSort(arr) {",
        "  for (let i = 1; i < arr.length; i++) {",
        "    let key = arr[i];",
        "    let j = i - 1;",
        "    while (j >= 0 && arr[j] > key) {",
        "      arr[j + 1] = arr[j];",
        "      j--;",
        "    }",
        "    arr[j + 1] = key;",
        "  }",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void insertionSort(vector<int>& arr) {",
        "  for (int i = 1; i < arr.size(); i++) {",
        "    int key = arr[i];",
        "    int j = i - 1;",
        "    while (j >= 0 && arr[j] > key) {",
        "      arr[j + 1] = arr[j];",
        "      j--;",
        "    }",
        "    arr[j + 1] = key;",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, extractkey: 3, shiftcheck: 5, shift: 6, insert: 9, done: 11 },
      cpp: { init: 1, extractkey: 3, shiftcheck: 5, shift: 6, insert: 9, done: 11 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   4. QUICK SORT
   ═══════════════════════════════════════════════════════════ */
export function buildQuickSortLesson(values: number[] = [8, 3, 5, 1, 9, 2]): Lesson {
  const arr = [...values];
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-quick", values: [...arr] },
      { action: "create_variable", name: "pivot", value: arr[arr.length - 1] },
      { action: "create_pointer", pointer: "i", targetIndex: -1 },
      { action: "create_pointer", pointer: "j", targetIndex: 0 },
    ],
    codeLine: "init",
    explanation: "Quick Sort: Partition around a pivot element. Elements smaller than pivot go left; elements larger go right.",
  });

  function partition(low: number, high: number): number {
    const pivot = arr[high];
    steps.push({
      actions: [
        { action: "update_variable", name: "pivot", value: pivot },
        { action: "highlight_element", indices: [high] },
        { action: "show_message", text: `Partitioning window [${low}..${high}], pivot = ${pivot}` },
      ],
      codeLine: "choosepivot",
      explanation: `Selected pivot = ${pivot} at index ${high}. Partitioning subarray [${low}..${high}].`,
    });

    let i = low - 1;
    for (let j = low; j < high; j++) {
      steps.push({
        actions: [
          { action: "move_pointer", pointer: "j", targetIndex: j },
          { action: "compare", text: `Is arr[${j}] (${arr[j]}) < pivot (${pivot})?` },
        ],
        codeLine: "compare",
        explanation: `Comparing arr[${j}] (${arr[j]}) with pivot (${pivot}).`,
      });

      if (arr[j] < pivot) {
        i++;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;

        steps.push({
          actions: [
            { action: "move_pointer", pointer: "i", targetIndex: i },
            { action: "swap_elements", i, j },
            { action: "show_message", text: `Swapped arr[${i}] and arr[${j}] to place smaller element on left` },
          ],
          codeLine: "swap",
          explanation: `arr[${j}] is smaller than pivot. Advanced i to ${i} and swapped arr[${i}] with arr[${j}].`,
        });
      }
    }

    // Place pivot into correct position
    const pIdx = i + 1;
    const tmp = arr[pIdx];
    arr[pIdx] = arr[high];
    arr[high] = tmp;

    steps.push({
      actions: [
        { action: "swap_elements", i: pIdx, j: high },
        { action: "highlight_element", indices: [pIdx] },
        { action: "show_message", text: `Pivot ${pivot} placed into its final sorted position at index ${pIdx}` },
      ],
      codeLine: "placepivot",
      explanation: `Placed pivot ${pivot} into its exact sorted position at index ${pIdx}.`,
    });

    return pIdx;
  }

  function qsort(low: number, high: number) {
    if (low < high) {
      const pi = partition(low, high);
      qsort(low, pi - 1);
      qsort(pi + 1, high);
    }
  }

  qsort(0, arr.length - 1);

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: arr.length - 1 },
      { action: "show_message", text: "Quick Sort Complete: array fully partitioned and sorted!" },
      { action: "show_complexity", time: "O(n log n)", space: "O(log n)" },
    ],
    codeLine: "done",
    explanation: "Quick Sort complete. Average time O(n log n), worst-case O(n²), in-place auxiliary space O(log n).",
  });

  return {
    id: "quick-sort",
    title: "Quick Sort",
    dataStructure: "Array",
    pattern: "Partitioning & Divide-and-Conquer",
    objective: "Sort an array by partitioning elements around a pivot and recursing",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function quickSort(arr, low = 0, high = arr.length - 1) {",
        "  if (low < high) {",
        "    let pi = partition(arr, low, high);",
        "    quickSort(arr, low, pi - 1);",
        "    quickSort(arr, pi + 1, high);",
        "  }",
        "  return arr;",
        "}",
        "function partition(arr, low, high) {",
        "  let pivot = arr[high];",
        "  let i = low - 1;",
        "  for (let j = low; j < high; j++) {",
        "    if (arr[j] < pivot) {",
        "      i++;",
        "      [arr[i], arr[j]] = [arr[j], arr[i]];",
        "    }",
        "  }",
        "  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];",
        "  return i + 1;",
        "}",
      ],
      cpp: [
        "void quickSort(vector<int>& arr, int low, int high) {",
        "  if (low < high) {",
        "    int pi = partition(arr, low, high);",
        "    quickSort(arr, low, pi - 1);",
        "    quickSort(arr, pi + 1, high);",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, choosepivot: 10, compare: 13, swap: 15, placepivot: 18, done: 7 },
      cpp: { init: 1, choosepivot: 2, compare: 3, swap: 4, placepivot: 5, done: 6 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   5. MERGE SORT
   ═══════════════════════════════════════════════════════════ */
export function buildMergeSortLesson(values: number[] = [38, 27, 43, 3, 9, 82, 10]): Lesson {
  const arr = [...values];
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-merge", values: [...arr] },
      { action: "show_message", text: "Merge Sort: Divide array into halves recursively, then merge sorted halves." },
    ],
    codeLine: "init",
    explanation: "Merge Sort divides the array in half until single-element subarrays remain, then merges pairs in sorted order.",
  });

  function merge(l: number, m: number, r: number) {
    const left = arr.slice(l, m + 1);
    const right = arr.slice(m + 1, r + 1);

    steps.push({
      actions: [
        { action: "highlight_element", indices: Array.from({ length: r - l + 1 }, (_, k) => l + k) },
        { action: "show_message", text: `Merging [${left.join(", ")}] and [${right.join(", ")}]` },
      ],
      codeLine: "merge",
      explanation: `Merging left sorted subarray [${left.join(", ")}] with right sorted subarray [${right.join(", ")}].`,
    });

    let i = 0, j = 0, k = l;
    while (i < left.length && j < right.length) {
      if (left[i] <= right[j]) {
        arr[k] = left[i];
        steps.push({
          actions: [
            { action: "update_array_element", index: k, value: left[i] },
            { action: "highlight_element", indices: [k] },
          ],
          codeLine: "mergecompare",
          explanation: `left[${i}] (${left[i]}) ≤ right[${j}] (${right[j]}). Place ${left[i]} at index ${k}.`,
        });
        i++;
      } else {
        arr[k] = right[j];
        steps.push({
          actions: [
            { action: "update_array_element", index: k, value: right[j] },
            { action: "highlight_element", indices: [k] },
          ],
          codeLine: "mergecompare",
          explanation: `right[${j}] (${right[j]}) < left[${i}] (${left[i]}). Place ${right[j]} at index ${k}.`,
        });
        j++;
      }
      k++;
    }

    while (i < left.length) {
      arr[k] = left[i];
      steps.push({
        actions: [{ action: "update_array_element", index: k, value: left[i] }],
        codeLine: "copyremain",
        explanation: `Copy remaining element ${left[i]} to index ${k}.`,
      });
      i++;
      k++;
    }

    while (j < right.length) {
      arr[k] = right[j];
      steps.push({
        actions: [{ action: "update_array_element", index: k, value: right[j] }],
        codeLine: "copyremain",
        explanation: `Copy remaining element ${right[j]} to index ${k}.`,
      });
      j++;
      k++;
    }
  }

  function sort(l: number, r: number) {
    if (l < r) {
      const m = Math.floor((l + r) / 2);
      sort(l, m);
      sort(m + 1, r);
      merge(l, m, r);
    }
  }

  sort(0, arr.length - 1);

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: arr.length - 1 },
      { action: "show_message", text: "Merge Sort Complete!" },
      { action: "show_complexity", time: "O(n log n)", space: "O(n)" },
    ],
    codeLine: "done",
    explanation: "Merge Sort complete. Guaranteed O(n log n) runtime across all best, average, and worst cases.",
  });

  return {
    id: "merge-sort",
    title: "Merge Sort",
    dataStructure: "Array",
    pattern: "Divide-and-Conquer Merging",
    objective: "Sort an array by recursively splitting into halves and merging sorted results",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function mergeSort(arr, l = 0, r = arr.length - 1) {",
        "  if (l >= r) return;",
        "  const m = Math.floor((l + r) / 2);",
        "  mergeSort(arr, l, m);",
        "  mergeSort(arr, m + 1, r);",
        "  merge(arr, l, m, r);",
        "}",
      ],
      cpp: [
        "void mergeSort(vector<int>& arr, int l, int r) {",
        "  if (l >= r) return;",
        "  int m = l + (r - l) / 2;",
        "  mergeSort(arr, l, m);",
        "  mergeSort(arr, m + 1, r);",
        "  merge(arr, l, m, r);",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, merge: 6, mergecompare: 6, copyremain: 6, done: 2 },
      cpp: { init: 1, merge: 6, mergecompare: 6, copyremain: 6, done: 2 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   6. HEAP SORT
   ═══════════════════════════════════════════════════════════ */
export function buildHeapSortLesson(values: number[] = [12, 11, 13, 5, 6, 7]): Lesson {
  const arr = [...values];
  const n = arr.length;
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-heap", values: [...arr] },
      { action: "show_message", text: "Heap Sort: Phase 1 build max heap, Phase 2 repeatedly swap root to end." },
    ],
    codeLine: "init",
    explanation: "Heap Sort transforms the array into a max heap, then extracts the maximum element to the end one by one.",
  });

  function heapify(size: number, i: number) {
    let largest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;

    if (l < size && arr[l] > arr[largest]) largest = l;
    if (r < size && arr[r] > arr[largest]) largest = r;

    if (largest !== i) {
      const tmp = arr[i];
      arr[i] = arr[largest];
      arr[largest] = tmp;

      steps.push({
        actions: [
          { action: "swap_elements", i, j: largest },
          { action: "show_message", text: `Heapify: swapped ${arr[largest]} with child ${arr[i]}` },
        ],
        codeLine: "heapify",
        explanation: `Sift down: element at index ${i} violated heap property. Swapped with child at ${largest}.`,
      });

      heapify(size, largest);
    }
  }

  // Phase 1: Build heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(n, i);
  }

  steps.push({
    actions: [{ action: "show_message", text: "Max heap constructed! Root arr[0] is the maximum element." }],
    codeLine: "buildheap",
    explanation: "Array is now a valid Max Heap: arr[i] >= arr[2i+1] and arr[i] >= arr[2i+2].",
  });

  // Phase 2: Extract elements
  for (let i = n - 1; i > 0; i--) {
    const tmp = arr[0];
    arr[0] = arr[i];
    arr[i] = tmp;

    steps.push({
      actions: [
        { action: "swap_elements", i: 0, j: i },
        { action: "set_sorted_region", startIndex: i, endIndex: n - 1 },
        { action: "show_message", text: `Extracted max ${arr[i]} to index ${i}` },
      ],
      codeLine: "extract",
      explanation: `Moved maximum element ${arr[i]} to final position index ${i}. Re-heapify remaining ${i} items.`,
    });

    heapify(i, 0);
  }

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: n - 1 },
      { action: "show_message", text: "Heap Sort Complete!" },
      { action: "show_complexity", time: "O(n log n)", space: "O(1)" },
    ],
    codeLine: "done",
    explanation: "Heap Sort complete: in-place O(1) space with guaranteed O(n log n) time.",
  });

  return {
    id: "heap-sort",
    title: "Heap Sort",
    dataStructure: "Heap",
    pattern: "Binary Heap In-Place Selection",
    objective: "Sort an array by building a max heap and repeatedly moving the root to the end",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function heapSort(arr) {",
        "  const n = arr.length;",
        "  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(arr, n, i);",
        "  for (let i = n - 1; i > 0; i--) {",
        "    [arr[0], arr[i]] = [arr[i], arr[0]];",
        "    heapify(arr, i, 0);",
        "  }",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void heapSort(vector<int>& arr) {",
        "  int n = arr.size();",
        "  for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);",
        "  for (int i = n - 1; i > 0; i--) {",
        "    swap(arr[0], arr[i]);",
        "    heapify(arr, i, 0);",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, buildheap: 3, extract: 5, heapify: 6, done: 8 },
      cpp: { init: 1, buildheap: 3, extract: 5, heapify: 6, done: 8 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   7. COUNTING SORT
   ═══════════════════════════════════════════════════════════ */
export function buildCountingSortLesson(values: number[] = [4, 2, 2, 8, 3, 3, 1]): Lesson {
  const arr = [...values];
  const maxVal = Math.max(...arr);
  const count = new Array(maxVal + 1).fill(0);
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-count", values: [...arr] },
      { action: "show_message", text: `Counting Sort: Non-comparison integer sort over range [0..${maxVal}].` },
    ],
    codeLine: "init",
    explanation: "Counting Sort counts distinct value occurrences and reconstructs the sorted output without pairwise comparisons.",
  });

  // Count frequencies
  for (let i = 0; i < arr.length; i++) {
    count[arr[i]]++;
    steps.push({
      actions: [
        { action: "highlight_element", indices: [i] },
        { action: "show_message", text: `Count frequency of ${arr[i]} (now ${count[arr[i]]})` },
      ],
      codeLine: "count",
      explanation: `Counted occurrence of value ${arr[i]}. Total frequency is ${count[arr[i]]}.`,
    });
  }

  // Reconstruct array
  let outIdx = 0;
  for (let num = 0; num <= maxVal; num++) {
    while (count[num] > 0) {
      arr[outIdx] = num;
      steps.push({
        actions: [
          { action: "update_array_element", index: outIdx, value: num },
          { action: "set_sorted_region", startIndex: 0, endIndex: outIdx },
        ],
        codeLine: "reconstruct",
        explanation: `Placed value ${num} at output index ${outIdx}.`,
      });
      outIdx++;
      count[num]--;
    }
  }

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: arr.length - 1 },
      { action: "show_message", text: "Counting Sort Complete!" },
      { action: "show_complexity", time: "O(n + k)", space: "O(k)" },
    ],
    codeLine: "done",
    explanation: "Counting Sort completed in linear time O(n + k) where k is the value range.",
  });

  return {
    id: "counting-sort",
    title: "Counting Sort",
    dataStructure: "Array",
    pattern: "Frequency Counting Distribution",
    objective: "Sort an array of bounded integers in linear time by tallying counts",
    difficulty: "Easy",
    steps,
    code: {
      javascript: [
        "function countingSort(arr) {",
        "  const max = Math.max(...arr);",
        "  const count = new Array(max + 1).fill(0);",
        "  for (const num of arr) count[num]++;",
        "  let idx = 0;",
        "  for (let num = 0; num <= max; num++) {",
        "    while (count[num]-- > 0) arr[idx++] = num;",
        "  }",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void countingSort(vector<int>& arr) {",
        "  int maxVal = *max_element(arr.begin(), arr.end());",
        "  vector<int> count(maxVal + 1, 0);",
        "  for (int num : arr) count[num]++;",
        "  int idx = 0;",
        "  for (int num = 0; num <= maxVal; num++) {",
        "    while (count[num]-- > 0) arr[idx++] = num;",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, count: 4, reconstruct: 7, done: 9 },
      cpp: { init: 1, count: 4, reconstruct: 7, done: 9 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   8. RADIX SORT
   ═══════════════════════════════════════════════════════════ */
export function buildRadixSortLesson(values: number[] = [170, 45, 75, 90, 802, 24, 2, 66]): Lesson {
  const arr = [...values];
  const maxVal = Math.max(...arr);
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-radix", values: [...arr] },
      { action: "show_message", text: "Radix Sort: Sort numbers digit by digit from LSD (1s) to MSD." },
    ],
    codeLine: "init",
    explanation: "Radix Sort processes digits place by place using stable counting sort on each digit.",
  });

  for (let exp = 1; Math.floor(maxVal / exp) > 0; exp *= 10) {
    steps.push({
      actions: [{ action: "show_message", text: `Sorting by digit place: ${exp}s place` }],
      codeLine: "pass",
      explanation: `Pass for digit position ${exp} (units/tens/hundreds). Distribute into 10 buckets (0-9).`,
    });

    const output = new Array(arr.length).fill(0);
    const count = new Array(10).fill(0);

    for (let i = 0; i < arr.length; i++) {
      const digit = Math.floor(arr[i] / exp) % 10;
      count[digit]++;
    }

    for (let i = 1; i < 10; i++) count[i] += count[i - 1];

    for (let i = arr.length - 1; i >= 0; i--) {
      const digit = Math.floor(arr[i] / exp) % 10;
      output[count[digit] - 1] = arr[i];
      count[digit]--;
    }

    for (let i = 0; i < arr.length; i++) {
      arr[i] = output[i];
      steps.push({
        actions: [{ action: "update_array_element", index: i, value: arr[i] }],
        codeLine: "bucket",
        explanation: `Placed ${arr[i]} into position ${i} based on ${exp}s digit sort.`,
      });
    }
  }

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: arr.length - 1 },
      { action: "show_message", text: "Radix Sort Complete!" },
      { action: "show_complexity", time: "O(d · (n + k))", space: "O(n + k)" },
    ],
    codeLine: "done",
    explanation: "Radix Sort finished in linear O(d·n) time.",
  });

  return {
    id: "radix-sort",
    title: "Radix Sort",
    dataStructure: "Array",
    pattern: "Digit-by-Digit LSD Sort",
    objective: "Sort integers digit-by-digit using stable sub-sorting passes",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function radixSort(arr) {",
        "  const max = Math.max(...arr);",
        "  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {",
        "    countSortByDigit(arr, exp);",
        "  }",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void radixSort(vector<int>& arr) {",
        "  int maxVal = *max_element(arr.begin(), arr.end());",
        "  for (int exp = 1; maxVal / exp > 0; exp *= 10) {",
        "    countSortByDigit(arr, exp);",
        "  }",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, pass: 3, bucket: 4, done: 6 },
      cpp: { init: 1, pass: 3, bucket: 4, done: 6 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   9. BUCKET SORT
   ═══════════════════════════════════════════════════════════ */
export function buildBucketSortLesson(values: number[] = [78, 17, 39, 26, 72, 94, 21, 12]): Lesson {
  const arr = [...values];
  const steps: LessonStep[] = [];

  steps.push({
    actions: [
      { action: "reset_scene" },
      { action: "create_array", id: "arr-bucket", values: [...arr] },
      { action: "show_message", text: "Bucket Sort: Distribute elements into buckets, sort each bucket, and concatenate." },
    ],
    codeLine: "init",
    explanation: "Bucket Sort partitions the input into equal-interval buckets, sorts each bucket, and merges the result.",
  });

  const bucketCount = 5;
  const maxVal = Math.max(...arr);
  const minVal = Math.min(...arr);
  const range = (maxVal - minVal + 1) / bucketCount;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);

  for (let i = 0; i < arr.length; i++) {
    const bIdx = Math.min(bucketCount - 1, Math.floor((arr[i] - minVal) / range));
    buckets[bIdx].push(arr[i]);
    steps.push({
      actions: [
        { action: "highlight_element", indices: [i] },
        { action: "show_message", text: `Scatter: element ${arr[i]} into Bucket ${bIdx}` },
      ],
      codeLine: "scatter",
      explanation: `Mapped element ${arr[i]} into bucket index ${bIdx}.`,
    });
  }

  // Sort buckets and concatenate
  let outIdx = 0;
  for (let b = 0; b < bucketCount; b++) {
    buckets[b].sort((a, c) => a - c);
    for (const val of buckets[b]) {
      arr[outIdx] = val;
      steps.push({
        actions: [
          { action: "update_array_element", index: outIdx, value: val },
          { action: "set_sorted_region", startIndex: 0, endIndex: outIdx },
        ],
        codeLine: "gather",
        explanation: `Gathered sorted value ${val} from bucket ${b} into index ${outIdx}.`,
      });
      outIdx++;
    }
  }

  steps.push({
    actions: [
      { action: "set_sorted_region", startIndex: 0, endIndex: arr.length - 1 },
      { action: "show_message", text: "Bucket Sort Complete!" },
      { action: "show_complexity", time: "O(n)", space: "O(n)" },
    ],
    codeLine: "done",
    explanation: "Bucket Sort complete: linear average O(n) performance under uniform distribution.",
  });

  return {
    id: "bucket-sort",
    title: "Bucket Sort",
    dataStructure: "Array",
    pattern: "Scatter-Gather Bucket Distribution",
    objective: "Sort uniformly distributed elements by bucketing and concatenation",
    difficulty: "Medium",
    steps,
    code: {
      javascript: [
        "function bucketSort(arr, bucketCount = 5) {",
        "  const buckets = Array.from({ length: bucketCount }, () => []);",
        "  // 1. Scatter into buckets",
        "  // 2. Sort individual buckets",
        "  // 3. Gather back into array",
        "  return arr;",
        "}",
      ],
      cpp: [
        "void bucketSort(vector<int>& arr) {",
        "  // Scatter into buckets, sort, gather",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 1, scatter: 3, gather: 5, done: 6 },
      cpp: { init: 1, scatter: 2, gather: 2, done: 3 },
    },
  };
}
