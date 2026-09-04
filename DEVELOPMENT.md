# SmartZero — Contributor & Developer Guide

> A practical guide for developers and contributors adding algorithms, lessons, problem solvers, or extending the semantic whiteboard engine in SmartZero.

---

## 1. Development Principles & Code Conventions

1. **Strict TypeScript**: `tsconfig.json` enforces `strict: true`, `noImplicitAny: true`, and strict null checks. Never use `any` unless required for third-party dynamic serialization.
2. **AI Decides WHAT. The Engine Decides HOW**: Never allow an LLM or prompt to emit pixel coordinates ($x, y$), SVG shapes, or Excalidraw JSON. The AI generates semantic intent; the deterministic engine computes geometry.
3. **Pure Deterministic Replay**: State transitions must be pure functions of `(state, action) => newState`. Stepping forward or backward must produce identical states.
4. **Zero Cross-Contamination**: Every asynchronous operation that modifies workspace state must verify the monotonic `sequenceToken` before committing.
5. **No Secret Leaks**: Never prefix server API keys with `NEXT_PUBLIC_`. All AI inference occurs in route handlers under `app/api/`.

---

## 2. Where to Add a New Canonical DSA Algorithm

Adding a new canonical algorithm (e.g., *Topological Sort* or *Kruskal's MST*) requires three steps:

### Step 1: Register the Topic in `engine/registry.ts`
Add a new `DSATopicDefinition` entry to `DSA_TOPIC_REGISTRY`:

```typescript
// in engine/registry.ts:
"topological-sort": {
  id: "topological-sort",
  name: "Topological Sort",
  category: "graphs",
  aliases: ["kahn's algorithm", "topo sort", "dag ordering"],
  keywords: ["dag", "in-degree", "dependency resolution"],
  operations: ["compute in-degree", "enqueue zero in-degree", "peel vertices"],
  timeComplexity: { best: "O(V + E)", avg: "O(V + E)", worst: "O(V + E)" },
  spaceComplexity: "O(V)",
  hasDeterministicEngine: true,
  visualType: "graph",
  summary: "Linear ordering of vertices such that for every directed edge u -> v, u comes before v.",
  whyItMatters: "Fundamental for build systems, task scheduling, and package dependency managers.",
  misconceptions: {
    CYCLE_ERROR: "Topological sort cannot be performed on graphs with directed cycles."
  }
}
```

### Step 2: Implement the Deterministic Builder
Create a builder function that emits typed `LessonStep` items in the appropriate module (`engine/graph.ts`, `engine/sorting.ts`, or `engine/linearStructures.ts`):

```typescript
// in engine/graph.ts:
export function buildTopologicalSortLesson(): Lesson {
  const steps: LessonStep[] = [
    {
      actions: [
        { action: "reset_scene" },
        { action: "create_graph", nodes: [...], edges: [...] },
        { action: "show_operation_card", title: "Initialize In-Degrees", formula: "Compute in-degrees for all V", decision: "Find nodes with in-degree = 0" }
      ],
      codeLine: "calc_indegree",
      explanation: "We first count the incoming directed edges for each vertex."
    },
    // Add subsequent deterministic steps...
  ];

  return {
    id: "topological-sort",
    title: "Topological Sort (Kahn's Algorithm)",
    steps
  };
}
```

### Step 3: Register in `engine/lessons.ts`
Link your builder into `SUPPORTED_LESSONS` and the `lessonFromId` lookup map:

```typescript
// in engine/lessons.ts:
import { buildTopologicalSortLesson } from "./graph";

export const SUPPORTED_LESSONS = [
  // ...
  buildTopologicalSortLesson(),
];
```

---

## 3. Where to Add a Natural-Language Problem Solver

To teach an algorithmic interview question or contest problem (e.g., *Trapping Rain Water*):

### Step 1: Detect the Pattern in `agent/problemSolver.ts`
In `parseProblemStatement(query: string)`:
```typescript
if (/\b(?:trapping\s+rain\s*water|trap\s+water|rainwater)\b/i.test(lower)) {
  return {
    problemType: "trapping-rain-water",
    numbers: extractNumbers(query),
    storyContext: "Elevation map container"
  };
}
```

### Step 2: Implement the Specialized Solver
Define `solveTrappingRainWater(info: ParsedProblemInfo): ProblemSolutionPlan`:
- Extract elevation numbers (or provide standard default: `[0,1,0,2,1,0,1,3,2,1,2,1]`).
- Formulate Candidate Approaches (Brute Force $O(n^2)$, Two-Pointer Optimal $O(n)$).
- Generate `dryRun` variable transitions.
- Emit `visualSteps` using the semantic visual DSL (`create_array`, `set_pointer`, `show_operation_card`, `set_variable`).
- Provide idiomatic solutions in JavaScript, Python, and C++.

### Step 3: Register in `buildSolutionPlan()`
Add a `case "trapping-rain-water":` to the master switch in `agent/problemSolver.ts`.

---

## 4. Modifying the Whiteboard Canvas (`components/SemanticCanvas.tsx`)

When enhancing or adjusting whiteboard rendering:
1. **Adhere to the Hero Layout ($y \approx 110$)**:
   - The primary data structure must sit directly beneath the whiteboard header.
   - Do not push data structures off-screen by inserting tall text boxes above them.
2. **Preserve Pointer Collision Grouping**:
   - Check if pointers point to identical indices using the collision grouping utility.
   - Pointers at the same cell must be rendered as composite banners (e.g. `↓ low, mid`).
3. **Maintain High Contrast**:
   - Array cells use dimensions of $76\text{px} \times 62\text{px}$.
   - Ensure color tokens comply with dark and light themes (Slate for default, Amber for pivot, Emerald for sorted/selected).

---

## 5. Adding & Running Tests

All automated tests are organized under `tests/` and executed with `tsx`:

### Adding a Test
Create or update a test suite in `tests/`:
```typescript
import { test, assert } from "./test_helpers";
import { parseProblemStatement } from "../agent/problemSolver";

test("Trapping Rain Water routes correctly", () => {
  const parsed = parseProblemStatement("How much rainwater can be trapped in [0,1,0,2]?");
  assert(parsed !== null, "Must detect problem");
  assert(parsed?.problemType === "trapping-rain-water", "Must route to trapping-rain-water");
});
```

### Verification Pipeline
Before submitting any pull request or finalizing work, execute the four verification gates:

```bash
# 1. Type validation
npm run typecheck

# 2. Code style & linting
npm run lint

# 3. All 15 automated test suites
npm test

# 4. Full production build compilation
npm run build
```

---

## 6. Common Development Pitfalls

| Pitfall | Why It Breaks | Correct Pattern |
|:---|:---|:---|
| **AI emitting pixel coordinates** | Breaks backward replay, causes screen drift, overlaps elements. | AI outputs typed `DSLAction` objects; canvas calculates layout. |
| **Force-matching unknown questions** | A user asking about "Decrement or Increment" gets shown a Two-Pointer lesson. | Route unknown or arithmetic problems to dedicated solvers or generic plans. |
| **Omitting sequence token checks** | Rapid tab clicks or slow AI responses contaminate adjacent workspaces. | Verify `sequenceToken === currentWorkspace.sequenceToken` before state updates. |
| **Directly mutating canvas scene** | Stale elements accumulate when stepping backward or resetting. | Always execute pure `replay(steps, upto)` to reconstruct the frame. |
| **Using `NEXT_PUBLIC_` for AI keys** | Exposes the Featherless API key in the public client bundle. | Keep `FEATHERLESS_API_KEY` server-side only in `.env.local`. |

---

*For common operational problems and fixes, proceed to [TROUBLESHOOTING.md](TROUBLESHOOTING.md).*
