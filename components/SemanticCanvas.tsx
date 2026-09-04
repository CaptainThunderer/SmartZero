"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { CanvasState } from "../types/dsa";

/* ── Stable ID generation ── */
let stableCounter = 0;
function stableId(prefix: string): string {
  return `sz-${prefix}-${stableCounter++}`;
}

function resetStableCounter() {
  stableCounter = 0;
}

/* ── Convert CanvasState → Excalidraw element specs ── */
function buildScene(state: CanvasState) {
  resetStableCounter();
  const specs: Record<string, unknown>[] = [];
  let y = 80;

  /* ── Array ── */
  if (state.array) {
    specs.push({
      type: "text",
      id: stableId("arr-title"),
      x: 100,
      y: y - 38,
      text: "Array",
      fontSize: 22,
      strokeColor: "#6B6F8A",
    });
    state.array.values.forEach((v, i) => {
      const x = 100 + i * 90;
      const active = state.array!.highlightIndices.includes(i);
      const dimmed = state.array!.dimIndices?.includes(i) ?? false;

      specs.push({
        type: "rectangle",
        id: stableId(`arr-cell-${i}`),
        x,
        y,
        width: 72,
        height: 60,
        strokeColor: dimmed ? "#D1D5DB" : active ? "#5B5FEF" : "#9CA3AF",
        backgroundColor: dimmed
          ? "#F3F4F6"
          : active
            ? "#EEF0FD"
            : "#FFFFFF",
        strokeWidth: active ? 3 : 1,
        opacity: dimmed ? 50 : 100,
      });
      specs.push({
        type: "text",
        id: stableId(`arr-val-${i}`),
        x: x + 25,
        y: y + 19,
        text: String(v),
        fontSize: 20,
        strokeColor: dimmed ? "#B0B3C0" : "#232946",
        opacity: dimmed ? 50 : 100,
      });
      specs.push({
        type: "text",
        id: stableId(`arr-idx-${i}`),
        x: x + 29,
        y: y + 66,
        text: String(i),
        fontSize: 14,
        strokeColor: "#8B90A8",
      });

      /* Pointers above array cells */
      Object.entries(state.array!.pointers).forEach(([name, idx]) => {
        if (idx === i) {
          specs.push({
            type: "text",
            id: stableId(`ptr-${name}-${i}`),
            x: x + 18,
            y: y - 18,
            text: `↓ ${name}`,
            fontSize: 15,
            strokeColor: "#5B5FEF",
          });
        }
      });
    });
    y += 150;
  }

  /* ── Variables ── */
  const vars = Object.entries(state.variables);
  if (vars.length > 0) {
    vars.forEach(([name, value], i) => {
      specs.push({
        type: "rectangle",
        id: stableId(`var-bg-${name}`),
        x: 100 + i * 180,
        y,
        width: 155,
        height: 55,
        strokeColor: "#B9DCCF",
        backgroundColor: "#F0FAF6",
        strokeWidth: 1,
      });
      specs.push({
        type: "text",
        id: stableId(`var-text-${name}`),
        x: 115 + i * 180,
        y: y + 17,
        text: `${name} = ${value}`,
        fontSize: 17,
        strokeColor: "#1E8062",
      });
    });
    y += 80;
  }

  /* ── Bounds (Binary Search) ── */
  if (state.bounds) {
    specs.push({
      type: "text",
      id: stableId("bounds"),
      x: 100,
      y,
      text: `low = ${state.bounds.low}    mid = ${state.bounds.mid}    high = ${state.bounds.high}`,
      fontSize: 17,
      strokeColor: "#C97A2B",
    });
    y += 40;
  }

  /* ── Linked List ── */
  if (state.linkedList) {
    specs.push({
      type: "text",
      id: stableId("ll-title"),
      x: 100,
      y,
      text: "Linked List",
      fontSize: 22,
      strokeColor: "#6B6F8A",
    });
    const order =
      state.linkedList.order ??
      state.linkedList.nodes.map((n) => n.value);

    /* Build stable node-id lookup by semantic node identity */
    const nodeById = Object.fromEntries(
      state.linkedList.nodes.map((n) => [n.value, n.id])
    );

    order.forEach((v, i) => {
      const x = 100 + i * 120;
      specs.push({
        type: "rectangle",
        id: stableId(`ll-node-${v}`),
        x,
        y: y + 30,
        width: 70,
        height: 48,
        strokeColor: "#9CA3AF",
        backgroundColor: "#FFF",
        strokeWidth: 1,
      });
      specs.push({
        type: "text",
        id: stableId(`ll-val-${v}`),
        x: x + 25,
        y: y + 43,
        text: String(v),
        fontSize: 18,
      });
      if (i < order.length - 1) {
        specs.push({
          type: "arrow",
          id: stableId(`ll-arrow-${i}`),
          x: x + 70,
          y: y + 54,
          width: 50,
          height: 0,
          strokeColor: "#6B6F8A",
        });
      }
    });

    /* ── Linked list pointers (using semantic node IDs, NOT display index) ── */
    Object.entries(state.linkedList.pointers).forEach(([ptrName, targetId]) => {
      if (targetId === null) {
        // Show pointer to "null"
        const x = 100 + order.length * 120;
        specs.push({
          type: "text",
          id: stableId(`llptr-${ptrName}-null`),
          x,
          y: y + 86,
          text: `${ptrName} → null`,
          fontSize: 14,
          strokeColor: "#5B5FEF",
        });
        return;
      }
      /* Find the display position of the node this pointer references */
      const targetNode = state.linkedList!.nodes.find(
        (n) => n.id === targetId
      );
      if (!targetNode) return;
      const displayIdx = order.indexOf(targetNode.value);
      if (displayIdx === -1) return;
      const x = 100 + displayIdx * 120;
      specs.push({
        type: "text",
        id: stableId(`llptr-${ptrName}`),
        x: x + 10,
        y: y + 86,
        text: `↑ ${ptrName}`,
        fontSize: 14,
        strokeColor: "#5B5FEF",
      });
    });

    y += 140;
  }

  /* ── BST ── */
  if (state.tree) {
    specs.push({
      type: "text",
      id: stableId("tree-title"),
      x: 100,
      y,
      text: "Binary Search Tree",
      fontSize: 22,
      strokeColor: "#6B6F8A",
    });
    const offsetY = y + 40;
    const by = Object.fromEntries(
      state.tree.nodes.map((n) => [n.id, n])
    );

    state.tree.edges.forEach(([a, b], ei) => {
      const A = by[a],
        B = by[b];
      if (A && B && A.visible && B.visible) {
        specs.push({
          type: "arrow",
          id: stableId(`tree-edge-${ei}`),
          x: A.x,
          y: A.y + offsetY - 60,
          width: B.x - A.x,
          height: B.y - A.y,
          strokeColor: "#9CA3AF",
        });
      }
    });

    state.tree.nodes
      .filter((n) => n.visible)
      .forEach((n) => {
        const active = n.id === state.tree!.highlightId;
        specs.push({
          type: "ellipse",
          id: stableId(`tree-node-${n.id}`),
          x: n.x - 25,
          y: n.y - 25 + offsetY - 60,
          width: 50,
          height: 50,
          strokeColor: active ? "#5B5FEF" : "#9CA3AF",
          backgroundColor: active ? "#EEF0FD" : "#FFFFFF",
          strokeWidth: active ? 3 : 1,
        });
        specs.push({
          type: "text",
          id: stableId(`tree-val-${n.id}`),
          x: n.x - 9,
          y: n.y - 8 + offsetY - 60,
          text: String(n.value),
          fontSize: 16,
        });
      });

    y = offsetY + 320;
  }

  /* ── Compare Text ── */
  if (state.compareText) {
    specs.push({
      type: "text",
      id: stableId("compare"),
      x: 100,
      y,
      text: state.compareText,
      fontSize: 18,
      strokeColor: "#C97A2B",
    });
    y += 40;
  }

  /* ── Message ── */
  if (state.message) {
    specs.push({
      type: "text",
      id: stableId("message"),
      x: 100,
      y,
      text: state.message,
      fontSize: 19,
      strokeColor: "#1E8062",
    });
    y += 40;
  }

  /* ── Complexity ── */
  if (state.complexity) {
    specs.push({
      type: "text",
      id: stableId("complexity"),
      x: 100,
      y,
      text: `Time: ${state.complexity.time}    Space: ${state.complexity.space}`,
      fontSize: 17,
      strokeColor: "#5B5FEF",
    });
  }

  return specs;
}

/* ── Dynamic Excalidraw import (client only) ── */
let ExcalidrawComponent: React.ComponentType<Record<string, unknown>> | null = null;
let convertFn: ((specs: Record<string, unknown>[]) => unknown[]) | null = null;
let loadPromise: Promise<void> | null = null;

function loadExcalidraw(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = import("@excalidraw/excalidraw").then((mod) => {
    ExcalidrawComponent = mod.Excalidraw as unknown as React.ComponentType<Record<string, unknown>>;
    convertFn = mod.convertToExcalidrawElements as unknown as (specs: Record<string, unknown>[]) => unknown[];
  });
  return loadPromise;
}

export default function SemanticCanvas({ state }: { state: CanvasState }) {
  const apiRef = useRef<{ updateScene: (scene: { elements: unknown[] }) => void } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const prevStateRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExcalidraw().then(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      window.dispatchEvent(new Event("resize"));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [loaded]);

  const updateCanvas = useCallback(() => {
    if (!apiRef.current || !convertFn) return;
    const stateKey = JSON.stringify(state);
    if (stateKey === prevStateRef.current) return;
    prevStateRef.current = stateKey;

    const specs = buildScene(state);
    const elements = convertFn(specs);
    apiRef.current.updateScene({ elements });
  }, [state]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  if (!loaded || !ExcalidrawComponent) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#FAFAF8]">
        <div className="text-sm text-[#9498B3]">Loading canvas...</div>
      </div>
    );
  }

  const Exc = ExcalidrawComponent;
  const specs = buildScene(state);
  const initialElements = convertFn ? convertFn(specs) : [];

  return (
    <div ref={containerRef} className="h-full w-full excalidraw-wrapper">
      <Exc
        initialData={{
          elements: initialElements,
          appState: {
            viewBackgroundColor: "#FAFAF8",
            zenModeEnabled: false,
            gridSize: 20,
          },
        }}
        excalidrawAPI={(a: unknown) => {
          apiRef.current = a as { updateScene: (scene: { elements: unknown[] }) => void };
          // Immediately sync state after API is ready
          setTimeout(updateCanvas, 0);
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            clearCanvas: false,
          },
          tools: { image: false },
        }}
      />
    </div>
  );
}
