# SmartZero — AI Agent Architecture & Reasoning Pipeline

> A comprehensive specification of the SmartZero AI Agent subsystem, natural-language understanding (NLU), story normalization pipeline, model routing, and deterministic fallback mechanics.

---

## 1. Overview of the AI Layer

The SmartZero AI Agent serves as an intelligent pedagogical copilot. Its purpose is **not** to generate raw drawing coordinates or simulate memory mutations in an ungrounded LLM context, but to:
1. **Understand Intent**: Accurately classify what kind of help the learner needs (e.g., visual demonstration, theoretical explanation, complexity analysis, code debugging).
2. **Normalize Story Problems**: Strip competitive programming story wrappers (e.g., "Chef", "Alice and Bob", "Kingdoms and Bridges") and extract core computational parameters (inputs, targets, constraints).
3. **Synthesize Structured Teaching Plans**: Formulate a step-by-step pedagogical progression with clear objectives, candidate approach trade-offs, and verification steps.
4. **Evaluate Learner Predictions**: Diagnose learner predictions during interactive steps and provide targeted feedback without revealing the final solution prematurely.

---

## 2. NLU & Intent Classification (`agent/nlu.ts`)

Incoming user queries pass through `interpretDSAQuery` in `agent/nlu.ts`. The NLU engine classifies requests into one of 14 typed intents defined in `ai/schemas.ts`:

| Intent Enum | Description | Example Query |
|:---|:---|:---|
| `visualize` | Requests an animated whiteboard walkthrough | *"Show me Bubble Sort step-by-step"* |
| `explain` | Conceptual or theoretical explanation | *"What is an AVL tree and why do we rotate?"* |
| `theory` | Deep algorithmic invariants or proofs | *"Why does Dijkstra fail with negative edges?"* |
| `implementation`| Multi-language code request | *"Write Kadane's algorithm in C++ and Python"* |
| `trace` | Step-by-step dry-run on specific inputs | *"Trace Binary Search on [1, 3, 7, 9] for target 7"* |
| `complexity` | Big-O time and space complexity inquiry | *"What is the worst-case space complexity of Merge Sort?"* |
| `compare` | Direct comparison between two techniques | *"Compare BFS vs DFS"* or *"Array vs Linked List"* |
| `problem_solving`| Story, competitive programming, or custom problem | *"Chef has 4 numbers... find the missing number"* |
| `debugging` | Finding a bug in learner-submitted code | *"Why does my while loop give an off-by-one error?"* |
| `code_explanation`| Explaining an existing code snippet | *"Explain line 12 in the quicksort implementation"* |
| `example` | Requesting concrete input/output examples | *"Give me an example of a monotonic stack problem"* |
| `edge_case` | Exploring boundary and edge conditions | *"What happens in Two Sum if no pair exists?"* |
| `clarification`| Ambiguous request requiring disambiguation | *"Help me with trees"* |
| `unsupported_non_dsa`| Queries outside the computer science domain | *"What is the weather today?"* |

---

## 3. Story Normalization & Problem Parsing (`agent/problemSolver.ts`)

Learners frequently paste questions from LeetCode, Codeforces, HackerRank, or university exams that wrap simple algorithms inside elaborate story scenarios:

```text
Story Input:
"Chef has 4 pieces of paper with numbers 1, 2, 4, 5.
 The numbers were supposed to add up to 15.
 One piece of paper was dropped.
 Find the missing number."
                      │
                      ▼
[NLU Normalization: parseProblemStatement()]
                      │
                      ├─ Extracted Numbers: [1, 2, 4, 5]
                      ├─ Extracted Target / Sum: 15
                      ├─ Problem Category: "math / arrays"
                      ├─ Canonical Problem Type: "missing-number"
                      └─ Normalized Task: "Find missing integer in range [1..5]"
```

### Zero False-Positive Routing Safeguard
A critical defect in naive DSA chatbots is **force-matching**: mapping an unknown question to an unrelated popular topic simply because it mentions numbers or arrays.

> [!IMPORTANT]
> **Strict Anti-Cross-Contamination Rule**:
> SmartZero's problem parser explicitly enforces that arithmetic, story, or logic problems **MUST NEVER** be force-matched to unrelated canonical topics:
> - *"Decrement OR Increment N by 1 if divisible by 4"* routes strictly to `decrement-or-increment` (never to Two Pointers or Array Traversal).
> - *"Given A, B, C, print YES if avg(A, B) > C"* routes strictly to `greater-average` (never to Graph BFS).
> - Generic math operations generate a `generic-arithmetic-comparison` or `generic-programming-problem` plan with dedicated visual steps.

---

## 4. The 42 Specialized Problem Solvers

`agent/problemSolver.ts` provides complete, deterministic solution plans for 42 specialized problem classes:

1. **Arrays & Subarrays**: `two-sum`, `max-subarray` (Kadane), `stock-buy-sell`, `move-zeroes`, `remove-duplicates`, `max-subarray-k`, `prefix-sum`, `longest-substring-no-repeat`.
2. **Searching & Sorting**: `binary-search`, `search-rotated-array`, `second-max`.
3. **Linked Lists**: `reverse-linked-list`, `detect-linked-list-cycle`.
4. **Stacks & Queues**: `valid-parentheses`, `queue-using-stacks`, `next-greater-element`.
5. **Hash Tables & Sets**: `missing-number`, `first-repeating-element`, `top-k-frequent`.
6. **Trees & Heaps**: `tree-traversal`, `bst-search`, `heap-sort`.
7. **Graphs**: `number-of-islands`, `bfs-shortest-path`, `dfs-connected-components`, `dijkstra`, `union-find`.
8. **Dynamic Programming**: `climbing-stairs`, `coin-change`, `lcs`.
9. **Backtracking & Recursion**: `generate-subsets`, `n-queens`.
10. **Math & Number Theory**: `prime-number`, `armstrong-number`, `factorial`, `fibonacci`, `gcd-lcm`, `palindrome-check`.
11. **Applied Story & Logic**: `greater-average`, `decrement-or-increment`, `percentage-change`, `shop-bill`, `generic-arithmetic-comparison`, `generic-programming-problem`.

Each solver generates a complete `ProblemSolutionPlan`:
- **Normalized Problem Statement & Objective**
- **Candidate Approaches**: Brute force vs Optimal, with time/space complexity trade-offs.
- **Dry-Run Trace**: Step-by-step variable transitions.
- **Visual DSL Steps**: Semantic visual actions executable on the Excalidraw whiteboard.
- **Multi-Language Code**: Idiomatic implementations in JavaScript, Python, and C++.
- **Interactive Learner Question**: Formulated to test the learner's understanding at the critical inflection step.

---

## 5. AI Gateway & Multi-Provider Abstraction (`ai/index.ts`)

SmartZero 2.0 routes AI requests through a unified, provider-agnostic **AI Gateway** (`ai/index.ts`). Application routes and components communicate exclusively with the `AIProvider` contract, never directly with specific external vendors:

```mermaid
flowchart TD
    APP[SmartZero Feature / API Route] --> GW["AI Gateway: resolveProvider()"]
    
    GW -->|AI_PROVIDER=gemini| GEM["Gemini Provider (ai/providers/gemini.ts)"]
    GW -->|AI_PROVIDER=openrouter| OR["OpenRouter Provider (ai/providers/openrouter.ts)"]
    GW -->|AI_PROVIDER=featherless| FL["Featherless Provider (ai/featherless.ts)"]
    GW -->|Missing key / Network error / Offline| DET["Deterministic Fallback Engine (ai/fallback.ts)"]
    
    GEM -->|Error / Timeout / 429| DET
    OR -->|Error / Timeout / 429| DET
    FL -->|Error / Timeout / 429| DET
```

### Supported Providers:
1. **Google Gemini (`gemini`)**:
   - Primary candidate for free-tier usage.
   - Configured via `GEMINI_API_KEY` and `AI_MODEL` (defaults to `gemini-2.5-flash`).
2. **OpenRouter (`openrouter`)**:
   - Supports free community models (e.g. `meta-llama/llama-3.3-70b-instruct:free`).
   - Configured via `OPENROUTER_API_KEY` and `AI_MODEL`.
3. **Featherless AI (`featherless`)**:
   - Preserves task-based model routing (`zai-org/GLM-5.3-Flash`, `Qwen/Qwen3-32B`).
   - Configured via `FEATHERLESS_API_KEY`, `FEATHERLESS_MODEL`, and `FEATHERLESS_BASE_URL`.
4. **Deterministic Local Engine (`deterministic` / `fallback`)**:
   - 100% offline, deterministic rule engine backed by `agent/nlu.ts`, `agent/problemSolver.ts`, and `engine/lessons.ts`.

### Provider Selection Logic:
- Set `AI_PROVIDER=gemini` | `openrouter` | `featherless` | `deterministic` in `.env.local`.
- If `AI_PROVIDER` is unset, the gateway automatically selects the first provider with a configured API key in order: Gemini → OpenRouter → Featherless.
- If no external key is configured, or if `SMARTZERO_ENABLE_LIVE_AI=false`, the deterministic fallback engine is activated automatically.

---

## 6. Deterministic Fallback Engine (`ai/fallback.ts`)

When an external provider is unavailable or fails due to network timeout or rate limits, the `resilient()` gateway wrapper immediately activates `fallbackProvider`:
- Emits fully structured responses conforming strictly to `AIResponseSchema` and `DSATaskSchema`.
- Leverages the canonical registry in `engine/registry.ts` and the 42 solvers in `agent/problemSolver.ts`.
- Guarantees that hackathon evaluation, CI testing, and offline local development never fail.
- Output correctness is guaranteed deterministically: **AI decides WHAT to teach; the engine decides HOW to execute.**

---

## 7. Schema Validation & Structured Output (`ai/schemas.ts`)

All communication between the client, API route handlers, and AI models is strictly enforced via Zod schemas:

### Core Schemas:
- **`InterpretRequestSchema`**:
  ```typescript
  z.object({
    question: z.string().min(1).max(5000),
    imageBase64: z.string().optional(),
    context: z.object({
      topicId: z.string().nullable().optional(),
      lessonId: z.string().nullable().optional(),
      language: z.enum(["javascript", "cpp", "python"]).optional(),
      mode: z.string().optional(),
      teachSummary: z.string().optional(),
    }).optional(),
  })
  ```
- **`DSATaskSchema`**: The master contract returned by `/api/interpret`. Contains normalized `intent`, `lessonId`, `topicId`, `problemPlan`, `customLesson`, and `codeSnippets`.
- **`EvaluateRequestSchema`**: Validates prediction responses (`{ expectedId: string, choiceId: string }`).
- **`HintRequestSchema`**: Contextual hint request containing active step indices and question prompts.
- **`NarrateRequestSchema`**: Validates text-to-speech requests (`{ text: string, voice?: string, speed?: number }`).

---

## 8. Pedagogical Voice Narration Derivation (`lib/featherlessNarration.ts`)

SmartZero makes a deliberate pedagogical distinction between **written instructional text** and **spoken voice narration**:
- **Written text** in the AI Teacher and Monaco code viewer can be detailed, structured with markdown lists, code identifiers, and asymptotic Big-O equations.
- **Spoken narration** must be concise (5–25 words), conversational, natural, and free of visual artifacts.

### Spoken Text Normalization Pipeline
1. **Markdown & Syntax Stripping**: Code ticks, asterisks, bracket references, and arrows are stripped.
2. **Asymptotic Speech Replacement**: Equations like `O(N)` or `O(log N)` are rewritten as spoken English ("order of complexity").
3. **5-Tier Derivation Precedence**:
   - Priority 1: Authored `step.narration` if explicitly defined on the lesson step.
   - Priority 2: Interactive checkpoint `step.question.prompt` when pausing for learner prediction.
   - Priority 3: Structured pedagogical narrative `step.narrative.currentStep` or `step.narrative.why`.
   - Priority 4: Semantic action inflection (e.g. "Compare element 10 and 20", "Swap elements at index 1 and 4").
   - Priority 5: Concise first sentence of `step.explanation`.
4. **Length Clamping**: Narration is strictly clamped to a maximum of 25 words to ensure high student engagement without delay.
5. **No Visual Code/JSON Leakage**: Raw code blocks, ASTs, and Excalidraw element JSON are never passed to the audio synthesizer.

---

*For whiteboard layout and rendering specifications, proceed to [CANVAS_ENGINE.md](CANVAS_ENGINE.md).*
