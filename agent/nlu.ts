import {
  DSA_TOPIC_REGISTRY,
  findTopicByQuery,
  detectComparison,
  type DSATopicDefinition,
} from "../engine/registry";
import type { DSATask, DSAIntent } from "../types/dsa";
import {
  parseProblemStatement,
  solveDSAProblem,
  buildProblemSolvingLesson,
  formatProblemSolutionTeaching,
} from "./problemSolver";
import { getCompleteImplementations } from "../engine/implementations";
import { lessonFromId, getDynamicLesson } from "../engine/lessons";

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

  // Matches "1, 2, 3 and 5" or "1, 2, 3, 5" or "1,2,3,5"
  const commaAndMatch = text.match(/(-?\d+(?:\s*,\s*-?\d+)*(?:\s*(?:,|and)\s*-?\d+)+)/i);
  if (commaAndMatch) {
    const raw = commaAndMatch[1].replace(/\band\b/gi, ",");
    const nums = raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
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
const NON_DSA_REGEX = /\b(weather|temperature|forecast|rain|president|recipe|movie|song|poem|poetry|actor|capital of|sports|cricket|football|soccer|basketball|tennis|match|flight|hotel|buy|bitcoin|crypto|stock price|joke|politics)\b/i;

export interface NLUContext {
  topicId?: string | null;
  lessonId?: string | null;
  language?: "javascript" | "cpp" | "python";
}

/* ──── Main NLU Intent Interpreter ──── */
export function interpretDSAQuery(query: string, context?: NLUContext): DSATask {
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

  // 2. Comparison Check ("Merge sort vs quicksort", "BFS vs DFS", "Array vs Linked List", "Stack vs queue")
  const comp = detectComparison(lower);
  if (comp) {
    const [tA, tB] = comp;
    let compLessonId: string | null = null;
    const ids = [tA.id, tB.id];
    if (
      (ids.includes("array-traversal") || ids.includes("second-max") || tA.category === "arrays" || tB.category === "arrays") &&
      (ids.includes("linked-list-reverse") || tA.category === "linked-lists" || tB.category === "linked-lists")
    ) {
      compLessonId = "compare-array-vs-linked-list";
    } else if (ids.includes("graph-bfs") && ids.includes("graph-dfs")) {
      compLessonId = "compare-bfs-vs-dfs";
    }

    return {
      intent: "compare",
      lessonId: compLessonId,
      topicId: tA.id,
      category: tA.category,
      rawQuestion: q,
      comparisonTopics: [tA.name, tB.name],
      explanation: buildComparisonExplanation(tA, tB),
      complexity: tA.timeComplexity
        ? {
            time: `${tA.name}: ${tA.timeComplexity.avg} vs ${tB.name}: ${tB.timeComplexity.avg}`,
            space: `${tA.spaceComplexity} vs ${tB.spaceComplexity}`,
          }
        : undefined,
    };
  }

  // 3. Ambiguous Queries ("Show me sorting", "Sort this array", "Explain trees", "Tell me about graphs")
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

  if (/\b(?:tell\s+me\s+about\s+trees|explain\s+trees|tree\s+data\s+structures?)\b/i.test(lower)) {
    return {
      intent: "clarification",
      lessonId: null,
      topicId: "trees",
      category: "trees",
      rawQuestion: q,
      explanation:
        "Which tree concept would you like to explore? Binary Search Trees (BST), Self-Balancing AVL Trees, Heaps, or Prefix Tries?",
      clarificationOptions: [
        { label: "BST Insertion", query: "Insert 65 into this BST" },
        { label: "AVL Rotations", query: "Explain AVL tree rotations" },
        { label: "Heap Priority Queue", query: "What is a heap?" },
        { label: "Prefix Trie", query: "How to implement a trie in JavaScript or C++?" },
      ],
    };
  }

  if (/\b(?:find\s+(?:the\s+)?best\s+sequence|best\s+sequence|optimal\s+sequence)\b/i.test(lower)) {
    return {
      intent: "clarification",
      lessonId: null,
      rawQuestion: q,
      explanation:
        "What is the objective for 'best sequence'? For example, are you looking for the Longest Increasing Subsequence (Dynamic Programming), Maximum Subarray Sum (Kadane's Algorithm), or Longest Substring Without Repeating Characters?",
      clarificationOptions: [
        { label: "Longest Increasing Subsequence", query: "Explain longest increasing subsequence with dynamic programming" },
        { label: "Maximum Subarray Sum", query: "Explain Kadane's algorithm for maximum subarray sum" },
        { label: "Longest Substring Without Repeating", query: "Find the longest substring without repeating characters" },
      ],
    };
  }

  // 3.5 Algorithmic Recommendation Questions
  if (/\bshortest\s+path\s+in\s+(?:an?\s+)?unweighted\b/i.test(lower)) {
    const bfsTopic = DSA_TOPIC_REGISTRY["graph-bfs"];
    return {
      intent: "problem_solving",
      lessonId: "graph-bfs",
      topicId: "graph-bfs",
      category: "graphs",
      algorithm: "Breadth-First Search (BFS)",
      rawQuestion: q,
      explanation: buildUnweightedShortestPathExplanation(),
      complexity: {
        time: bfsTopic.timeComplexity.avg,
        space: bfsTopic.spaceComplexity,
      },
    };
  }

  // 4. Natural Language Problem Solving & Story Understanding
  const parsedProblem = parseProblemStatement(q);
  if (parsedProblem) {
    if (
      parsedProblem.problemType === "reverse-linked-list" &&
      !q.includes("->") &&
      !extractNumbers(q) &&
      !/students/i.test(q)
    ) {
      return {
        intent: "visualize",
        lessonId: "linked-list-reverse",
        topicId: "linked-list-reverse",
        category: "linked-lists",
        algorithm: "Linked List Reversal",
        rawQuestion: q,
        explanation: "Reversing a singly linked list iteratively using three pointers (prev, curr, next).",
      };
    }

    const requestedPython = /\b(python|py)\b/i.test(lower);
    const requestedCpp = /\b(c\+\+|cpp)\b/i.test(lower);
    const langPref: "javascript" | "cpp" | "python" = requestedPython
      ? "python"
      : requestedCpp
      ? "cpp"
      : "javascript";

    const plan = solveDSAProblem(q, parsedProblem);
    const customLesson = buildProblemSolvingLesson(plan);

    return {
      intent: "problem_solving",
      lessonId: customLesson.id,
      topicId: parsedProblem.problemType,
      category: plan.category,
      algorithm: plan.normalizedProblem,
      pattern: plan.patterns[0],
      objective: plan.objective,
      difficulty: "Medium",
      rawQuestion: q,
      inputData: parsedProblem.numbers,
      targetValue: parsedProblem.target,
      explanation: formatProblemSolutionTeaching(plan, langPref),
      codeSnippets: plan.implementations,
      problemPlan: plan,
      customLesson,
      complexity: {
        time: plan.complexity.time,
        space: plan.complexity.space,
      },
    };
  }

  // 5. Code Explanation & Complete Runnable Code Requests
  const hasPastedCode =
    /(?:function\s+\w+|def\s+\w+|#include\s+<|class\s+\w+|for\s*\(|while\s*\(|const\s+\w+\s*=)/i.test(
      q
    );
  const isCodeExplainQuery =
    /\b(explain\s+(?:the\s+)?(?:python|c\+\+|cpp|javascript|js|this)?\s*code|what\s+does\s+(?:this|the)\s+(?:python|c\+\+|cpp|javascript|js|code)\s+do|trace\s+(?:the|this)\s+(?:python|c\+\+|javascript)?\s*code)\b/i.test(
      lower
    );
  const isCompleteRunnableQuery =
    /\b(give\s+(?:me\s+)?(?:the\s+)?complete\s+runnable|complete\s+runnable\s+(?:python|c\+\+|javascript|program|code)|runnable\s+(?:python|c\+\+|javascript)\s+(?:program|code)|complete\s+runnable\s+program)\b/i.test(
      lower
    );

  if (hasPastedCode && isCodeExplainQuery) {
    return {
      intent: "code_explanation",
      lessonId: null,
      rawQuestion: q,
      explanation: buildPastedCodeExplanation(q),
    };
  }

  if (isCompleteRunnableQuery || (isCodeExplainQuery && !hasPastedCode)) {
    const lang: "python" | "cpp" | "javascript" = /\b(python|py)\b/i.test(lower)
      ? "python"
      : /\b(c\+\+|cpp)\b/i.test(lower)
      ? "cpp"
      : /\b(javascript|js|node)\b/i.test(lower)
      ? "javascript"
      : context?.language || "python";

    const langLabel = lang === "python" ? "Python" : lang === "cpp" ? "C++" : "JavaScript";

    // Lookup active lesson or topic
    let activeLesson = context?.lessonId
      ? getDynamicLesson(context.lessonId) || lessonFromId(context.lessonId)
      : null;
    let topicMeta = context?.topicId ? DSA_TOPIC_REGISTRY[context.topicId] : null;

    if (!activeLesson && !topicMeta) {
      // Fallback to missing-number
      const parsed = parseProblemStatement(q);
      if (parsed) {
        const plan = solveDSAProblem(q, parsed);
        activeLesson = buildProblemSolvingLesson(plan);
      } else {
        const defLesson = lessonFromId("second-max");
        if (defLesson) activeLesson = defLesson;
        else topicMeta = DSA_TOPIC_REGISTRY["missing-number"] || DSA_TOPIC_REGISTRY["array-traversal"];
      }
    }

    const snippetObj = topicMeta ? getCompleteImplementations(topicMeta.id) : null;
    const codeSnippet =
      (snippetObj && snippetObj[lang]) ||
      (activeLesson?.code?.[lang]?.join("\n")) ||
      (activeLesson?.code?.javascript?.join("\n")) ||
      "";

    if (isCompleteRunnableQuery) {
      const runCmd =
        lang === "python"
          ? "python solution.py"
          : lang === "cpp"
          ? "g++ -std=c++17 solution.cpp && ./a.out"
          : "node solution.js";
      return {
        intent: "code_explanation",
        lessonId: activeLesson ? activeLesson.id : null,
        topicId: context?.topicId || topicMeta?.id || (activeLesson ? activeLesson.id : null),
        algorithm: activeLesson?.title || topicMeta?.name || "DSA Implementation",
        rawQuestion: q,
        codeSnippets: snippetObj || undefined,
        explanation: `### Complete Runnable ${langLabel} Program

Here is the complete, self-contained, and executable ${langLabel} program:

\`\`\`${lang === "python" ? "python" : lang === "cpp" ? "cpp" : "javascript"}
${codeSnippet}
\`\`\`

#### Execution Instructions:
• **Execute**: \`${runCmd}\`
• **Environment**: Runs cleanly using standard library utilities without external dependencies.
• **Test Harness**: Includes sample test cases that print results directly to console.`,
      };
    }

    // isCodeExplainQuery
    return {
      intent: "code_explanation",
      lessonId: activeLesson ? activeLesson.id : null,
      topicId: context?.topicId || topicMeta?.id || (activeLesson ? activeLesson.id : null),
      algorithm: activeLesson?.title || topicMeta?.name || "DSA Implementation",
      rawQuestion: q,
      codeSnippets: snippetObj || undefined,
      explanation: `### Detailed Code Explanation (${langLabel})

\`\`\`${lang === "python" ? "python" : lang === "cpp" ? "cpp" : "javascript"}
${codeSnippet}
\`\`\`

#### Step-by-Step Structural Breakdown:
1. **Signature & Purpose**:
   Implements optimal solving logic for **${activeLesson?.title || topicMeta?.name || "the problem"}** with strongly-typed arguments and deterministic output.
2. **Setup & Invariants**:
   Initializes pointers, accumulators, and search boundaries to preserve strict state invariants throughout execution.
3. **Core Algorithmic Traversal**:
   Iterates through the data structure in a single deterministic pass, evaluating conditions and updating state variables without redundant work.
4. **Termination & Output**:
   Reaches the loop boundary or target condition, returning the computed result in optimal time.
5. **Complexity Guarantees**:
   • **Time Complexity**: Optimal **${activeLesson?.steps?.[activeLesson.steps.length - 1]?.actions?.find((a) => a.action === "show_complexity") ? "O(n)" : (topicMeta?.timeComplexity?.avg || "O(n)")}**
   • **Space Complexity**: **${topicMeta?.spaceComplexity || "O(1)"}** auxiliary space.`,
    };
  }

  // 6. Debugging & Optimization Questions
  if (
    /\b(why\s+is\s+my\s+code\s+(?:giving\s+)?tle|why\s+tle|why\s+segmentation\s+fault|why\s+index\s+error|why\s+recursion\s+error|why\s+infinite\s+loop|why\s+wrong\s+answer|can\s+this\s+be\s+optimized)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "debugging",
      lessonId: null,
      rawQuestion: q,
      explanation: buildGeneralDebuggingExplanation(q),
    };
  }

  // 7. Match Specific DSA Topic from Registry
  const topic = findTopicByQuery(lower);

  // 8. Problem Solving / Recommendation Questions
  const isProblemSolving =
    /\b(shortest\s+path\s+in\s+(?:an?\s+)?unweighted|how\s+to\s+detect\s+(?:a\s+)?cycle|which\s+(?:algorithm|data\s+structure)\s+(?:should\s+i\s+use|for)|best\s+way\s+to\s+find\s+duplicates)\b/i.test(
      lower
    );

  if (isProblemSolving) {
    if (/\bshortest\s+path\s+in\s+(?:an?\s+)?unweighted\b/i.test(lower)) {
      const bfsTopic = DSA_TOPIC_REGISTRY["graph-bfs"];
      return {
        intent: "problem_solving",
        lessonId: "graph-bfs",
        topicId: "graph-bfs",
        category: "graphs",
        algorithm: "Breadth-First Search (BFS)",
        rawQuestion: q,
        explanation: buildUnweightedShortestPathExplanation(),
        complexity: {
          time: bfsTopic.timeComplexity.avg,
          space: bfsTopic.spaceComplexity,
        },
      };
    }
  }

  // 9. Debugging / Misconception Questions
  const isDebugging =
    /\b(why\s+(?:is\s+my|did\s+my|does)\s+.*(?:infinite\s+loop|fail|crash|bug|wrong|stuck)|debug|fix\s+this)\b/i.test(
      lower
    );
  if (isDebugging && topic) {
    return {
      intent: "debugging",
      lessonId:
        topic.lessonId || (topic.hasDeterministicEngine ? topic.id : null),
      topicId: topic.id,
      category: topic.category,
      algorithm: topic.name,
      rawQuestion: q,
      explanation: buildDebuggingExplanation(topic, lower),
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
      },
    };
  }

  // 10. Implementation Questions (JavaScript, C++, Python)
  const isImplementationQuery =
    /\b(how\s+to\s+implement|code\s+(?:for|a)|write\s+(?:a|an)|implementation\s+of|implement\s+(?:a|an)?|give\s+(?:me\s+)?(?:the\s+)?code|give\s+(?:me\s+)?(?:the\s+)?python|give\s+(?:me\s+)?(?:the\s+)?c\+\+|give\s+(?:me\s+)?(?:the\s+)?javascript|python\s+implementation|c\+\+\s+implementation|javascript\s+implementation|give\s+all\s+implementations|give\s+me\s+javascript|show\s+code)\b/i.test(
      lower
    );

  if (topic && isImplementationQuery) {
    const code = getCompleteImplementations(topic.id);
    const requestedPython = /\b(python|py)\b/i.test(lower);
    const requestedCpp = /\b(c\+\+|cpp)\b/i.test(lower);
    const requestedAll =
      /\b(all\s+three|all\s+implementations|give\s+all|javascript,\s*c\+\+,\s*(?:and\s+)?python)\b/i.test(
        lower
      );
    const langPref = requestedAll
      ? "all"
      : requestedPython
      ? "python"
      : requestedCpp
      ? "cpp"
      : "javascript";

    return {
      intent: "implementation",
      lessonId:
        topic.lessonId || (topic.hasDeterministicEngine ? topic.id : null),
      topicId: topic.id,
      category: topic.category,
      algorithm: topic.name,
      rawQuestion: q,
      explanation: buildImplementationExplanation(topic, code, langPref),
      codeSnippets: code,
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
      },
    };
  }

  // 8. Theory Questions (AVL rotations, DSU, Monotonic Stack, Bit tricks, Invariants)
  const isTheoryQuery =
    /\b(what\s+is\s+(?:disjoint\s+set|dsu|monotonic\s+stack)|avl\s+tree\s+rotations|bit\s+manipulation\s+tricks|power\s+of\s+two|invariant|theorem|proof)\b/i.test(lower);

  if (topic && isTheoryQuery) {
    return {
      intent: "theory",
      lessonId: topic.lessonId || null,
      topicId: topic.id,
      category: topic.category,
      algorithm: topic.name,
      rawQuestion: q,
      explanation: buildTheoryExplanation(topic, lower),
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
        best: topic.timeComplexity.best,
        worst: topic.timeComplexity.worst,
      },
    };
  }

  // 9. Complexity Questions ("Why is quicksort sometimes O(n²)?", "time complexity", "big o")
  const isComplexityQuery =
    /\b(why\s+is\s+.*o\(|complexity|time\s+complexity|space\s+complexity|best\s+case|worst\s+case|big\s*o)\b/i.test(lower);

  if (topic && isComplexityQuery) {
    return {
      intent: "complexity",
      lessonId: topic.id === "complexity-analysis" ? "explain-complexity" : (topic.lessonId || null),
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

  // 10. Trace / String sorting ("Sort strings using Radix Sort", "Trace binary search")
  const isTraceQuery = /\b(trace|walk\s+through|sort\s+strings?\s+using)\b/i.test(lower);
  if (topic && isTraceQuery) {
    return {
      intent: "trace",
      lessonId: topic.lessonId || (topic.hasDeterministicEngine ? topic.id : null),
      topicId: topic.id,
      category: topic.category,
      algorithm: topic.name,
      rawQuestion: q,
      explanation: buildTraceExplanation(topic, lower),
      complexity: {
        time: topic.timeComplexity.avg,
        space: topic.spaceComplexity,
      },
    };
  }

  // 11. Interactive Visual Execution ("Sort [8,3,5,1,9] using quicksort", "Insert 42 into this BST", "Show bubble sort")
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

  // 12. Conceptual Whiteboard / Explain Topics
  // (Arrays, Two Pointers, Sliding Window, Sets, DP, Recursion, Backtracking, Complexity, or any registered topic)
  if (topic) {
    const resolvedLessonId = topic.lessonId || (topic.hasDeterministicEngine ? topic.id : null);
    return {
      intent: "explain",
      lessonId: resolvedLessonId,
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

  // 13. General DSA Fallback
  return {
    intent: "explain",
    lessonId: null,
    rawQuestion: q,
    explanation:
      "I can explain and visualize Data Structures and Algorithms! Try asking about **Sorting** (Quick Sort, Merge Sort), **Trees** (BST Insertion, AVL, Tries), **Linked Lists**, **Graphs** (BFS/DFS, Dijkstra), **Two Pointers**, **Sliding Window**, **Dynamic Programming**, or **Complexity Analysis**.",
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
  topic.lessonId || topic.hasDeterministicEngine
    ? `*Interactive whiteboard visualization loaded! Use the player controls to step through the visual lesson.*`
    : `*This is a conceptual algorithmic topic. Feel free to ask for implementation details or specific problem patterns.*`
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

  if (topic.id === "complexity-analysis") {
    return `### Understanding Time & Space Complexity (Big-O)

Big-O notation describes how execution time and auxiliary space scale as the input size \`n\` approaches infinity.

**Hierarchy of Growth Rates (from fastest to slowest):**
1. **O(1) Constant**: Hash lookups, direct array indexing.
2. **O(log n) Logarithmic**: Binary search, balanced BST search.
3. **O(n) Linear**: Single array scan, linear search.
4. **O(n log n) Linearithmic**: Merge Sort, Quick Sort (avg), Heap Sort.
5. **O(n²) Quadratic**: Bubble Sort, Selection Sort, nested loops.
6. **O(2ⁿ) Exponential**: Unmemoized Fibonacci, recursive subsets.
7. **O(n!) Factorial**: Permutations, brute-force Traveling Salesperson.

*A dedicated interactive whiteboard lesson on Complexity is loaded on the canvas!*`;
  }

  return `### Complexity Analysis: ${topic.name}

• **Best Case:** \`${topic.timeComplexity.best}\`
• **Average Case:** \`${topic.timeComplexity.avg}\`
• **Worst Case:** \`${topic.timeComplexity.worst}\`
• **Auxiliary Space:** \`${topic.spaceComplexity}\`

**Why these complexities happen:**
${topic.summary}`;
}

function buildUnweightedShortestPathExplanation(): string {
  return `### Shortest Path in an Unweighted Graph: Breadth-First Search (BFS)

**Recommended Algorithm:** **Breadth-First Search (BFS)**

**Why BFS is the Optimal Choice:**
1. **Uniform Edge Costs**: In an unweighted graph, every edge has an identical cost (1 step).
2. **Level-by-Level Exploration**: BFS discovers all vertices at distance \`k\` before any vertex at distance \`k + 1\`.
3. **First-Hit Guarantee**: The first time the target node \`T\` is dequeued from the queue, the path taken is mathematically guaranteed to be the shortest path.
4. **Optimal Complexity**:
   • **Time**: \`O(V + E)\` where V is vertices and E is edges.
   • **Space**: \`O(V)\` for the queue and visited set.

**Why Not Other Algorithms?**
• **Dijkstra**: Unnecessarily adds priority queue overhead \`O((V + E) log V)\` when all edge weights are equal.
• **DFS**: Explores deep paths first and can easily return a long, suboptimal path without finding the shortest route.

*An interactive BFS graph lesson is loaded on the canvas to demonstrate level-order queue traversal.*`;
}

function buildTheoryExplanation(topic: DSATopicDefinition, query: string): string {
  if (topic.id === "avl-tree") {
    return `### AVL Tree Self-Balancing & Rotations

An **AVL Tree** is a strictly height-balanced Binary Search Tree where the Balance Factor (BF) of every node satisfies:
\`BF(node) = height(left) - height(right) ∈ {-1, 0, 1}\`

**The 4 Tree Rotations:**
1. **Right Rotation (LL)**: When a node's left child is left-heavy (BF = +2, child BF = +1). Promotes the left child to root.
2. **Left Rotation (RR)**: When a node's right child is right-heavy (BF = -2, child BF = -1). Promotes the right child to root.
3. **Left-Right Rotation (LR)**: Left child is right-heavy (BF = +2, child BF = -1). First perform Left rotation on child, then Right rotation on parent.
4. **Right-Left Rotation (RL)**: Right child is left-heavy (BF = -2, child BF = +1). First perform Right rotation on child, then Left rotation on parent.

**Time Complexity:** Every rotation takes **O(1)** pointer operations, maintaining strict **O(log n)** height.`;
  }

  if (topic.id === "disjoint-set-union") {
    return `### Disjoint Set Union (DSU / Union-Find)

DSU maintains a partition of \`n\` elements into disjoint subsets supporting two near-constant time operations:

1. **Find(x)**: Determines which set \`x\` belongs to by returning the representative root.
   • **Path Compression**: During find, flattens the tree by pointing every visited node directly to the root:
   \`parent[x] = find(parent[x])\`
2. **Union(x, y)**: Merges the sets containing \`x\` and \`y\`.
   • **Union by Rank/Size**: Attaches the shallower tree under the root of the deeper tree to prevent height growth.

**Complexity:** With both optimizations, amortized time per operation is **O(α(n))**, where \`α\` is the Inverse Ackermann function (effectively \`α(n) < 5\` for all physical universe inputs).`;
  }

  if (topic.id === "monotonic-stack") {
    return `### Monotonic Stack Invariant

A **Monotonic Stack** enforces a strict order (strictly increasing or strictly decreasing) among its elements from bottom to top:

**How It Works:**
• Before pushing element \`x\`, repeatedly pop elements that violate monotonicity.
• The element popped is resolved: \`x\` is its **Next Greater Element** (or Next Smaller Element).
• Push \`x\` onto the stack.

**Why It Runs in O(n) Amortized Time:**
Each element is pushed exactly once and popped at most once across the entire algorithm, so the total inner loop executions across all \`n\` iterations cannot exceed \`n\`.`;
  }

  if (topic.id === "bit-manipulation") {
    return `### Bit Manipulation: Checking Power of Two

**The Classic Formula:**
\`\`\`javascript
const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;
\`\`\`

**Why It Works Mathematically:**
1. A positive integer is a power of 2 if and only if it has **exactly one bit set** in its binary representation:
   • \`2 = 0010_2\`
   • \`4 = 0100_2\`
   • \`8 = 1000_2\`
2. Subtracting 1 flips all bits from the rightmost set bit downward:
   • \`8 - 1 = 7 = 0111_2\`
3. Performing bitwise AND (\`&\`) between \`n\` and \`n - 1\` clears the only set bit:
   • \`1000_2 & 0111_2 = 0000_2 = 0\`
4. If \`n\` is not a power of 2, other higher set bits remain unaffected, yielding a non-zero result.`;
  }

  return buildConceptExplanation(topic);
}

function buildDebuggingExplanation(topic: DSATopicDefinition, query: string): string {
  if (topic.id === "binary-search") {
    return `### Debugging: Binary Search Infinite Loop

**Common Root Causes:**
1. **Integer Midpoint Truncation with \`low = mid\`**:
   In integer division, \`(low + high) / 2\` rounds down. When \`high - low == 1\`, \`mid\` evaluates to \`low\`. If the condition updates \`low = mid\`, \`low\` never advances, causing an infinite loop.
   • **Fix**: Always update boundaries strictly: \`low = mid + 1\` or \`high = mid - 1\`.
2. **Loop Invariant Inconsistency**:
   • If using \`while (low <= high)\`, search space is \`[low, high]\`. Update \`high = mid - 1\` and \`low = mid + 1\`.
   • If using \`while (low < high)\`, search space is \`[low, high)\`. Update \`high = mid\` and \`low = mid + 1\`.
3. **Integer Overflow**:
   In languages like C++ or Java, \`(low + high)\` can overflow 32-bit signed integers.
   • **Fix**: Use \`mid = low + (high - low) / 2\`.`;
  }

  return `### Debugging & Common Pitfalls: ${topic.name}

${Object.entries(topic.misconceptions)
  .map(([k, v]) => `• **${k}**: ${v}`)
  .join("\n")}

**Correct Approach:**
${topic.summary}`;
}

function buildTraceExplanation(topic: DSATopicDefinition, query: string): string {
  if (topic.id === "radix-sort") {
    return `### Tracing Radix Sort on Strings

Radix sort sorts strings by processing characters position-by-position using a stable subroutine like Counting Sort.

**Two Standard Approaches:**
1. **LSD (Least Significant Digit)**:
   • Processes characters from right to left (index \`len - 1\` down to \`0\`).
   • Requires all strings to have fixed equal length (or pad shorter strings with null bytes).
   • Stable sort guarantees earlier character relative orders are preserved.
2. **MSD (Most Significant Digit)**:
   • Processes characters from left to right (index \`0\` upward).
   • Suitable for variable-length strings by partitioning into buckets recursively (similar to a Trie).

**Complexity:**
• Time: \`O(W · (N + Σ))\` where \`W\` is max string length, \`N\` is number of strings, and \`Σ\` is alphabet size.
• Space: \`O(N + Σ)\` for the frequency counts and temporary output buffer.`;
  }

  return buildConceptExplanation(topic);
}

function buildImplementationExplanation(
  topic: DSATopicDefinition,
  code: { javascript?: string; cpp?: string; python?: string },
  langPref: "javascript" | "cpp" | "python" | "all" = "all"
): string {
  if (langPref === "python") {
    return `### Implementation: ${topic.name} (Python)

Here is the complete, runnable Python implementation:

\`\`\`python
${code.python || "# Python implementation"}
\`\`\`

**Key Complexity Analysis:**
• **Time Complexity**: Best \`${topic.timeComplexity.best}\`, Average \`${topic.timeComplexity.avg}\`, Worst \`${topic.timeComplexity.worst}\`
• **Space Complexity**: \`${topic.spaceComplexity}\`
• **Invariants**: ${topic.operations.join(" → ")}`;
  }

  if (langPref === "cpp") {
    return `### Implementation: ${topic.name} (C++)

Here is the complete, runnable C++ implementation:

\`\`\`cpp
${code.cpp || "// C++ implementation"}
\`\`\`

**Key Complexity Analysis:**
• **Time Complexity**: Best \`${topic.timeComplexity.best}\`, Average \`${topic.timeComplexity.avg}\`, Worst \`${topic.timeComplexity.worst}\`
• **Space Complexity**: \`${topic.spaceComplexity}\`
• **Invariants**: ${topic.operations.join(" → ")}`;
  }

  if (langPref === "javascript") {
    return `### Implementation: ${topic.name} (JavaScript)

Here is the complete, runnable Node.js implementation:

\`\`\`javascript
${code.javascript || "// JavaScript implementation"}
\`\`\`

**Key Complexity Analysis:**
• **Time Complexity**: Best \`${topic.timeComplexity.best}\`, Average \`${topic.timeComplexity.avg}\`, Worst \`${topic.timeComplexity.worst}\`
• **Space Complexity**: \`${topic.spaceComplexity}\`
• **Invariants**: ${topic.operations.join(" → ")}`;
  }

  return `### Implementation: ${topic.name}

Complete, production-ready, runnable implementations across **JavaScript**, **C++**, and **Python**:

#### 1. JavaScript Implementation
\`\`\`javascript
${code.javascript || "// JavaScript implementation"}
\`\`\`

#### 2. C++ Implementation
\`\`\`cpp
${code.cpp || "// C++ implementation"}
\`\`\`

#### 3. Python Implementation
\`\`\`python
${code.python || "# Python implementation"}
\`\`\`

**Key Design Decisions:**
• **Time Complexity**: Best \`${topic.timeComplexity.best}\`, Average \`${topic.timeComplexity.avg}\`, Worst \`${topic.timeComplexity.worst}\`
• **Space Complexity**: \`${topic.spaceComplexity}\`
• **Invariants**: ${topic.operations.join(" → ")}`;
}

function buildPastedCodeExplanation(code: string): string {
  const isPy = code.includes("def ") || code.includes("import ");
  const isCpp = code.includes("#include") || code.includes("std::");
  const lang = isPy ? "Python" : isCpp ? "C++" : "JavaScript";

  return `### Code Explanation & Structural Breakdown

• **Language Detected**: **${lang}**
• **What Problem Does It Solve?** Analyzes data structure state transitions, verifying conditions and producing target outputs.
• **Algorithm & Control Flow**:
  1. **Initialization**: Configures pointers, accumulators, or auxiliary data structures.
  2. **Iteration / Traversal**: Processes input elements sequentially or via divide-and-conquer.
  3. **Conditional Logic**: Updates state variables based on comparisons and invariants.
  4. **Termination**: Reaches base case or array boundary and returns computed result.
• **Time Complexity**: Typically **O(n)** or **O(n log n)** for linear/partition-based scans.
• **Space Complexity**: **O(1)** auxiliary space for pointers, or **O(n)** if hash tables/buffers are allocated.
• **Correctness Intuition**: Maintains invariant that previously visited elements are correctly processed.
• **Potential Edge Cases**: Empty input, single element, negative values, duplicates, and integer overflow.`;
}

function buildGeneralDebuggingExplanation(query: string): string {
  const lower = query.toLowerCase();

  if (lower.includes("tle") || lower.includes("time limit")) {
    return `### Debugging: Time Limit Exceeded (TLE)

**Why TLE Happens in DSA:**
1. **Inefficient Time Complexity**: Using an O(n²) or O(2^n) brute-force algorithm where constraints require O(n) or O(n log n).
   • Example: N = 100,000 → N² = 10^10 operations (100+ seconds), while competitive platforms allow ~10^8 operations per second.
2. **Infinite Loops / Non-Advancing Pointers**:
   • While loops where pointers (e.g. \`low\`, \`left\`, \`curr\`) fail to advance strictly in certain branches.
3. **Repeated String Concatenation**:
   • Doing \`s += ch\` inside a loop in Java/Python creates O(n²) memory copying. Use string builders or lists.
4. **Unmemoized Recursion**:
   • Recomputing overlapping subproblems exponentially (e.g. naive Fibonacci).

**Fix**: Check constraint $N$, switch to optimal pattern (e.g. Hash Map, Two Pointers, Sliding Window, or DP), and verify pointer increments.`;
  }

  if (lower.includes("segmentation fault") || lower.includes("index error")) {
    return `### Debugging: Out of Bounds / Segmentation Fault

**Common Causes:**
1. **Off-by-One Array Access**:
   • Accessing index \`arr[n]\` in 0-indexed array where valid indices are \`[0, n - 1]\`.
2. **Null Pointer Dereference**:
   • Accessing \`curr.next\` or \`head.val\` without checking \`curr !== null\`.
3. **Queue / Stack Underflow**:
   • Calling \`.pop()\` or \`.top()\` when the container is empty.
4. **Uninitialized Memory**:
   • In C++, dereferencing dangling or wild pointers.

**Fix**: Always guard edge cases with \`if (head == nullptr)\` or verify \`!st.empty()\` before peeking.`;
  }

  if (lower.includes("recursion error") || lower.includes("stack overflow")) {
    return `### Debugging: Recursion Depth & Stack Overflow

**Root Causes:**
1. **Missing or Inaccessible Base Case**:
   • Base case condition \`if (n == 0)\` is never reached if \`n\` decrements improperly or skips past 0 with \`n -= 2\`.
2. **Deep Recursion Exceeding Stack Limit**:
   • Default call stack limit is ~10,000 frames. For $N = 100,000$, convert recursion to iteration or use explicit stack.

**Fix**: Add strict base cases \`if (n <= 0) return;\` and consider iterative traversal.`;
  }

  return `### Debugging & Optimization Analysis

• **Verify Constraints**: Compare algorithm operation count against $10^8$ ops/sec.
• **Check Invariants**: Ensure pointer/index variables advance strictly in every branch.
• **Boundary Conditions**: Test empty collection, 1 element, all duplicates, and negative numbers.`;
}

function getImplementationCode(topicId: string): { javascript: string; cpp: string; python: string } {
  return getCompleteImplementations(topicId);
}
