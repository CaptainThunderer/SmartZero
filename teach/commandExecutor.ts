/**
 * SmartZero Teach Mode — Deterministic Command Executor
 *
 * Executes parsed Teach commands directly against CanvasState.
 * Guarantees that user input is the single source of truth.
 */

import type { CanvasState, TreeNode, GraphNode, GraphEdge } from "../types/dsa";
import { initialCanvas } from "../engine/core";
import type { TeachCommand } from "./commandParser";

export interface ExecutionResult {
  success: boolean;
  newState: CanvasState;
  history: CanvasState[];
  message?: string;
  error?: string;
}

/* ──── Helper: Build Deterministic BST Nodes and Edges ──── */
function buildBSTScene(values: number[]): { nodes: TreeNode[]; edges: [string, string][] } {
  if (values.length === 0) return { nodes: [], edges: [] };

  interface InternalNode {
    id: string;
    value: number;
    depth: number;
    x: number;
    y: number;
    left?: InternalNode;
    right?: InternalNode;
  }

  const root: InternalNode = {
    id: `bst-0-${values[0]}`,
    value: values[0],
    depth: 0,
    x: 400,
    y: 90,
  };

  const allInternal: InternalNode[] = [root];
  const edges: [string, string][] = [];

  for (let i = 1; i < values.length; i++) {
    const val = values[i];
    let curr = root;
    let depth = 0;

    while (true) {
      depth++;
      const offset = Math.max(35, Math.floor(160 / Math.pow(1.6, depth - 1)));
      if (val < curr.value) {
        if (!curr.left) {
          const child: InternalNode = {
            id: `bst-${i}-${val}`,
            value: val,
            depth,
            x: curr.x - offset,
            y: curr.y + 70,
          };
          curr.left = child;
          allInternal.push(child);
          edges.push([curr.id, child.id]);
          break;
        } else {
          curr = curr.left;
        }
      } else {
        // Equal or greater goes right
        if (!curr.right) {
          const child: InternalNode = {
            id: `bst-${i}-${val}`,
            value: val,
            depth,
            x: curr.x + offset,
            y: curr.y + 70,
          };
          curr.right = child;
          allInternal.push(child);
          edges.push([curr.id, child.id]);
          break;
        } else {
          curr = curr.right;
        }
      }
    }
  }

  const nodes: TreeNode[] = allInternal.map((n) => ({
    id: n.id,
    value: n.value,
    x: n.x,
    y: n.y,
    visible: true,
  }));

  return { nodes, edges };
}

/* ──── Helper: Build General Tree (Level-Order / Binary) ──── */
function buildTreeScene(values: number[]): { nodes: TreeNode[]; edges: [string, string][] } {
  if (values.length === 0) return { nodes: [], edges: [] };

  const nodes: TreeNode[] = [];
  const edges: [string, string][] = [];

  values.forEach((val, i) => {
    const depth = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (Math.pow(2, depth) - 1);
    const totalInLevel = Math.pow(2, depth);
    const spacing = 640 / (totalInLevel + 1);
    const x = 120 + (posInLevel + 1) * spacing;
    const y = 90 + depth * 75;

    const id = `t-${i}-${val}`;
    nodes.push({ id, value: val, x, y, visible: true });

    if (i > 0) {
      const parentIdx = Math.floor((i - 1) / 2);
      edges.push([nodes[parentIdx].id, id]);
    }
  });

  return { nodes, edges };
}

/* ──── Helper: Heapify array ──── */
function heapify(values: number[], variant: "min" | "max" = "max"): number[] {
  const arr = [...values];
  const n = arr.length;

  const compare = (a: number, b: number) => (variant === "min" ? a > b : a < b);

  function siftDown(idx: number, size: number) {
    let largest = idx;
    const left = 2 * idx + 1;
    const right = 2 * idx + 2;

    if (left < size && compare(arr[largest], arr[left])) {
      largest = left;
    }
    if (right < size && compare(arr[largest], arr[right])) {
      largest = right;
    }
    if (largest !== idx) {
      const tmp = arr[idx];
      arr[idx] = arr[largest];
      arr[largest] = tmp;
      siftDown(largest, size);
    }
  }

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDown(i, n);
  }
  return arr;
}

/* ──── Main Command Executor ──── */
export function executeTeachCommand(
  cmd: TeachCommand,
  currentState: CanvasState,
  history: CanvasState[] = []
): ExecutionResult {
  // Save current state for undo unless executing undo itself
  const nextHistory = cmd.type !== "undo" ? [...history, currentState] : history;

  switch (cmd.type) {
    case "array": {
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `Array [${cmd.values.join(", ")}]`,
          subtitle: `${cmd.values.length} elements`,
          badge: "Teach Mode",
        },
        array: {
          id: "user-array",
          values: [...cmd.values],
          highlightIndices: [],
          dimIndices: [],
          pointers: {},
        },
        message: `Created array with ${cmd.values.length} elements: [${cmd.values.join(", ")}]`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Array created: [${cmd.values.join(", ")}]`,
      };
    }

    case "var": {
      const nextVars = { ...currentState.variables, [cmd.name]: cmd.value };
      const nextState: CanvasState = {
        ...currentState,
        variables: nextVars,
        message: `Variable "${cmd.name}" declared with value ${cmd.value}`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Variable "${cmd.name}" = ${cmd.value}`,
      };
    }

    case "set": {
      if (currentState.variables[cmd.name] === undefined) {
        return {
          success: false,
          newState: currentState,
          history,
          error: `Variable "${cmd.name}" does not exist. Use /var(${cmd.name}=${cmd.value}) to declare it first.`,
        };
      }
      const nextVars = { ...currentState.variables, [cmd.name]: cmd.value };
      const nextState: CanvasState = {
        ...currentState,
        variables: nextVars,
        message: `Variable "${cmd.name}" updated to ${cmd.value}`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Updated "${cmd.name}" = ${cmd.value}`,
      };
    }

    case "set_element": {
      if (!currentState.array || currentState.array.values.length === 0) {
        return {
          success: false,
          newState: currentState,
          history,
          error: "No array on canvas to update. Use /array(...) to create one first.",
        };
      }
      if (cmd.index < 0 || cmd.index >= currentState.array.values.length) {
        return {
          success: false,
          newState: currentState,
          history,
          error: `Index ${cmd.index} is out of bounds for array of length ${currentState.array.values.length}.`,
        };
      }
      const nextValues = [...currentState.array.values];
      nextValues[cmd.index] = Number(cmd.value);
      const nextState: CanvasState = {
        ...currentState,
        array: {
          ...currentState.array,
          values: nextValues,
        },
        boardHeader: {
          title: `Array [${nextValues.join(", ")}]`,
          subtitle: `${nextValues.length} elements`,
          badge: "Teach Mode",
        },
        message: `Updated array[${cmd.index}] = ${cmd.value}`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Updated array[${cmd.index}] = ${cmd.value}`,
      };
    }

    case "push": {
      const prevValues = currentState.array ? currentState.array.values : [];
      const nextValues = [...prevValues, cmd.value];
      const nextState: CanvasState = {
        ...currentState,
        array: {
          id: currentState.array?.id || "user-array",
          values: nextValues,
          highlightIndices: currentState.array?.highlightIndices || [],
          dimIndices: currentState.array?.dimIndices || [],
          pointers: currentState.array?.pointers || {},
        },
        boardHeader: {
          title: `Array [${nextValues.join(", ")}]`,
          subtitle: `${nextValues.length} elements`,
          badge: "Teach Mode",
        },
        message: `Pushed ${cmd.value} onto array (length ${nextValues.length})`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Pushed ${cmd.value}`,
      };
    }

    case "pop": {
      if (!currentState.array || currentState.array.values.length === 0) {
        return {
          success: false,
          newState: currentState,
          history,
          error: "Array is empty. Cannot pop.",
        };
      }
      const nextValues = currentState.array.values.slice(0, -1);
      const nextPointers: Record<string, number> = {};
      if (currentState.array.pointers) {
        for (const [pName, pIdx] of Object.entries(currentState.array.pointers)) {
          if (pIdx < nextValues.length) {
            nextPointers[pName] = pIdx;
          }
        }
      }
      const nextState: CanvasState = {
        ...currentState,
        array: {
          ...currentState.array,
          values: nextValues,
          pointers: nextPointers,
        },
        boardHeader: {
          title: `Array [${nextValues.join(", ")}]`,
          subtitle: `${nextValues.length} elements`,
          badge: "Teach Mode",
        },
        message: `Popped last element (length ${nextValues.length})`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: "Popped last element",
      };
    }

    case "pointer": {
      if (!currentState.array) {
        // If no array exists, create a variable for this pointer
        const nextVars = { ...currentState.variables, [cmd.name]: cmd.index };
        const nextState: CanvasState = {
          ...currentState,
          variables: nextVars,
          message: `Pointer "${cmd.name}" set to index ${cmd.index}`,
        };
        return {
          success: true,
          newState: nextState,
          history: nextHistory,
          message: `Pointer "${cmd.name}" set to index ${cmd.index}`,
        };
      }

      const clampedIndex = Math.max(0, Math.min(cmd.index, currentState.array.values.length - 1));
      const nextPointers = { ...currentState.array.pointers, [cmd.name]: clampedIndex };
      const nextState: CanvasState = {
        ...currentState,
        array: {
          ...currentState.array,
          pointers: nextPointers,
        },
        message: `Pointer "${cmd.name}" attached to index ${clampedIndex} (value: ${currentState.array.values[clampedIndex]})`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Pointer "${cmd.name}" → index ${clampedIndex}`,
      };
    }

    case "list": {
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `Linked List: ${cmd.values.join(" → ")}`,
          subtitle: `${cmd.values.length} nodes`,
          badge: "Teach Mode",
        },
        linkedList: {
          nodes: cmd.values.map((v, i) => ({ id: `n${i}`, value: v })),
          pointers: {},
        },
        message: `Created linked list: ${cmd.values.join(" → ")}`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Linked list created: ${cmd.values.join(" → ")}`,
      };
    }

    case "stack": {
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: "Stack (LIFO)",
          subtitle: `Top element: ${cmd.values[cmd.values.length - 1]} | Size: ${cmd.values.length}`,
          badge: "Teach Mode",
        },
        stack: {
          items: [...cmd.values],
          topIndex: cmd.values.length - 1,
        },
        message: `Stack created with items [${cmd.values.join(", ")}]. Top is ${cmd.values[cmd.values.length - 1]}.`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Stack created with ${cmd.values.length} elements`,
      };
    }

    case "queue": {
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: "Queue (FIFO)",
          subtitle: `FRONT: ${cmd.values[0]} | REAR: ${cmd.values[cmd.values.length - 1]}`,
          badge: "Teach Mode",
        },
        queue: {
          items: [...cmd.values],
          front: 0,
          rear: Math.max(0, cmd.values.length - 1),
        },
        message: `Queue created: FRONT → ${cmd.values.join(" → ")} → REAR`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Queue created: FRONT → ${cmd.values.join(" → ")} → REAR`,
      };
    }

    case "tree": {
      const { nodes, edges } = buildTreeScene(cmd.values);
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `Tree (${cmd.values.length} nodes)`,
          subtitle: `Root: ${cmd.values[0]}`,
          badge: "Teach Mode",
        },
        tree: {
          nodes,
          edges,
          highlightId: null,
        },
        message: `Tree created with ${nodes.length} nodes`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Tree created with ${nodes.length} nodes`,
      };
    }

    case "bst": {
      const { nodes, edges } = buildBSTScene(cmd.values);
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: "Binary Search Tree",
          subtitle: `Inserted: [${cmd.values.join(", ")}] | Root: ${cmd.values[0]}`,
          badge: "BST Invariant",
        },
        tree: {
          nodes,
          edges,
          highlightId: null,
        },
        message: `Binary Search Tree created from [${cmd.values.join(", ")}]`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `BST created with root ${cmd.values[0]} and ${nodes.length} nodes`,
      };
    }

    case "heap": {
      const variant = cmd.variant || "max";
      const heapValues = heapify(cmd.values, variant);
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `${variant === "min" ? "Min-Heap" : "Max-Heap"} (Array Representation)`,
          subtitle: `Root: ${heapValues[0]} | [${heapValues.join(", ")}]`,
          badge: `${variant.toUpperCase()}-HEAP`,
        },
        heap: {
          values: heapValues,
          activeIndices: null,
        },
        message: `${variant.toUpperCase()}-Heap created: [${heapValues.join(", ")}]`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `${variant === "min" ? "Min" : "Max"}-Heap created: [${heapValues.join(", ")}]`,
      };
    }

    case "setdata": {
      // Eliminate duplicates
      const unique = Array.from(new Set(cmd.values));
      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `Set (${unique.length} unique elements)`,
          subtitle: `{ ${unique.join(", ")} }`,
          badge: "Set Semantics",
        },
        setContainer: {
          title: "Set (Unique Elements)",
          elements: unique,
          note:
            cmd.values.length > unique.length
              ? `Duplicates eliminated: ${cmd.values.length - unique.length}`
              : "All elements unique",
        },
        message: `Set created: { ${unique.join(", ")} }`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Set created: { ${unique.join(", ")} }`,
      };
    }

    case "map": {
      const entries = cmd.entries;
      const keys = Object.keys(entries);
      const bucketsCount = Math.max(4, Math.min(8, keys.length * 2));
      const buckets = Array.from({ length: bucketsCount }, (_, i) => ({
        index: i,
        items: [] as { key: string | number; value?: string | number }[],
      }));

      // Distribute into buckets deterministically
      keys.forEach((k) => {
        let hash = 0;
        for (let i = 0; i < k.length; i++) {
          hash = (hash * 31 + k.charCodeAt(i)) % bucketsCount;
        }
        buckets[hash].items.push({ key: k, value: entries[k] });
      });

      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `Map / Dictionary (${keys.length} entries)`,
          subtitle: keys.map((k) => `${k}: ${entries[k]}`).join(", "),
          badge: "Hash Map",
        },
        variables: { ...currentState.variables, ...entries },
        hashTable: {
          buckets,
          highlightBucket: null,
        },
        message: `Map created with ${keys.length} entries: ${keys.map((k) => `${k}: ${entries[k]}`).join(", ")}`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Map created with ${keys.length} entries`,
      };
    }

    case "graph": {
      // Extract unique nodes
      const nodeSet = new Set<string>();
      cmd.edges.forEach((e) => {
        nodeSet.add(e.from);
        nodeSet.add(e.to);
      });
      const nodeNames = Array.from(nodeSet);

      // Circular layout
      const centerX = 380;
      const centerY = 140;
      const radius = Math.min(160, Math.max(80, nodeNames.length * 25));
      const nodes: GraphNode[] = nodeNames.map((name, i) => {
        const angle = (2 * Math.PI * i) / nodeNames.length - Math.PI / 2;
        return {
          id: name,
          label: name,
          x: Math.round(centerX + radius * Math.cos(angle)),
          y: Math.round(centerY + radius * Math.sin(angle)),
        };
      });

      const edges: GraphEdge[] = cmd.edges.map((e) => ({
        from: e.from,
        to: e.to,
        directed: Boolean(e.directed || cmd.directed),
        highlighted: false,
      }));

      const nextState: CanvasState = {
        ...currentState,
        boardHeader: {
          title: `${cmd.directed ? "Directed" : "Undirected"} Graph`,
          subtitle: `${nodes.length} vertices, ${edges.length} edges`,
          badge: "Graph Structure",
        },
        graph: {
          nodes,
          edges,
          visited: [],
          activeId: null,
        },
        message: `Graph created with ${nodes.length} nodes and ${edges.length} edges`,
      };
      return {
        success: true,
        newState: nextState,
        history: nextHistory,
        message: `Graph created with ${nodes.length} nodes and ${edges.length} edges`,
      };
    }

    case "clear":
    case "reset": {
      return {
        success: true,
        newState: initialCanvas(),
        history: nextHistory,
        message: "Teach canvas cleared.",
      };
    }

    case "undo": {
      if (history.length === 0) {
        return {
          success: false,
          newState: currentState,
          history,
          error: "Nothing to undo.",
        };
      }
      const previousState = history[history.length - 1];
      const remainingHistory = history.slice(0, -1);
      return {
        success: true,
        newState: previousState,
        history: remainingHistory,
        message: "Last Teach action undone.",
      };
    }
  }
}
