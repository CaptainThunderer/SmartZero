# SmartZero — Project Overview

> An executive 5-minute summary of the SmartZero platform, its architecture, core product loop, and pedagogical philosophy.

---

## 1. What is SmartZero?

**SmartZero** is an agentic visual learning workspace designed to teach Data Structures and Algorithms (DSA) through an interactive, deterministic semantic whiteboard.

Instead of treating computer science education as a passive chat interaction or static code generation task, SmartZero pairs an **AI Teacher** with a **Deterministic Visual Execution Engine** on an infinite hand-drawn whiteboard canvas powered by Excalidraw. Every algorithmic step is verified mathematically before rendering, ensuring that the whiteboard, code line, explanation, and variable state are in 100% synchronization at all times.

---

## 2. The Problem It Solves

### The "Understanding Chasm" in Computer Science Education
1. **Passive Learning via LLMs**: Modern AI chatbots (ChatGPT, Claude) generate long walls of markdown and raw code blocks. Learners read passively, leading to the illusion of competence without developing a working mental model of pointers, memory segments, or recursion trees.
2. **Disconnected Visualizers**: Traditional web visualizers (e.g., VisuAlgo) are pre-baked and static. They cannot answer custom user questions, cannot understand natural-language story problems, and cannot explain *why* a specific decision was made.
3. **AI Hallucination in State Execution**: LLMs are notoriously unreliable at simulating step-by-step memory mutations. Asking an LLM to "trace pointer movements" often results in skipped indices, incorrect variable states, and invalid swaps.

### The SmartZero Solution
SmartZero solves this by separating **pedagogical reasoning** from **algorithmic execution**:
- The **AI Agent** interprets the learner's intent, translates story problems into formal specifications, and plans the lesson structure.
- The **Deterministic Engine** executes the algorithm, computes exact pointer coordinates, detects misconceptions, and controls step-by-step playback.

---

## 3. Target Users

1. **Computer Science Students & Bootcamp Learners**: Seeking intuitive visual mental models for complex data structures (pointers, trees, graphs, dynamic programming tables).
2. **Technical Interview Candidates**: Practicing LeetCode and Codeforces style problems, requiring immediate feedback on edge cases, time complexity, and candidate approach trade-offs.
3. **Educators & Mentors**: Utilizing Teach Mode as an interactive visual lecture tool where algorithmic concepts can be demonstrated step-by-step on a whiteboard.
4. **Self-Taught Developers**: Transitioning from syntax-level programming to formal algorithmic thinking and computational complexity.

---

## 4. Why SmartZero is Different

| Dimension | Standard AI Chatbot | Pre-Baked Visualizer | SmartZero Platform |
|:---|:---:|:---:|:---:|
| **Understands Custom Questions** | Yes (Text only) | No (Fixed examples only) | **Yes (Story & Custom Input)** |
| **Interactive Hand-Drawn Whiteboard**| No | No (Rigid SVG/Canvas) | **Yes (Excalidraw Semantic Canvas)** |
| **Deterministic State Execution** | No (Hallucinates traces) | Yes (Hardcoded) | **Yes (Zero-Drift Replay Engine)** |
| **4-Way Synchronization** | No | Partial | **Yes (Canvas + Code + State + AI)** |
| **Interactive Predictions** | No | Rare | **Yes (Embedded Diagnostic Checks)** |
| **Works Offline / Local Fallback** | No | Yes | **Yes (Deterministic Fallback Engine)**|

---

## 5. Core Product Loop

```text
       ┌─────────────────────────────────────────────────────────┐
       │ 1. USER INQUIRY                                         │
       │ User types a question, pastes a contest problem, or     │
       │ selects a topic from the Teach Palette.                │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ 2. AGENTIC NORMALIZATION & PLANNING                     │
       │ NLU parses intent, strips story wrappers, and generates │
       │ a structured Problem Solution Plan (42 solvers).        │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ 3. SEMANTIC VISUAL DSL GENERATION                       │
       │ Engine emits semantic actions (create array, highlight, │
       │ move pointer, relink node, show decision card).         │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ 4. DETERMINISTIC REPLAY & 4-WAY SYNC                    │
       │ Canvas renders data structures at y ≈ 110. Code panel   │
       │ highlights active lines. State panel updates variables. │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │ 5. ACTIVE LEARNER PREDICTION & FEEDBACK                 │
       │ Learner is asked to predict the next pointer move.      │
       │ Engine evaluates choice and diagnoses misconceptions.   │
       └─────────────────────────────────────────────────────────┘
```

---

## 6. Architecture Overview

SmartZero is built upon a modular 4-tier architecture:

1. **Next.js 15 App Router (`app/`)**:
   - Modern React 19 UI with server-side route handlers (`/api/interpret`, `/api/lesson`, `/api/hint`, `/api/evaluate`).
   - Strict Zod validation on all ingress boundaries.
2. **Agent & NLU Tier (`agent/`, `ai/`)**:
   - Natural language parser that normalizes story problems.
   - Dynamic model router integrating with Featherless AI (`GLM-5.3-Flash` for reasoning, `Qwen3-32B` for code).
   - High-resilience deterministic fallback provider.
3. **Deterministic Core Engine (`engine/`)**:
   - Canonical registry of 22 categories and 37 topics.
   - 18 deterministic execution engines spanning sorting, searching, graphs, and linear structures.
   - Discrete replay engine: `replay(steps, upto)` guarantees zero accumulated rendering errors.
4. **Visual & Interactive Surface (`components/`)**:
   - Hand-drawn Excalidraw canvas (`SemanticCanvas.tsx`) applying role-based layout math.
   - Multi-tab isolated workspace manager (`WorkspaceSwitcher.tsx`).
   - Monaco code viewer with JavaScript, Python, and C++ synchronization.
   - Live Markdown study notes (`NotesPanel.tsx`).

---

## 7. Main Directory Breakdown

```text
smartzero-v1/
├── app/                  # Route handlers & layout
├── components/           # UI, Canvas, Workspace, Code, and Notes components
├── engine/               # Registry, sorting, graph, linear structures & replay engine
├── agent/                # Natural language parser & 42 specialized problem solvers
├── ai/                   # Model router, Featherless client & Zod schemas
├── types/                # Core TypeScript definitions (Visual DSL, Lesson models)
├── tests/                # 15 automated test suites (1,511+ assertions)
└── supabase/             # Optional relational database schema
```

---

## 8. Example User Journey: Kadane's Maximum Subarray

1. **Learner Inquiry**: The user asks: *"How does Kadane's algorithm find the maximum subarray in `[-2, 1, -3, 4, -1, 2, 1, -5, 4]`?"*
2. **First Frame Quality**:
   - The whiteboard immediately renders the 9-element array centered at $y \approx 110$.
   - The `i` pointer points to index 0 (`value = -2`).
   - State variables initialize: `currentSum = -2`, `bestSum = -2`.
   - The operation card indicates: *"Start fresh with the first element."*
3. **Step 2 (The Positive Transition)**:
   - Learner clicks **Next Step**.
   - Pointer `i` smoothly shifts to index 1 (`value = 1`).
   - The operation card evaluates: $\max(1, -2 + 1) = 1$.
   - `currentSum` updates to `1`, and `bestSum` updates to `1`.
4. **Step 3 (The Discard Decision)**:
   - At index 2 (`value = -3`), `currentSum` becomes $-2$.
   - At index 3 (`value = 4`), the algorithm evaluates $\max(4, -2 + 4) = 4$.
   - Because starting fresh ($4$) is greater than extending the negative prefix ($-2 + 4 = 2$), the canvas **visually dims the discarded prefix `0..2`** and establishes a fresh green bounding box starting at index 3.
5. **Final Step (Visual Result Identification)**:
   - The winning contiguous subarray `[4, -1, 2, 1]` is highlighted in vibrant green.
   - Result card displays: *"Maximum Subarray Sum = 6 (Indices 3 to 6)"*.
   - The synchronized Python/JS code highlights the return statement.

---

## 9. Important Design Principles

1. **AI Decides WHAT. The Engine Decides HOW**: The AI generates semantic intent; the engine mathematically calculates pixel coordinates, font sizes, bounding boxes, and collision offsets.
2. **The Data Structure is the Hero**: Visual real estate prioritizes large, clear array cells, tree nodes, and graph vertices. explanatory text is kept concise and modular.
3. **The Mute Test**: If the AI explanation and code panels are completely collapsed, the learner must be able to understand the algorithm solely from the whiteboard canvas transitions.
4. **Zero Accumulated Drift**: Navigation uses pure state replay from index 0 to $N$, ensuring backward steps and reset actions leave zero residual artifacts.
5. **Zero State Leakage**: Workspaces are isolated sandboxes with monotonic sequence tokens preventing async race conditions.

---

## 10. Current Limitations

- **Browser C++ Execution**: C++ code is syntax-highlighted and synchronized line-by-line, but client-side execution dry runs are performed using JavaScript.
- **Persistence Scope**: Local workspace state persists across browser sessions using `localStorage`; Supabase backend integration is optional for cloud sync.
- **Graph Scalability**: Whiteboard graph traversals are optimized for planar topologies up to 10 vertices to preserve visual clarity.

---

*To continue exploring SmartZero, see [INSTALL_GUIDE.md](INSTALL_GUIDE.md) for installation and setup instructions or [ARCHITECTURE.md](ARCHITECTURE.md) for deep system mechanics.*
