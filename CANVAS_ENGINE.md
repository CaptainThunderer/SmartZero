# SmartZero — Semantic Canvas & Visual Teaching Engine

> An in-depth guide to SmartZero's deterministic whiteboard engine, Excalidraw integration, semantic visual DSL, layout mathematics, and "Mute Test" compliance.

---

## 1. The Semantic Canvas Philosophy

The SmartZero canvas is not a passive drawing board where an LLM or learner freehands shapes. It is an **algorithmic whiteboard execution surface** governed by two non-negotiable principles:

1. **The Data Structure is the Hero**: The data structure (array, linked list, tree, graph) must occupy the visual center of gravity ($y \approx 110$). Text boxes, callouts, and explanations must support—not overwhelm—the visual elements.
2. **The "Mute Test"**: If a learner collapses both the AI Teacher chat panel and the Code/State panels, they should still be able to understand the algorithm's mechanics purely by watching the canvas transitions from step to step.

---

## 2. Excalidraw Integration (`components/SemanticCanvas.tsx`)

SmartZero embeds `@excalidraw/excalidraw` (v0.18) with custom scene-generation logic:
- **Hand-Drawn Aesthetics**: Elements use Excalidraw's natural hand-drawn roughness, rendering friendly, non-intimidating diagrams reminiscent of a mentor scribbling on a physical whiteboard.
- **Controlled Scene Updates**: The canvas component subscribes to the active `LessonStep` and calls `excalidrawAPI.updateScene({ elements })`.
- **Pure Functional Re-Rendering**: The scene is built from scratch for each step from the deterministic `RuntimeState`. No mutable visual state persists between frames.

---

## 3. Coordinate System & Visual Hierarchy

To prevent cluttered diagrams, `components/SemanticCanvas.tsx` divides the canvas into standardized vertical regions:

```text
 y = 20 px   ┌─────────────────────────────────────────────────────────────┐
             │ REGION 1: Whiteboard Header                                 │
             │ Algorithm Title, Subtitle, & Time/Space Complexity Badges   │
             └─────────────────────────────────────────────────────────────┘
 y = 110 px  ┌─────────────────────────────────────────────────────────────┐
             │ REGION 2: The Hero Data Structure                           │
             │ High-Contrast Array Cells (76px × 62px), Linked Nodes,      │
             │ Tree Branches, or Graph Topologies.                         │
             │ Pointer Vectors & Collision-Grouped Labels (e.g. ↓ low, mid)│
             └─────────────────────────────────────────────────────────────┘
 y = 230 px  ┌─────────────────────────────────────────────────────────────┐
             │ REGION 3: Current Operation & Decision Card                 │
             │ Compact [▶ OPERATION & DECISION] Box:                       │
             │ Active arithmetic, candidate comparisons, discard actions  │
             └─────────────────────────────────────────────────────────────┘
 y = 320 px  ┌─────────────────────────────────────────────────────────────┐
             │ REGION 4: Runtime State Variables                           │
             │ Horizontal Pill Table: currentSum = 4 | bestSum = 6 | i = 3 │
             └─────────────────────────────────────────────────────────────┘
 y = 410 px  ┌─────────────────────────────────────────────────────────────┐
             │ REGION 5: Result / Key Insight (Final Step Only)            │
             │ Distinct Green Bounding Box highlighting the winning result │
             └─────────────────────────────────────────────────────────────┘
```

---

## 4. Semantic Objects & Deterministic Grammar

The engine translates semantic `DSLAction` objects into Excalidraw primitive groups:

### 1. Array Cells & Windows
- **Cell Geometry**: Fixed dimensions of $76\text{px}$ width by $62\text{px}$ height with $14\text{px}$ horizontal gutters.
- **Visual Roles**:
  - **Default**: Slate border, semi-transparent background.
  - **Active / Pivot**: Vibrant amber stroke with warm highlight.
  - **Selected / Sorted**: Emerald green fill with crisp white text.
  - **Dimmed / Discarded**: $25\%$ opacity indicating eliminated search space or discarded negative prefixes.
- **Contiguous Sliding Window**: A continuous bracket bounding slice $[i \dots j]$ with running condition labels.

### 2. Pointers & Collision Grouping
In search and multi-pointer algorithms, pointers frequently point to the same index:
- If `low` and `mid` both equal index 3, standard visualizers render overlapping text.
- SmartZero inspects all active pointers targeting each cell:
  ```typescript
  // Collision detection & grouping in SemanticCanvas.tsx:
  const pointersAtIndex = pointers.filter(p => p.index === cellIndex);
  if (pointersAtIndex.length > 1) {
    const combinedLabel = "↓ " + pointersAtIndex.map(p => p.label).join(", ");
    renderPointerBanner(cellX, combinedLabel);
  }
  ```

### 3. Linked Lists
- Nodes are rendered as dual-compartment structures: `[ Value | • ]`.
- Pointers (`next`, `prev`) render as directed cubic Bezier curves connecting node anchor ports.
- During reversal steps, the arrow actively re-anchors to the previous node while `prev`, `curr`, and `next` pointers advance.

### 4. Trees & Binary Search Trees
- Nodes are laid out hierarchically using standard subtree width calculations.
- Traversal paths (e.g. BST search) highlight each visited node in amber before turning the found leaf green.

### 5. Graphs (BFS, DFS, Dijkstra)
- Vertices are arranged in planar geometries (e.g. 5-vertex diamond or 6-vertex circular network).
- Edges render with optional numerical weight badges.
- Visited nodes transform to emerald fill; frontier queues/distance tables render directly alongside the graph.

---

## 6. The Compact Operation Card

Explanatory text must never become a wall of prose on the whiteboard. SmartZero uses compact, structured **Operation Cards**:

```text
┌───────────────────────────────────────────────────────────┐
│ [▶ OPERATION & DECISION]                                  │
│ Formula: currentSum = max(-3, 1 + -3)                     │
│ Candidate A (Start Fresh): -3                             │
│ Candidate B (Extend Subarray): -2                         │
│ Decision: -2 > -3 → Extend subarray                      │
└───────────────────────────────────────────────────────────┘
```

This card updates synchronously with each step, allowing the learner to follow the algorithm's exact mathematical reasoning.

---

## 7. Zero-Drift Replay Mechanics (`engine/core.ts`)

Navigation between steps (Next, Previous, Play, Reset) never relies on mutating DOM or Excalidraw elements in place.

Instead, the system executes pure state replay:
```typescript
export function replay(steps: LessonStep[], upto: number): RuntimeState {
  let state = createInitialState();
  for (let i = 0; i <= upto && i < steps.length; i++) {
    for (const action of steps[i].actions) {
      state = applyAction(state, action);
    }
  }
  return state;
}
```
**Benefits**:
- Stepping backward $5 \to 4 \to 3$ produces the exact state as stepping forward $0 \to 1 \to 2 \to 3$.
- Pausing, jumping to any step, or resetting has zero risk of residual or orphaned visual elements.

---

## 8. Passing the "Mute Test"

To ensure visual teaching quality, every lesson in SmartZero is evaluated against the **Mute Test Protocol**:

1. Collapse the AI Teacher panel.
2. Collapse the Code & State panels.
3. Observe only the canvas while advancing from Step 0 to the final step.
4. **Verification Criteria**:
   - [x] Initial problem and input are visually evident.
   - [x] Pointers visibly shift indices.
   - [x] Candidate comparisons are shown in the Operation Card.
   - [x] Eliminated or discarded regions visibly dim.
   - [x] Swaps and pointer reversals visually animate or change link directions.
   - [x] Winning elements or targets turn vibrant green.
   - [x] Final answer is immediately identifiable without reading external text.

---

*For complete data structure registry and topic capabilities, proceed to [DSA_SUPPORT.md](DSA_SUPPORT.md).*
