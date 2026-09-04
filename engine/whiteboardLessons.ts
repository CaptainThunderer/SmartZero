import type { Lesson, LessonStep, CanvasState } from "../types/dsa";

/* ═══════════════════════════════════════════════════════════
   1. ARRAYS WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildArrayWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Arrays & Memory Layout", subtitle: "Contiguous memory with constant-time indexing", badge: "O(1) Access" },
        { action: "create_array", id: "arr", values: [10, 20, 30, 40] },
        { action: "show_callout", text: "Elements are stored sequentially in adjacent memory addresses.", boxType: "info" },
      ],
      codeLine: "init",
      explanation: "An array is a linear data structure that stores elements in consecutive memory locations.",
      narrative: {
        currentStep: "Array Definition & Memory Layout",
        why: "Contiguous storage allows the CPU to calculate any element's exact address in O(1) time.",
        whatChanged: "Allocated an array of 4 integers: [10, 20, 30, 40] with 0-based indices 0, 1, 2, 3.",
        whatToNotice: "Notice each index corresponds directly to memory offset: Address = Base + Index * Size.",
        keyInsight: "Direct address arithmetic eliminates the need to scan prior elements during access.",
        nextStep: "Inspect instant random access at index 2 (arr[2]).",
      },
    },
    {
      actions: [
        { action: "highlight_element", indices: [2] },
        { action: "create_pointer", pointer: "target", targetIndex: 2 },
        { action: "show_callout", text: "arr[2] = 30 accessed instantly via base_address + 2 * sizeof(int)", boxType: "success" },
      ],
      codeLine: "access",
      explanation: "Reading arr[2] calculates address directly without inspecting index 0 or 1.",
      narrative: {
        currentStep: "Constant-Time Access: arr[2]",
        why: "Random access takes O(1) time because the index directly specifies the memory offset.",
        whatChanged: "Retrieved value 30 at index 2 in a single instruction.",
        whatToNotice: "Notice index 2 was read without looking at index 0 or index 1.",
        keyInsight: "Arrays excel when fast index-based lookups are required.",
        nextStep: "Observe the cost of inserting an element into the middle.",
      },
    },
    {
      actions: [
        { action: "dim_elements", indices: [0] },
        { action: "highlight_element", indices: [1, 2, 3] },
        { action: "show_callout", text: "Inserting at index 1 requires shifting elements [20, 30, 40] right by 1 position.", boxType: "warning" },
        { action: "show_transformation", fromLabel: "[10, 20, 30, 40]", toLabel: "[10, 99, 20, 30, 40]", text: "Shift 3 elements right → O(n) work" },
      ],
      codeLine: "insert",
      explanation: "Inserting an element at index 1 forces all subsequent elements to shift right to make room.",
      narrative: {
        currentStep: "Insertion Overhead: Shifting Elements",
        why: "Contiguous memory invariants require there be no gaps between elements.",
        whatChanged: "Identified that elements at indices 1, 2, 3 must shift right to open up index 1.",
        whatToNotice: "Notice shifting n elements requires O(n) time, making middle insertions expensive.",
        keyInsight: "Fast random access comes at the tradeoff of costly insertions and deletions.",
        nextStep: "Review the overall time and space complexity guarantees.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Arrays: Summary & Complexity", subtitle: "Trade-offs between access speed and modification cost", badge: "Summary" },
        { action: "create_array", id: "arr", values: [10, 20, 30, 40] },
        { action: "show_insight_card", title: "Array Performance Profile", text: "Access: O(1) | Search: O(n) | Insertion/Deletion: O(n) due to element shifting." },
        { action: "show_complexity", time: "Access O(1), Insert O(n)", space: "O(1) auxiliary" },
      ],
      codeLine: "done",
      explanation: "Arrays provide O(1) random access but require O(n) time for arbitrary insertions and deletions.",
      narrative: {
        currentStep: "Array Invariants & Takeaway",
        why: "Choosing an array is ideal when data size is predictable and read queries dominate.",
        whatChanged: "Summarized access, search, insertion, and deletion complexity trade-offs.",
        whatToNotice: "Notice static arrays have fixed capacity; dynamic arrays resize by doubling (amortized O(1)).",
        keyInsight: "Use arrays for cache locality and fast indexing; use linked lists for cheap mid insertions.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-arrays",
    title: "Understanding Arrays",
    dataStructure: "Array",
    pattern: "Contiguous Indexing",
    objective: "Understand memory layout, instant access, and element shifting.",
    difficulty: "Beginner",
    steps,
    code: {
      javascript: [
        "const arr = [10, 20, 30, 40];",
        "const val = arr[2]; // O(1) instant access",
        "arr.splice(1, 0, 99); // O(n) requires shifting",
      ],
      cpp: [
        "vector<int> arr = {10, 20, 30, 40};",
        "int val = arr[2]; // O(1) direct offset",
        "arr.insert(arr.begin() + 1, 99); // O(n) shift",
      ],
    },
    lineMap: {
      javascript: { init: 1, access: 2, insert: 3, done: 3 },
      cpp: { init: 1, access: 2, insert: 3, done: 3 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   2. TWO POINTERS WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildTwoPointersWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Two Pointer Technique", subtitle: "Pair Sum Target = 10 on Sorted Array", badge: "O(n) Time" },
        { action: "create_array", id: "arr", values: [1, 2, 4, 6, 8, 10] },
        { action: "create_pointer", pointer: "L", targetIndex: 0 },
        { action: "create_pointer", pointer: "R", targetIndex: 5 },
        { action: "create_variable", name: "target", value: 10 },
        { action: "create_variable", name: "sum", value: "1 + 10 = 11" },
        { action: "show_callout", text: "Initial pointers at ends: L=0 (1), R=5 (10). Sum = 11 > 10 (Too large).", boxType: "warning" },
      ],
      codeLine: "init",
      explanation: "Place Left pointer at start and Right pointer at end of the sorted array.",
      narrative: {
        currentStep: "Initialize Left and Right Pointers",
        why: "Because the array is sorted in ascending order, the smallest sum is at L and largest is at R.",
        whatChanged: "Set L at index 0 (1) and R at index 5 (10). Current sum = 11.",
        whatToNotice: "Target is 10, but current sum is 11, which is too large.",
        keyInsight: "To decrease the sum on a sorted array, we MUST move the Right pointer left.",
        nextStep: "Move R left from index 5 to index 4 to reduce the sum.",
      },
    },
    {
      actions: [
        { action: "move_pointer", pointer: "R", targetIndex: 4 },
        { action: "update_variable", name: "sum", value: "1 + 8 = 9" },
        { action: "compare", text: "Sum 9 < Target 10 (Too small) → Move L right" },
        { action: "show_callout", text: "sum = 1 + 8 = 9 < 10. Sum is too small! Move L right to increase sum.", boxType: "info" },
      ],
      codeLine: "moveR",
      explanation: "R moved left to index 4 (value 8). Sum is now 1 + 8 = 9, which is less than target 10.",
      narrative: {
        currentStep: "Move Right Pointer Left (R = 4)",
        why: "Moving R left decreased the sum from 11 to 9. Now 9 < 10.",
        whatChanged: "Pointer R moved from index 5 (10) to index 4 (8). Sum became 9.",
        whatToNotice: "Now sum is smaller than target 10.",
        keyInsight: "To increase the sum, we move the Left pointer right.",
        nextStep: "Move L right from index 0 to index 1.",
      },
    },
    {
      actions: [
        { action: "move_pointer", pointer: "L", targetIndex: 1 },
        { action: "update_variable", name: "sum", value: "2 + 8 = 10" },
        { action: "highlight_element", indices: [1, 4] },
        { action: "compare", text: "Sum 10 == Target 10! Pair found at [1, 4]" },
        { action: "show_callout", text: "Target matched: arr[1] + arr[4] = 2 + 8 = 10!", boxType: "success" },
      ],
      codeLine: "found",
      explanation: "L moved to index 1 (value 2). Sum is 2 + 8 = 10, matching target!",
      narrative: {
        currentStep: "Target Found: arr[1] + arr[4] = 10",
        why: "Moving L right increased the sum to exactly match the target 10.",
        whatChanged: "L moved to index 1 (2). Sum = 2 + 8 = 10.",
        whatToNotice: "We found the solution in only 3 pointer steps instead of 15 pairs.",
        keyInsight: "Two pointers eliminates an entire nested loop, cutting runtime from O(n²) to O(n).",
        nextStep: "Review the general two-pointer invariant.",
      },
    },
    {
      actions: [
        { action: "show_insight_card", title: "Two Pointer Decision Rule", text: "If sum > target → R-- (decrease sum). If sum < target → L++ (increase sum). Takes O(n) time." },
        { action: "show_complexity", time: "O(n)", space: "O(1)" },
      ],
      codeLine: "done",
      explanation: "Two pointers scans the array from both ends in linear O(n) time and O(1) space.",
      narrative: {
        currentStep: "Two Pointer Pattern Summary",
        why: "Monotonicity of sorted arrays guarantees that moving pointers in one direction never misses the target.",
        whatChanged: "Algorithm completed successfully.",
        whatToNotice: "Only works on sorted arrays or monotonic properties.",
        keyInsight: "Use Two Pointers whenever monotonic direction eliminates candidate pairs safely.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-two-pointers",
    title: "Two Pointer Technique",
    dataStructure: "Array",
    pattern: "Two Pointers (Opposite Ends)",
    objective: "Find pair sum in a sorted array in linear time.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function twoSum(arr, target) {",
        "  let L = 0, R = arr.length - 1;",
        "  while (L < R) {",
        "    const sum = arr[L] + arr[R];",
        "    if (sum === target) return [L, R];",
        "    else if (sum > target) R--; // too large",
        "    else L++; // too small",
        "  }",
        "}",
      ],
      cpp: [
        "vector<int> twoSum(vector<int>& arr, int target) {",
        "  int L = 0, R = arr.size() - 1;",
        "  while (L < R) {",
        "    int sum = arr[L] + arr[R];",
        "    if (sum == target) return {L, R};",
        "    else if (sum > target) R--;",
        "    else L++;",
        "  }",
        "  return {};",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 2, moveR: 6, found: 5, done: 8 },
      cpp: { init: 2, moveR: 6, found: 5, done: 8 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   3. SLIDING WINDOW WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildSlidingWindowWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Sliding Window Technique", subtitle: "Find Max Sum Subarray of Size k = 3", badge: "O(n) Linear" },
        { action: "create_array", id: "arr", values: [2, 1, 5, 1, 3, 2] },
        { action: "set_sliding_window", startIndex: 0, endIndex: 2, label: "Initial Window", conditionOrSum: "Sum = 8" },
        { action: "create_variable", name: "maxSum", value: 8 },
        { action: "show_callout", text: "Window [0..2] covering [2, 1, 5]. Current sum = 2 + 1 + 5 = 8.", boxType: "info" },
      ],
      codeLine: "init",
      explanation: "Initialize the first window of size k = 3 across indices [0..2].",
      narrative: {
        currentStep: "Build Initial Window [0..2]",
        why: "Calculate the sum of the first k elements to establish the baseline window.",
        whatChanged: "Window established over indices 0 to 2 with sum = 8.",
        whatToNotice: "Notice we do NOT re-sum all k elements when advancing to the next window.",
        keyInsight: "A sliding window reuses the overlapping sum: subtract element leaving left, add element entering right.",
        nextStep: "Slide window right: subtract arr[0] (2) and add arr[3] (1).",
      },
    },
    {
      actions: [
        { action: "set_sliding_window", startIndex: 1, endIndex: 3, label: "Slide Right: -2 + 1", conditionOrSum: "Sum = 7" },
        { action: "show_callout", text: "Window shifted to [1..3]. Subtracted 2, added 1. New sum = 8 - 2 + 1 = 7.", boxType: "warning" },
      ],
      codeLine: "slide1",
      explanation: "Slide window to [1..3]. New sum is 7 < 8, so maxSum remains 8.",
      narrative: {
        currentStep: "Slide Window to [1..3]",
        why: "To evaluate the next contiguous subarray in O(1) time without re-looping.",
        whatChanged: "Subtracted outgoing arr[0]=2, added incoming arr[3]=1. Window sum = 7.",
        whatToNotice: "7 is less than maxSum (8), so maxSum is unchanged.",
        keyInsight: "Each shift requires exactly one addition and one subtraction — O(1) per step.",
        nextStep: "Slide window right to [2..4]: subtract arr[1] (1), add arr[4] (3).",
      },
    },
    {
      actions: [
        { action: "set_sliding_window", startIndex: 2, endIndex: 4, label: "Slide Right: -1 + 3", conditionOrSum: "Sum = 9 (New Max!)" },
        { action: "update_variable", name: "maxSum", value: 9 },
        { action: "show_callout", text: "Window [2..4]: 7 - 1 + 3 = 9 > 8! Updated maxSum to 9.", boxType: "success" },
      ],
      codeLine: "slide2",
      explanation: "Window shifted to [2..4]. Sum updated to 9, which is the new maximum sum.",
      narrative: {
        currentStep: "New Maximum Found: Window [2..4] = 9",
        why: "Sum 9 exceeds previous maximum 8.",
        whatChanged: "maxSum updated to 9.",
        whatToNotice: "Values [5, 1, 3] yield sum 9.",
        keyInsight: "Sliding window converts an O(n · k) brute force into an O(n) single pass.",
        nextStep: "Review the general sliding window pattern.",
      },
    },
    {
      actions: [
        { action: "show_insight_card", title: "Sliding Window Pattern", text: "Expand right to consume elements; shrink left when constraints are violated. Avoids re-scanning." },
        { action: "show_complexity", time: "O(n)", space: "O(1)" },
      ],
      codeLine: "done",
      explanation: "Sliding window completed in a single O(n) pass with O(1) auxiliary space.",
      narrative: {
        currentStep: "Sliding Window Summary",
        why: "Continuous subsegment problems (subarrays/substrings) naturally benefit from sliding windows.",
        whatChanged: "Final maximum sum 9 determined.",
        whatToNotice: "Applies to fixed-size windows and dynamic-size (shrink/expand) windows.",
        keyInsight: "Whenever problem involves contiguous subarrays or substrings, think Sliding Window first.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-sliding-window",
    title: "Sliding Window Technique",
    dataStructure: "Array",
    pattern: "Sliding Window",
    objective: "Calculate maximum subarray sum of fixed size k in linear time.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function maxSubarraySum(arr, k) {",
        "  let windowSum = 0, maxSum = 0;",
        "  for (let i = 0; i < k; i++) windowSum += arr[i];",
        "  maxSum = windowSum;",
        "  for (let i = k; i < arr.length; i++) {",
        "    windowSum += arr[i] - arr[i - k]; // O(1) update",
        "    maxSum = Math.max(maxSum, windowSum);",
        "  }",
        "  return maxSum;",
        "}",
      ],
      cpp: [
        "int maxSubarraySum(vector<int>& arr, int k) {",
        "  int windowSum = 0;",
        "  for (int i = 0; i < k; i++) windowSum += arr[i];",
        "  int maxSum = windowSum;",
        "  for (int i = k; i < arr.size(); i++) {",
        "    windowSum += arr[i] - arr[i - k];",
        "    maxSum = max(maxSum, windowSum);",
        "  }",
        "  return maxSum;",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 3, slide1: 6, slide2: 7, done: 9 },
      cpp: { init: 3, slide1: 6, slide2: 7, done: 9 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   4. SET WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildSetWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Set Data Structure", subtitle: "Collection of Distinct Unique Elements", badge: "Unique Items" },
        { action: "create_array", id: "raw-input", values: [2, 4, 2, 5, 4] },
        { action: "show_callout", text: "Raw Input with Duplicates: [2, 4, 2, 5, 4]. Let's insert each into a Set.", boxType: "info" },
      ],
      codeLine: "init",
      explanation: "A Set is an abstract data structure that stores only unique elements, automatically discarding duplicates.",
      narrative: {
        currentStep: "Initial Input Array with Duplicates",
        why: "To demonstrate how a Set enforces uniqueness and handles duplicate insertions.",
        whatChanged: "Loaded input array [2, 4, 2, 5, 4] with duplicate values 2 and 4.",
        whatToNotice: "Value 2 appears twice and 4 appears twice.",
        keyInsight: "In mathematical and programmatic Sets, duplicate entries are ignored.",
        nextStep: "Insert elements into the Set one by one.",
      },
    },
    {
      actions: [
        { action: "create_set_container", title: "Set Container", elements: [2, 4, 5], highlightElements: [2, 4, 5], note: "Duplicates 2 and 4 were discarded automatically!" },
        { action: "show_callout", text: "Set after insertion: { 2, 4, 5 }. Duplicate values 2 and 4 were ignored!", boxType: "success" },
      ],
      codeLine: "insert",
      explanation: "Inserting all elements into the Set produces { 2, 4, 5 }. Each value appears exactly once.",
      narrative: {
        currentStep: "Unique Element Deduplication",
        why: "A hash-based Set checks for existing keys via hashing before inserting.",
        whatChanged: "The 5 input items were filtered down to 3 unique elements: { 2, 4, 5 }.",
        whatToNotice: "Notice the Set size is 3, not 5.",
        keyInsight: "Use a Set whenever you need to deduplicate items or test for presence in O(1) average time.",
        nextStep: "Perform membership query: set.has(4) and set.has(7).",
      },
    },
    {
      actions: [
        { action: "create_set_container", title: "Set Membership Check", elements: [2, 4, 5], highlightElements: [4], note: "contains(4) → true (Found in O(1)) | contains(7) → false" },
        { action: "show_callout", text: "set.has(4) → true | set.has(7) → false in O(1) average time!", boxType: "insight" },
        { action: "show_insight_card", title: "Set vs Array Comparison", text: "Array lookup: O(n) linear scan. HashSet lookup: O(1) average via hash hashing." },
        { action: "show_complexity", time: "Insert O(1), Lookup O(1)", space: "O(n)" },
      ],
      codeLine: "done",
      explanation: "Membership testing in a HashSet takes O(1) average time, vastly outperforming an array's O(n) scan.",
      narrative: {
        currentStep: "O(1) Membership Lookup & Summary",
        why: "Hash-based indexing computes bucket locations directly from element values.",
        whatChanged: "Demonstrated O(1) presence verification.",
        whatToNotice: "Array lookup requires scanning every item (O(n)), while Set checks in O(1).",
        keyInsight: "If you need fast contains() or deduplication, always prefer Set over Array.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-set",
    title: "Understanding Sets",
    dataStructure: "Set",
    pattern: "Hash-based Uniqueness",
    objective: "Understand element uniqueness, duplicate removal, and O(1) membership.",
    difficulty: "Beginner",
    steps,
    code: {
      javascript: [
        "const nums = [2, 4, 2, 5, 4];",
        "const uniqueSet = new Set(nums); // { 2, 4, 5 }",
        "uniqueSet.has(4); // true in O(1)",
        "uniqueSet.has(7); // false in O(1)",
      ],
      cpp: [
        "vector<int> nums = {2, 4, 2, 5, 4};",
        "unordered_set<int> uniqueSet(nums.begin(), nums.end());",
        "uniqueSet.count(4); // 1 (true) in O(1)",
        "uniqueSet.count(7); // 0 (false) in O(1)",
      ],
    },
    lineMap: {
      javascript: { init: 1, insert: 2, done: 3 },
      cpp: { init: 1, insert: 2, done: 3 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   5. DYNAMIC PROGRAMMING WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildDPWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Dynamic Programming (Tabulation)", subtitle: "Fibonacci: dp[i] = dp[i-1] + dp[i-2]", badge: "O(n) Time" },
        {
          action: "create_dp_table",
          table: {
            title: "Fibonacci State Table",
            meaning: "dp[i] stores the i-th Fibonacci number",
            headers: ["i = 0", "i = 1", "i = 2", "i = 3", "i = 4"],
            rows: [["?", "?", "?", "?", "?"]],
          },
        },
        { action: "show_callout", text: "What does dp[i] mean? dp[i] is the solution to the subproblem of size i.", boxType: "info" },
      ],
      codeLine: "init",
      explanation: "Dynamic Programming stores answers to smaller subproblems to avoid redundant exponential recalculation.",
      narrative: {
        currentStep: "Define DP State & State Table",
        why: "Naive recursive Fibonacci computes fib(n-2) multiple times, resulting in O(2ⁿ) exponential work.",
        whatChanged: "Initialized DP table to store precomputed subproblem solutions.",
        whatToNotice: "Always ask: 'What does dp[i] mean?' Here, it represents the i-th Fibonacci number.",
        keyInsight: "DP trades a small amount of memory (table) to turn exponential time into linear time.",
        nextStep: "Establish base cases: dp[0] = 0 and dp[1] = 1.",
      },
    },
    {
      actions: [
        {
          action: "create_dp_table",
          table: {
            title: "Fibonacci State Table: Base Cases",
            meaning: "dp[i] stores the i-th Fibonacci number",
            headers: ["i = 0", "i = 1", "i = 2", "i = 3", "i = 4"],
            rows: [[0, 1, "?", "?", "?"]],
            highlightCell: [0, 1],
            formula: "Base cases initialized: dp[0] = 0, dp[1] = 1",
          },
        },
        { action: "show_callout", text: "Base cases: dp[0] = 0, dp[1] = 1 require no computation.", boxType: "info" },
      ],
      codeLine: "base",
      explanation: "Base cases give the starting values so transitions can compute subsequent entries.",
      narrative: {
        currentStep: "Set Base Cases: dp[0] = 0, dp[1] = 1",
        why: "Every DP recurrence must have bottom-level terminating values.",
        whatChanged: "Filled index 0 with 0 and index 1 with 1.",
        whatToNotice: "Notice the remaining indices 2, 3, 4 depend directly on these base values.",
        keyInsight: "Base cases prevent infinite recurrence and ground the tabulation.",
        nextStep: "Apply state transition: dp[2] = dp[1] + dp[0].",
      },
    },
    {
      actions: [
        {
          action: "create_dp_table",
          table: {
            title: "State Transition: dp[2] = dp[1] + dp[0]",
            meaning: "dp[i] stores the i-th Fibonacci number",
            headers: ["i = 0", "i = 1", "i = 2", "i = 3", "i = 4"],
            rows: [[0, 1, 1, 2, 3]],
            highlightCell: [0, 2],
            formula: "dp[2] = 1 + 0 = 1 | dp[3] = 1 + 1 = 2 | dp[4] = 2 + 1 = 3",
          },
        },
        { action: "show_callout", text: "Transition: dp[i] = dp[i-1] + dp[i-2]. Each step computes in O(1) time!", boxType: "success" },
        { action: "show_insight_card", title: "Optimal Substructure & Memoization", text: "By looking up dp[i-1] and dp[i-2] in O(1), we compute n values in exactly O(n) total operations." },
        { action: "show_complexity", time: "O(n)", space: "O(n) or O(1) optimized" },
      ],
      codeLine: "done",
      explanation: "Iteratively filling the table from left to right solves Fibonacci in O(n) time.",
      narrative: {
        currentStep: "Tabulation Transition Completed",
        why: "Each value is computed once and immediately saved for subsequent lookups.",
        whatChanged: "Filled dp[2]=1, dp[3]=2, dp[4]=3 using the transition rule.",
        whatToNotice: "Notice we only need the previous 2 variables, allowing space optimization to O(1).",
        keyInsight: "Core DP questions: 1) What is the state? 2) What is the transition? 3) What are base cases?",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-dp",
    title: "Understanding Dynamic Programming",
    dataStructure: "DP Table",
    pattern: "Tabulation / Overlapping Subproblems",
    objective: "Master state definition, transitions, and subproblem reuse.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function fib(n) {",
        "  const dp = new Array(n + 1);",
        "  dp[0] = 0; dp[1] = 1; // base cases",
        "  for (let i = 2; i <= n; i++) {",
        "    dp[i] = dp[i - 1] + dp[i - 2]; // O(1) transition",
        "  }",
        "  return dp[n];",
        "}",
      ],
      cpp: [
        "int fib(int n) {",
        "  vector<int> dp(n + 1);",
        "  dp[0] = 0; dp[1] = 1;",
        "  for (int i = 2; i <= n; i++) {",
        "    dp[i] = dp[i - 1] + dp[i - 2];",
        "  }",
        "  return dp[n];",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 2, base: 3, done: 5 },
      cpp: { init: 2, base: 3, done: 5 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   6. RECURSION & CALL STACK WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildRecursionWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Recursion & The Call Stack", subtitle: "Trace: factorial(3) = 3 * factorial(2)", badge: "Call Stack" },
        {
          action: "create_call_stack",
          frames: [{ fnName: "factorial", args: "3", active: true }],
        },
        { action: "show_callout", text: "factorial(3) is called and pushed onto the call stack. Needs factorial(2).", boxType: "info" },
      ],
      codeLine: "call3",
      explanation: "When a function calls itself, a new stack frame is pushed onto the call stack.",
      narrative: {
        currentStep: "Push factorial(3) to Call Stack",
        why: "To compute 3!, we must first evaluate the smaller subproblem (3 - 1)!.",
        whatChanged: "Allocated a stack frame for factorial(3).",
        whatToNotice: "factorial(3) is paused waiting for factorial(2) to return.",
        keyInsight: "Every recursive call consumes stack memory for local variables and return addresses.",
        nextStep: "Recurse deeper: push factorial(2) and factorial(1).",
      },
    },
    {
      actions: [
        {
          action: "create_call_stack",
          frames: [
            { fnName: "factorial", args: "3" },
            { fnName: "factorial", args: "2" },
            { fnName: "factorial", args: "1", returnValue: "1 (Base Case)", active: true },
          ],
        },
        { action: "show_callout", text: "Base case reached: factorial(1) returns 1! Call stack begins unwinding.", boxType: "success" },
      ],
      codeLine: "base",
      explanation: "factorial(1) hits the base case and returns 1 without making another recursive call.",
      narrative: {
        currentStep: "Base Case Reached: factorial(1) = 1",
        why: "Without a base case, recursion continues infinitely until stack overflow.",
        whatChanged: "Stack reached maximum depth of 3 frames.",
        whatToNotice: "Now the top frame can return its value to the caller below it.",
        keyInsight: "The base case is what stops recursion and initiates the return phase.",
        nextStep: "Unwind the stack: multiply return values.",
      },
    },
    {
      actions: [
        {
          action: "create_call_stack",
          frames: [
            { fnName: "factorial", args: "3", returnValue: "3 * 2 = 6", active: true },
          ],
        },
        { action: "show_callout", text: "Unwinding complete: 1 × 2 = 2 → 2 × 3 = 6. Final result = 6!", boxType: "success" },
        { action: "show_insight_card", title: "Recursion vs Iteration", text: "Recursion uses O(n) call stack memory. Tail call optimization or iteration can reduce space to O(1)." },
        { action: "show_complexity", time: "O(n)", space: "O(n) stack frames" },
      ],
      codeLine: "done",
      explanation: "The call stack unwinds, popping each frame as it completes the multiplication.",
      narrative: {
        currentStep: "Stack Unwound & Final Result 6",
        why: "Each frame received its awaited return value and completed its computation.",
        whatChanged: "All recursive frames resolved and popped from memory.",
        whatToNotice: "Final return value is 6.",
        keyInsight: "Always identify: 1) Base case, 2) Recursive step, 3) Maximum call stack depth.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-recursion",
    title: "Understanding Recursion",
    dataStructure: "Call Stack",
    pattern: "Divide & Return (Call Stack)",
    objective: "Visualize call stack frame growth, base case, and unwinding.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "function factorial(n) {",
        "  if (n <= 1) return 1; // base case",
        "  return n * factorial(n - 1); // recursive case",
        "}",
      ],
      cpp: [
        "int factorial(int n) {",
        "  if (n <= 1) return 1;",
        "  return n * factorial(n - 1);",
        "}",
      ],
    },
    lineMap: {
      javascript: { call3: 1, base: 2, done: 3 },
      cpp: { call3: 1, base: 2, done: 3 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   7. BACKTRACKING WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildBacktrackingWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Backtracking Decision Tree", subtitle: "Generate All Subsets of [1, 2]", badge: "Choose-Explore-Undo" },
        {
          action: "create_decision_tree",
          nodes: [
            { id: "root", label: "[]", x: 400, y: 30, state: "active" },
          ],
          edges: [],
        },
        { action: "show_callout", text: "At each element, make a binary choice: Include or Exclude.", boxType: "info" },
      ],
      codeLine: "init",
      explanation: "Backtracking systematically explores a decision tree by choosing, exploring, and undoing choices.",
      narrative: {
        currentStep: "Root: Empty Subset []",
        why: "We begin at the root decision point before considering any numbers.",
        whatChanged: "Initialized decision tree at root with state [].",
        whatToNotice: "For each element, we have 2 branches: include it or exclude it.",
        keyInsight: "Backtracking builds candidates incrementally and abandons (backtracks) when done.",
        nextStep: "CHOOSE 1: explore the include branch.",
      },
    },
    {
      actions: [
        {
          action: "create_decision_tree",
          nodes: [
            { id: "root", label: "[]", x: 400, y: 30 },
            { id: "inc1", label: "[1]", x: 260, y: 100, state: "active" },
            { id: "exc1", label: "[]", x: 540, y: 100 },
          ],
          edges: [
            ["root", "inc1"],
            ["root", "exc1"],
          ],
        },
        { action: "show_callout", text: "CHOOSE 1: Included 1 into current subset [1].", boxType: "insight" },
      ],
      codeLine: "choose1",
      explanation: "Explore left branch: include element 1 into the subset.",
      narrative: {
        currentStep: "CHOOSE 1: Branch Left",
        why: "To find all subsets containing 1.",
        whatChanged: "State became [1].",
        whatToNotice: "Next choice will be whether to include or exclude 2.",
        keyInsight: "Recursion traverses down one path of the decision tree to a leaf.",
        nextStep: "CHOOSE 2: form leaf [1, 2].",
      },
    },
    {
      actions: [
        {
          action: "create_decision_tree",
          nodes: [
            { id: "root", label: "[]", x: 400, y: 30 },
            { id: "inc1", label: "[1]", x: 260, y: 100 },
            { id: "exc1", label: "[]", x: 540, y: 100 },
            { id: "inc2", label: "[1, 2]", x: 190, y: 170, state: "active" },
            { id: "exc2", label: "[1]", x: 330, y: 170 },
            { id: "inc2_b", label: "[2]", x: 470, y: 170 },
            { id: "exc2_b", label: "[]", x: 610, y: 170 },
          ],
          edges: [
            ["root", "inc1"],
            ["root", "exc1"],
            ["inc1", "inc2"],
            ["inc1", "exc2"],
            ["exc1", "inc2_b"],
            ["exc1", "exc2_b"],
          ],
        },
        { action: "show_callout", text: "All 4 subsets generated: [1,2], [1], [2], []. Total = 2ⁿ = 4.", boxType: "success" },
        { action: "show_insight_card", title: "Backtracking Core Cycle", text: "1. CHOOSE candidate → 2. EXPLORE recursively → 3. UNDO (pop) to restore state for sibling branches." },
        { action: "show_complexity", time: "O(2ⁿ · n)", space: "O(n) recursion depth" },
      ],
      codeLine: "done",
      explanation: "Completed exploration of the decision tree. The 2ⁿ subsets are collected.",
      narrative: {
        currentStep: "Decision Tree Explored: 4 Subsets",
        why: "Binary choices across n items yield exactly 2ⁿ combinatorial outcomes.",
        whatChanged: "Explored all leaves and backtracked cleanly without state leaks.",
        whatToNotice: "Notice state restoration (undo) is what allows reusing a single array buffer.",
        keyInsight: "Backtracking is brute-force with undo; pruning stops branches that violate constraints.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-backtracking",
    title: "Understanding Backtracking",
    dataStructure: "Decision Tree",
    pattern: "Choose-Explore-Undo",
    objective: "Visualize decision trees, state branching, and backtrack restoration.",
    difficulty: "Advanced",
    steps,
    code: {
      javascript: [
        "function subsets(nums) {",
        "  const res = [], current = [];",
        "  function backtrack(idx) {",
        "    if (idx === nums.length) { res.push([...current]); return; }",
        "    current.push(nums[idx]); // CHOOSE",
        "    backtrack(idx + 1);      // EXPLORE",
        "    current.pop();           // UNDO (Backtrack)",
        "    backtrack(idx + 1);      // EXCLUDE",
        "  }",
        "  backtrack(0);",
        "  return res;",
        "}",
      ],
      cpp: [
        "void backtrack(int idx, vector<int>& nums, vector<int>& cur, vector<vector<int>>& res) {",
        "  if (idx == nums.size()) { res.push_back(cur); return; }",
        "  cur.push_back(nums[idx]); // CHOOSE",
        "  backtrack(idx + 1, nums, cur, res); // EXPLORE",
        "  cur.pop_back();           // UNDO",
        "  backtrack(idx + 1, nums, cur, res);",
        "}",
      ],
    },
    lineMap: {
      javascript: { init: 3, choose1: 5, done: 7 },
      cpp: { init: 2, choose1: 3, done: 5 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   7. ARRAY VS LINKED LIST COMPARISON WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildArrayVsLinkedListWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Array vs. Linked List", subtitle: "Memory Layout & Address Arithmetic", badge: "Memory" },
        { action: "create_array", id: "arr-demo", values: [10, 20, 30, 40] },
        { action: "show_callout", text: "ARRAY: Contiguous memory blocks. Index access arr[i] is an instant O(1) pointer offset calculation: base + i * size.", boxType: "info" },
      ],
      codeLine: "array_access",
      explanation: "Arrays store elements in consecutive memory addresses, giving the CPU perfect cache prefetching and O(1) direct indexing.",
      narrative: {
        currentStep: "Contiguous Memory & Direct Addressing",
        why: "To explain why array index access is instantaneous O(1) hardware-level arithmetic.",
        whatChanged: "Rendered an array of 4 elements in contiguous memory slots.",
        whatToNotice: "Every element is placed directly beside its neighbor with fixed stride.",
        keyInsight: "Direct indexing arr[i] requires zero traversal hops.",
        nextStep: "Examine Linked List node pointer chains in heap memory.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Array vs. Linked List", subtitle: "Node Pointers & Sequential Access", badge: "Pointers" },
        { action: "create_linked_list", values: [10, 20, 30, 40] },
        { action: "show_callout", text: "LINKED LIST: Nodes scattered anywhere in heap memory. To reach index 3, you MUST traverse from head node by node: O(n) scan.", boxType: "warning" },
      ],
      codeLine: "list_access",
      explanation: "Linked lists trade direct indexing for dynamic resizing: nodes are scattered in memory connected only by next pointers.",
      narrative: {
        currentStep: "Non-Contiguous Heap Nodes & Sequential Traversal",
        why: "Without contiguous memory, pointer chasing is required to locate elements.",
        whatChanged: "Rendered a 4-node singly linked list connected by arrows.",
        whatToNotice: "Notice each node stores its value PLUS an auxiliary pointer to the next node.",
        keyInsight: "Accessing index k requires k pointer hops through memory (O(k) time).",
        nextStep: "Compare insertion and deletion costs at the head.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Array vs. Linked List", subtitle: "Comprehensive Trade-off Matrix & Decision Guide", badge: "Summary" },
        {
          action: "show_comparison_board",
          board: {
            leftTitle: "ARRAY (Contiguous)",
            leftItems: [
              "Access: O(1) instant indexing",
              "Insert/Delete: O(n) requires shifting",
              "Memory: Cache-friendly, compact",
              "Resizing: O(n) reallocation overhead",
            ],
            rightTitle: "LINKED LIST (Nodes)",
            rightItems: [
              "Access: O(n) sequential scan",
              "Insert/Delete at Head: O(1) instant relink",
              "Memory: Extra pointer per node",
              "Resizing: Dynamic, zero reallocation",
            ],
            verdict: "Use Array when reads/indexing dominate; use Linked List when frequent head/tail insertion occurs.",
          },
        },
        { action: "show_insight_card", title: "Core Takeaway", text: "Array = High-speed reads & CPU cache locality. Linked List = Cheap head prepends & zero pre-allocated capacity." },
        { action: "show_complexity", time: "Array Access O(1) | List Access O(n)", space: "List: O(n) pointer overhead" },
      ],
      codeLine: "summary",
      explanation: "Arrays excel at fast random access; Linked Lists excel at dynamic allocation and cheap pointer relinking.",
      narrative: {
        currentStep: "Trade-off Matrix & Architectural Selection",
        why: "Selecting the right data structure depends on the expected read-to-write ratio of your application.",
        whatChanged: "Displayed the side-by-side comparison board with time and space complexities.",
        whatToNotice: "Neither data structure dominates the other in all operations; each is optimized for specific access patterns.",
        keyInsight: "Choose based on whether your workload is read-heavy (Array) or insertion-heavy (Linked List).",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "compare-array-vs-linked-list",
    title: "Array vs. Linked List",
    dataStructure: "Array & Linked List",
    pattern: "Data Structure Trade-offs",
    objective: "Compare memory, complexity, cache friendliness, and use cases.",
    difficulty: "Beginner",
    steps,
    code: {
      javascript: [
        "// Array: Fast O(1) random access",
        "const arr = [10, 20, 30, 40];",
        "const val = arr[2]; // O(1) instant lookup",
        "",
        "// Linked List: O(1) head insertion, O(n) access",
        "class Node { constructor(val, next = null) { this.val = val; this.next = next; } }",
        "let head = new Node(10);",
        "head = new Node(5, head); // O(1) prepend at head",
      ],
      cpp: [
        "// Array: Fast O(1) random access",
        "vector<int> arr = {10, 20, 30, 40};",
        "int val = arr[2]; // O(1)",
        "",
        "// Linked List: O(1) head prepends",
        "struct Node { int val; Node* next; };",
        "Node* head = new Node{10, nullptr};",
        "head = new Node{5, head}; // O(1) prepend",
      ],
    },
    lineMap: {
      javascript: { array_access: 3, list_access: 6, summary: 8 },
      cpp: { array_access: 3, list_access: 6, summary: 8 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   8. BFS VS DFS COMPARISON WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildBFSvsDFSWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "BFS vs. DFS", subtitle: "Level-by-Level Queue vs. Deep Stack Traversal", badge: "Graph Traversal" },
        {
          action: "create_graph",
          nodes: [
            { id: "A", label: "Root A", x: 200, y: 50, visited: true },
            { id: "B", label: "B (d=1)", x: 100, y: 150 },
            { id: "C", label: "C (d=1)", x: 300, y: 150 },
            { id: "D", label: "D (d=2)", x: 100, y: 250 },
            { id: "E", label: "E (d=2)", x: 300, y: 250 },
          ],
          edges: [
            { from: "A", to: "B" },
            { from: "A", to: "C" },
            { from: "B", to: "D" },
            { from: "C", to: "E" },
          ],
        },
        { action: "show_callout", text: "BFS (Breadth-First Search): Enqueues neighbors into a FIFO queue. Visits all nodes at distance k before moving to distance k + 1.", boxType: "info" },
      ],
      codeLine: "bfs_init",
      explanation: "BFS explores outward in concentric rings, ensuring that the first time any target node is reached, it is via the shortest edge path.",
      narrative: {
        currentStep: "Breadth-First Ring Expansion",
        why: "To demonstrate how FIFO queue ordering prioritizes breadth over depth.",
        whatChanged: "Rendered a tree-like graph with root A and highlighted its immediate frontier.",
        whatToNotice: "Nodes B and C are both visited before either D or E.",
        keyInsight: "BFS guarantees shortest path in unweighted graphs because it explores by increasing hop count.",
        nextStep: "Examine Depth-First Search branch exploration.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "BFS vs. DFS", subtitle: "Deep Branching via Stack or Call Stack", badge: "Backtracking" },
        {
          action: "create_graph",
          nodes: [
            { id: "A", label: "A (1st)", x: 200, y: 50, visited: true },
            { id: "B", label: "B (2nd)", x: 100, y: 150, visited: true },
            { id: "D", label: "D (3rd)", x: 100, y: 250, visited: true },
            { id: "C", label: "C (4th)", x: 300, y: 150 },
            { id: "E", label: "E (5th)", x: 300, y: 250 },
          ],
          edges: [
            { from: "A", to: "B", highlighted: true },
            { from: "B", to: "D", highlighted: true },
            { from: "A", to: "C" },
            { from: "C", to: "E" },
          ],
        },
        { action: "show_callout", text: "DFS (Depth-First Search): Plunges straight down the A → B → D branch to the leaf before backtracking to visit C and E.", boxType: "warning" },
      ],
      codeLine: "dfs_run",
      explanation: "DFS follows each path to its end before backtracking, using memory proportional to tree depth rather than width.",
      narrative: {
        currentStep: "Deep Branch Exploration & Backtracking",
        why: "To contrast DFS deep diving with BFS shallow spreading.",
        whatChanged: "Highlighted the single branch A → B → D plunging to the leaf node.",
        whatToNotice: "Node D at depth 2 is visited BEFORE node C at depth 1.",
        keyInsight: "DFS uses O(height) stack space, making it memory-efficient on wide graphs.",
        nextStep: "View the side-by-side comparison board and decision guide.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "BFS vs. DFS", subtitle: "Architectural Comparison & Use Cases", badge: "Summary" },
        {
          action: "show_comparison_board",
          board: {
            leftTitle: "BREADTH-FIRST SEARCH (BFS)",
            leftItems: [
              "Data Structure: Queue (FIFO)",
              "Strategy: Explore all neighbors at distance k first",
              "Shortest Path: YES (on unweighted graphs)",
              "Space: O(width) can be large in wide graphs",
            ],
            rightTitle: "DEPTH-FIRST SEARCH (DFS)",
            rightItems: [
              "Data Structure: Stack / Recursion (LIFO)",
              "Strategy: Dive as deep as possible before backtracking",
              "Shortest Path: NO (does not guarantee fewest edges)",
              "Space: O(height) memory-efficient on deep graphs",
            ],
            verdict: "Use BFS for shortest paths; use DFS for topological sort, cycle detection, and maze solving.",
          },
        },
        { action: "show_insight_card", title: "Rule of Thumb", text: "Finding fewest hops or closest target? Use BFS. Exhaustive search, path finding, or topological sorting? Use DFS." },
        { action: "show_complexity", time: "Both O(V + E)", space: "BFS: O(W) | DFS: O(H)" },
      ],
      codeLine: "summary",
      explanation: "BFS explores level by level using a Queue; DFS dives deep along branches using a Stack or Recursion.",
      narrative: {
        currentStep: "Traversal Comparison & Strategy Verdict",
        why: "Choosing between BFS and DFS determines algorithmic optimality and memory safety.",
        whatChanged: "Rendered full comparison board contrasting queue vs stack and shortest path guarantees.",
        whatToNotice: "Both run in O(V + E) time, but their spatial behavior and path optimality differ fundamentally.",
        keyInsight: "BFS finds the shortest path; DFS explores connectivity, cycles, and permutations.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "compare-bfs-vs-dfs",
    title: "BFS vs. DFS Comparison",
    dataStructure: "Graph",
    pattern: "Frontier Exploration",
    objective: "Understand when to use Queue-based BFS vs Stack-based DFS.",
    difficulty: "Intermediate",
    steps,
    code: {
      javascript: [
        "// BFS: Queue explores level-by-level",
        "const queue = [startNode];",
        "while (queue.length) {",
        "  const u = queue.shift();",
        "  for (const v of adj[u]) if (!visited.has(v)) { visited.add(v); queue.push(v); }",
        "}",
        "",
        "// DFS: Call Stack plunges deep",
        "function dfs(u) {",
        "  visited.add(u);",
        "  for (const v of adj[u]) if (!visited.has(v)) dfs(v);",
        "}",
      ],
      cpp: [
        "// BFS: Queue level order",
        "queue<int> q; q.push(start);",
        "while (!q.empty()) {",
        "    int u = q.front(); q.pop();",
        "    for (int v : adj[u]) if (!visited[v]) { visited[v]=true; q.push(v); }",
        "}",
        "",
        "// DFS: Recursive depth exploration",
        "void dfs(int u) {",
        "    visited[u] = true;",
        "    for (int v : adj[u]) if (!visited[v]) dfs(v);",
        "}",
      ],
    },
    lineMap: {
      javascript: { bfs_init: 2, dfs_run: 9, summary: 4 },
      cpp: { bfs_init: 2, dfs_run: 9, summary: 4 },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   9. COMPLEXITY WHITEBOARD LESSON
   ═══════════════════════════════════════════════════════════ */
export function buildComplexityWhiteboardLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Asymptotic Complexity Guide", subtitle: "Definition & The Mathematical Principle", badge: "Big O" },
        { action: "show_callout", text: "Big O notation measures how execution time and auxiliary space scale as input size n approaches infinity. It ignores hardware speed and constant factors.", boxType: "info" },
        { action: "show_complexity", time: "T(n) ∈ O(f(n))", space: "S(n) ∈ O(g(n))" },
      ],
      codeLine: "intro",
      explanation: "Asymptotic complexity allows us to classify algorithms independently of hardware, compiler, or language optimizations.",
      narrative: {
        currentStep: "The Asymptotic Principle",
        why: "To establish that algorithm scalability is an invariant mathematical property.",
        whatChanged: "Displayed core asymptotic definitions and scaling principles.",
        whatToNotice: "We discard constant coefficients (2n → O(n)) and lower-order terms (n² + n → O(n²)).",
        keyInsight: "Big O represents the upper bound on growth rate as n grows infinitely large.",
        nextStep: "Review the standard growth rate hierarchy from fastest to slowest.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Growth Rate Hierarchy", subtitle: "Fast (Sublinear/Linear) vs. Slow (Quadratic/Exponential)", badge: "Scaling" },
        {
          action: "show_comparison_board",
          board: {
            leftTitle: "FAST (Scales to Millions)",
            leftItems: [
              "O(1): Direct calculation / array indexing",
              "O(log n): Halving search space (Binary Search)",
              "O(n): Single loop scanning all elements",
              "O(n log n): Divide & conquer (Merge/Quick Sort)",
            ],
            rightTitle: "SLOW (Fails on Large N)",
            rightItems: [
              "O(n²): Nested loops comparing pairs",
              "O(n³): Triple nested loops (Floyd-Warshall)",
              "O(2ⁿ): Generating all subsets / recursion tree",
              "O(n!): Generating all permutations (Brute force)",
            ],
            verdict: "Aim for O(n log n) or O(n) for large datasets (n ≥ 100,000). O(n²) exceeds 1 second when n > 10,000.",
          },
        },
        { action: "show_callout", text: "Rule of thumb: Modern CPUs process ~10⁸ operations per second. For n = 100,000, O(n log n) takes ~2ms; O(n²) takes ~100 seconds!", boxType: "insight" },
      ],
      codeLine: "hierarchy",
      explanation: "Fast algorithms scale gracefully to millions of elements; quadratic and exponential algorithms choke on moderate inputs.",
      narrative: {
        currentStep: "The Growth Rate Spectrum",
        why: "Knowing the boundary between feasible and unfeasible runtimes is vital in technical interviews and production.",
        whatChanged: "Rendered comparative table of fast vs slow algorithmic time complexities.",
        whatToNotice: "O(n log n) is practically linear; O(2ⁿ) doubles in runtime with every single added element.",
        keyInsight: "Never deploy an O(n²) algorithm when n can exceed 10,000 in production.",
        nextStep: "Identify the code patterns that generate these complexities.",
      },
    },
    {
      actions: [
        { action: "reset_scene" },
        { action: "set_board_header", title: "Deducing Complexity from Code", subtitle: "Loop Iterations, Recursion Trees, and Space", badge: "Code Patterns" },
        { action: "show_insight_card", title: "Complexity Code Signatures", text: "• Halving variable (n /= 2) → O(log n)\n• Single loop (0 to n) → O(n)\n• Divide in 2 + linear merge → O(n log n)\n• Nested loops (0 to n, 0 to n) → O(n²)\n• Branching recursion (2 choices per step) → O(2ⁿ)" },
        { action: "show_callout", text: "Space Complexity measures auxiliary memory (extra allocations and call stack depth), excluding the input itself.", boxType: "success" },
        { action: "show_complexity", time: "O(1) < O(log n) < O(n) < O(n log n) < O(n²)", space: "Auxiliary" },
      ],
      codeLine: "patterns",
      explanation: "Complexity is directly deduced by analyzing how many times loops iterate and the depth of the recursive call stack.",
      narrative: {
        currentStep: "Code Signature Recognition & Final Summary",
        why: "To enable instant deduction of time and space complexity by inspecting code patterns.",
        whatChanged: "Displayed signature code patterns for logarithmic, linear, linearithmic, and quadratic runtimes.",
        whatToNotice: "Space complexity includes recursive stack frames: recursion to depth h uses O(h) space.",
        keyInsight: "Always count loop steps and recursive tree branches to determine Big O.",
        nextStep: "Lesson complete.",
      },
    },
  ];

  return {
    id: "explain-complexity",
    title: "Understanding Time & Space Complexity",
    dataStructure: "Complexity Theory",
    pattern: "Asymptotic Analysis",
    objective: "Deduce Big O from loops, recursion, and search-space halving.",
    difficulty: "Beginner–Intermediate",
    steps,
    code: {
      javascript: [
        "// O(1): Constant",
        "const first = arr[0];",
        "// O(log n): Halving",
        "while (n > 1) n = Math.floor(n / 2);",
        "// O(n): Single loop",
        "for (let i = 0; i < n; i++) {}",
        "// O(n²): Nested loops",
        "for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {}",
      ],
      cpp: [
        "// O(1)",
        "int first = arr[0];",
        "// O(log n)",
        "while (n > 1) n /= 2;",
        "// O(n)",
        "for (int i = 0; i < n; i++) {}",
        "// O(n²)",
        "for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {}",
      ],
    },
    lineMap: {
      javascript: { summary: 2 },
      cpp: { summary: 2 },
    },
  };
}
