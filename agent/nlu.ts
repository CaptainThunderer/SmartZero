import {
  DSA_TOPIC_REGISTRY,
  findTopicByQuery,
  detectComparison,
  type DSATopicDefinition,
} from "../engine/registry";
import type { DSATask, DSAIntent } from "../types/dsa";

/* ──── Helper: Extract Array of Numbers from Text ──── */
export function extractNumbers(text: string): number[] | null {
  // Matches [1, 2, 3] or [1,2,3]
  const bracketMatch = text.match(/\[\s*(-?\d+(?:\s*,\s*-?\d+)*)\s*\]/);
  if (bracketMatch) {
    const nums = bracketMatch[1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (nums.length >= 2) return nums;
  }

  // Matches "1 -> 2 -> 3 -> 4" or "1->2->3"
  const arrowMatch = text.match(/(-?\d+\s*->\s*-?\d+(?:\s*->\s*-?\d+)*)/);
  if (arrowMatch) {
    const nums = arrowMatch[1].split("->").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (nums.length >= 2) return nums;
  }

  return null;
}

/* ──── Helper: Extract Target Integer ──── */
export function extractTargetValue(text: string): number | null {
  const insertMatch = text.match(/(?:insert|search|find|target|value|element)\s+(-?\d+)/i);
  if (insertMatch) {
    const n = parseInt(insertMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

/* ──── Helper: Detect Non-DSA Questions ──── */
const NON_DSA_REGEX = /\b(weather|temperature|forecast|president|recipe|movie|song|actor|capital of|sports|football|basketball|flight|hotel|buy|bitcoin|crypto|stock price)\b/i;

/* ──── Main NLU Intent Interpreter ──── */
export function interpretDSAQuery(query: string): DSATask {
  const q = query.trim();
  const lower = q.toLowerCase();

  // 1. Non-DSA Check
  if (NON_DSA_REGEX.test(lower)) {
    return {
      intent: "unsupported_non_dsa",
      lessonId: null,
      rawQuestion: q,
      explanation:
        "I am SmartZero, specialized specifically in Data Structures and Algorithms. Feel free to ask me about arrays, sorting, graphs, trees, dynamic programming, and more!",
    };
  }

  // 2. Comparison Check ("Merge sort vs quicksort", "BFS vs DFS", "Stack vs queue")
  const comp = detectComparison(lower);
  if (comp) {
    const [tA, tB] = comp;
    return {
      intent: "compare",
      lessonId: null,
      topicId: tA.id,
      category: tA.category,
      rawQuestion: q,
      comparisonTopics: [tA.name, tB.name],
      explanation: buildComparisonExplanation(tA, tB),
      complexity: tA.timeComplexity ? { time: `${tA.name}: ${tA.timeComplexity.avg} vs ${tB.name}: ${tB.timeComplexity.avg}`, space: `${tA.spaceComplexity} vs ${tB.spaceComplexity}` } : undefined,
    };
  }

  // 3. Ambiguous Queries ("Show me sorting", "Sort this array", "Explain trees")
  if (/\b(?:show\s+me\s+sorting|sort\s+this\s+array|sorting\s+algorithms?|which\s+sorting\s+algorithm)\b/i.test(lower)) {
    return {
      intent: "clarification",
      lessonId: null,
      topicId: "sorting",
      category: "sorting",
      rawQuestion: q,
      explanation:
        "Sure — which sorting algorithm would you like to explore? Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, Quick Sort, Heap Sort, Counting Sort, Radix Sort, or Bucket Sort?",
      clarificationOptions: [
        { label: "Quick Sort", query: "Sort [8, 3, 5, 1, 9] using quick sort" },
        { label: "Merge Sort", query: "Explain merge sort visually" },
        { label: "Bubble Sort", query: "Show bubble sort" },
        { label: "Heap Sort", query: "Show heap sort" },
      ],
    };
  }

  // 4. Match Specific DSA Topic from Registry
  const topic = findTopicByQuery(lower);

  // 5. Complexity Questions ("Why is quicksort sometimes O(n²)?", "quicksort complexity")
  const isComplexityQuery = /\b(why\s+is\s+.*o\(|complexity|time\s+complexity|space\s+complexity|best\s+case|worst\s+case)\b/i.test(lower);
  if (topic && isComplexityQuery) {
    return {
      intent: "complexity",
      lessonId: null,
      topicId: topic.id,
      category: topic.category,
      rawQuestion: q,
      explanation: buildComplexityExplanation(topic, lower),
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
        best: topic.timeComplexity.best,
        worst: topic.timeComplexity.worst,
      },
    };
  }

  // 6. Interactive Visual Execution ("Sort [8,3,5,1,9] using quicksort", "Insert 65 into this BST", "Show BFS on this graph")
  const customData = extractNumbers(q);
  const targetVal = extractTargetValue(q);
  const wantsExecution =
    customData !== null ||
    targetVal !== null ||
    /\b(sort|reverse|insert|perform|show|run|step\s*by\s*step|simulate|visualize|traverse|walkthrough)\b/i.test(lower);

  if (topic && topic.hasDeterministicEngine && wantsExecution) {
    return {
      intent: "visualize",
      lessonId: topic.id,
      topicId: topic.id,
      category: topic.category,
      algorithm: topic.name,
      pattern: topic.operations[0] || topic.category,
      objective: topic.summary,
      rawQuestion: q,
      inputData: customData ?? topic.defaultInput,
      targetValue: targetVal ?? undefined,
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
      },
    };
  }

  // 7. Conceptual Explanation ("Explain arrays", "Explain dynamic programming", "What is a heap?")
  if (topic) {
    return {
      intent: "explain",
      lessonId: topic.hasDeterministicEngine ? topic.id : null,
      topicId: topic.id,
      category: topic.category,
      algorithm: topic.name,
      rawQuestion: q,
      explanation: buildConceptExplanation(topic),
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
        best: topic.timeComplexity.best,
        worst: topic.timeComplexity.worst,
      },
    };
  }

  // 8. General DSA Fallback
  return {
    intent: "explain",
    lessonId: null,
    rawQuestion: q,
    explanation:
      "I can explain and visualize Data Structures and Algorithms! Try asking about **Sorting** (Quick Sort, Merge Sort), **Trees** (BST Insertion), **Linked Lists**, **Graphs** (BFS/DFS), or **Dynamic Programming**.",
  };
}

/* ──── Explanation Builders ──── */
function buildConceptExplanation(topic: DSATopicDefinition): string {
  return `### ${topic.name}

${topic.summary}

**Why It Matters:**
${topic.whyItMatters}

**Key Operations:**
${topic.operations.map((op) => `• ${op}`).join("\n")}

**Complexity Profile:**
• Best Case Time: \`${topic.timeComplexity.best}\`
• Average Case Time: \`${topic.timeComplexity.avg}\`
• Worst Case Time: \`${topic.timeComplexity.worst}\`
• Space Complexity: \`${topic.spaceComplexity}\`

${
  topic.hasDeterministicEngine
    ? `*Interactive visualization available! Type "Show ${topic.name.toLowerCase()}" to watch step-by-step execution.*`
    : `*This is a conceptual algorithmic topic. Feel free to ask about implementation details or specific problem patterns.*`
}`;
}

function buildComparisonExplanation(tA: DSATopicDefinition, tB: DSATopicDefinition): string {
  return `### ${tA.name} vs. ${tB.name}

| Metric | ${tA.name} | ${tB.name} |
|---|---|---|
| **Category** | ${tA.category} | ${tB.category} |
| **Best Time** | \`${tA.timeComplexity.best}\` | \`${tB.timeComplexity.best}\` |
| **Average Time** | \`${tA.timeComplexity.avg}\` | \`${tB.timeComplexity.avg}\` |
| **Worst Time** | \`${tA.timeComplexity.worst}\` | \`${tB.timeComplexity.worst}\` |
| **Space** | \`${tA.spaceComplexity}\` | \`${tB.spaceComplexity}\` |

**Key Differences & Tradeoffs:**
• **${tA.name}**: ${tA.summary}
• **${tB.name}**: ${tB.summary}

**When to Use Which:**
• Use **${tA.name}** when: ${tA.whyItMatters}
• Use **${tB.name}** when: ${tB.whyItMatters}`;
}

function buildComplexityExplanation(topic: DSATopicDefinition, query: string): string {
  if (topic.id === "quick-sort" && /o\(n[²2]\)/i.test(query)) {
    return `### Why is Quick Sort sometimes O(n²)?

Quick Sort has an average runtime of **O(n log n)**, but degrades to **O(n²)** in the worst case.

**Cause of O(n²) Worst Case:**
1. **Unbalanced Partitions**: If the pivot chosen is always the extreme smallest or largest element (e.g. picking the last element in an already sorted or reverse-sorted array).
2. **Subproblem Sizes**: The array is partitioned into subproblems of size \`n - 1\` and \`0\` instead of two equal halves \`n/2\`.
3. **Recurrence**: \`T(n) = T(n - 1) + O(n)\` expands to \`n + (n-1) + (n-2) + ... + 1 = O(n²)\`.

**Prevention Techniques:**
• **Randomized Pivot Selection**: Pick a random index as pivot.
• **Median-of-Three**: Choose the median of the first, middle, and last elements.
• **Dual-Pivot (Yaroslavskiy)**: Used by modern standard libraries.`;
  }

  return `### Complexity Analysis: ${topic.name}

• **Best Case:** \`${topic.timeComplexity.best}\`
• **Average Case:** \`${topic.timeComplexity.avg}\`
• **Worst Case:** \`${topic.timeComplexity.worst}\`
• **Auxiliary Space:** \`${topic.spaceComplexity}\`

**Why these complexities happen:**
${topic.summary}`;
}
