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
function buildScene(state: CanvasState, theme: "light" | "dark" = "light") {
  resetStableCounter();
  const specs: Record<string, unknown>[] = [];
  let y = 80;

  const isDark = theme === "dark";
  const colors = {
    title: isDark ? "#A0A6C2" : "#6B6F8A",
    textPrimary: isDark ? "#F1F5F9" : "#232946",
    textSecondary: isDark ? "#A0A6C2" : "#6B6F8A",
    textDimmed: isDark ? "#64748B" : "#B0B3C0",
    cellBorder: isDark ? "#4B5563" : "#9CA3AF",
    cellBg: isDark ? "#1E1E2E" : "#FFFFFF",
    cellBorderActive: isDark ? "#818CF8" : "#5B5FEF",
    cellBgActive: isDark ? "#2A2B4A" : "#EEF0FD",
    cellBorderSorted: isDark ? "#34D399" : "#10B981",
    cellBgSorted: isDark ? "#064E3B" : "#ECFDF5",
    cellBorderDimmed: isDark ? "#374151" : "#D1D5DB",
    cellBgDimmed: isDark ? "#181824" : "#F3F4F6",
    pointer: isDark ? "#818CF8" : "#5B5FEF",
    accent: isDark ? "#818CF8" : "#5B5FEF",
    indexText: isDark ? "#6B7280" : "#8B90A8",
    boxBg: isDark ? "#181824" : "#F8FAFC",
    boxBorder: isDark ? "#4B5563" : "#E2E8F0",
    compare: isDark ? "#FBBF24" : "#C97A2B",
    message: isDark ? "#34D399" : "#1E8062",
    complexity: isDark ? "#818CF8" : "#5B5FEF",
    varBg: isDark ? "#132E27" : "#F0FAF6",
    varBorder: isDark ? "#065F46" : "#B9DCCF",
    varText: isDark ? "#34D399" : "#1E8062",
    nodeBg: isDark ? "#1E1E2E" : "#FFFFFF",
    nodeBorder: isDark ? "#4B5563" : "#9CA3AF",
    nodeActiveBg: isDark ? "#2A2B4A" : "#EEF0FD",
    nodeVisitedBg: isDark ? "#2E1065" : "#ECFDF5",
    nodeVisitedBorder: isDark ? "#A855F7" : "#059669",
    nodeVisitedText: isDark ? "#E9D5FF" : "#065F46",
    edgeNormal: isDark ? "#4B5563" : "#9CA3AF",
    edgeHighlight: isDark ? "#F59E0B" : "#5B5FEF",
  };

  /* ── Array ── */
  if (state.array) {
    specs.push({
      type: "text",
      id: stableId("arr-title"),
      x: 100,
      y: y - 38,
      text: "Array",
      fontSize: 22,
      strokeColor: colors.title,
    });
    state.array.values.forEach((v, i) => {
      const x = 100 + i * 90;
      const active = state.array!.highlightIndices.includes(i);
      const dimmed = state.array!.dimIndices?.includes(i) ?? false;
      const isSorted = state.array!.sortedRegion
        ? i >= state.array!.sortedRegion.start && i <= state.array!.sortedRegion.end
        : false;

      specs.push({
        type: "rectangle",
        id: stableId(`arr-cell-${i}`),
        x,
        y,
        width: 72,
        height: 60,
        strokeColor: dimmed
          ? colors.cellBorderDimmed
          : active
            ? colors.cellBorderActive
            : isSorted
              ? colors.cellBorderSorted
              : colors.cellBorder,
        backgroundColor: dimmed
          ? colors.cellBgDimmed
          : active
            ? colors.cellBgActive
            : isSorted
              ? colors.cellBgSorted
              : colors.cellBg,
        strokeWidth: active || isSorted ? 2.5 : 1,
        opacity: dimmed ? 50 : 100,
      });
      specs.push({
        type: "text",
        id: stableId(`arr-val-${i}`),
        x: x + 25,
        y: y + 19,
        text: String(v),
        fontSize: 20,
        strokeColor: dimmed ? colors.textDimmed : colors.textPrimary,
        opacity: dimmed ? 50 : 100,
      });
      specs.push({
        type: "text",
        id: stableId(`arr-idx-${i}`),
        x: x + 29,
        y: y + 66,
        text: String(i),
        fontSize: 14,
        strokeColor: colors.indexText,
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
            strokeColor: colors.pointer,
          });
        }
      });
    });
    y += 150;
  }

  /* ── Stack ── */
  if (state.stack) {
    specs.push({
      type: "text",
      id: stableId("stack-title"),
      x: 100,
      y,
      text: "Stack (LIFO)",
      fontSize: 22,
      strokeColor: colors.title,
    });
    y += 40;
    const items = state.stack.items;
    const stackHeight = Math.max(120, items.length * 45 + 20);
    specs.push({
      type: "rectangle",
      id: stableId("stack-box"),
      x: 120,
      y,
      width: 130,
      height: stackHeight,
      strokeColor: colors.accent,
      backgroundColor: colors.boxBg,
      strokeWidth: 2,
    });
    items.forEach((item, i) => {
      const itemY = y + stackHeight - 45 - i * 45;
      const isTop = i === items.length - 1;
      specs.push({
        type: "rectangle",
        id: stableId(`stack-item-${i}`),
        x: 130,
        y: itemY,
        width: 110,
        height: 38,
        strokeColor: isTop ? colors.cellBorderActive : colors.cellBorder,
        backgroundColor: isTop ? colors.cellBgActive : colors.cellBg,
        strokeWidth: isTop ? 2 : 1,
      });
      specs.push({
        type: "text",
        id: stableId(`stack-val-${i}`),
        x: 160,
        y: itemY + 8,
        text: String(item),
        fontSize: 18,
        strokeColor: colors.textPrimary,
      });
      if (isTop) {
        specs.push({
          type: "text",
          id: stableId("stack-top-ptr"),
          x: 250,
          y: itemY + 8,
          text: "← TOP",
          fontSize: 16,
          strokeColor: colors.pointer,
        });
      }
    });
    y += stackHeight + 40;
  }

  /* ── Queue ── */
  if (state.queue) {
    specs.push({
      type: "text",
      id: stableId("queue-title"),
      x: 100,
      y,
      text: "Queue (FIFO)",
      fontSize: 22,
      strokeColor: colors.title,
    });
    y += 40;
    const items = state.queue.items;
    items.forEach((item, i) => {
      const x = 120 + i * 90;
      const isFront = i === 0;
      const isRear = i === items.length - 1;
      specs.push({
        type: "rectangle",
        id: stableId(`queue-item-${i}`),
        x,
        y,
        width: 75,
        height: 55,
        strokeColor: isFront ? colors.cellBorderSorted : isRear ? colors.cellBorderActive : colors.cellBorder,
        backgroundColor: isFront ? colors.cellBgSorted : isRear ? colors.cellBgActive : colors.cellBg,
        strokeWidth: isFront || isRear ? 2 : 1,
      });
      specs.push({
        type: "text",
        id: stableId(`queue-val-${i}`),
        x: x + 25,
        y: y + 16,
        text: String(item),
        fontSize: 18,
        strokeColor: colors.textPrimary,
      });
      if (isFront) {
        specs.push({
          type: "text",
          id: stableId("queue-front-ptr"),
          x: x + 10,
          y: y - 22,
          text: "↓ FRONT",
          fontSize: 14,
          strokeColor: colors.cellBorderSorted,
        });
      }
      if (isRear) {
        specs.push({
          type: "text",
          id: stableId("queue-rear-ptr"),
          x: x + 15,
          y: y + 62,
          text: "↑ REAR",
          fontSize: 14,
          strokeColor: colors.pointer,
        });
      }
    });
    y += 110;
  }

  /* ── Graph ── */
  if (state.graph) {
    specs.push({
      type: "text",
      id: stableId("graph-title"),
      x: 100,
      y,
      text: "Graph",
      fontSize: 22,
      strokeColor: colors.title,
    });
    const offsetY = y + 50;
    const nodeMap = Object.fromEntries(state.graph.nodes.map((n) => [n.id, n]));

    state.graph.edges.forEach((edge, ei) => {
      const u = nodeMap[edge.from];
      const v = nodeMap[edge.to];
      if (u && v) {
        specs.push({
          type: edge.directed ? "arrow" : "line",
          id: stableId(`graph-edge-${ei}`),
          x: u.x,
          y: u.y + offsetY,
          width: v.x - u.x,
          height: v.y - u.y,
          strokeColor: edge.highlighted ? colors.edgeHighlight : colors.edgeNormal,
          strokeWidth: edge.highlighted ? 3 : 1,
        });
      }
    });

    state.graph.nodes.forEach((n) => {
      const isVisited = state.graph!.visited.includes(n.id) || !!n.visited;
      const isActive = state.graph!.activeId === n.id;
      specs.push({
        type: "ellipse",
        id: stableId(`graph-node-${n.id}`),
        x: n.x - 25,
        y: n.y - 25 + offsetY,
        width: 50,
        height: 50,
        strokeColor: isActive ? colors.cellBorderActive : isVisited ? colors.nodeVisitedBorder : colors.nodeBorder,
        backgroundColor: isActive ? colors.nodeActiveBg : isVisited ? colors.nodeVisitedBg : colors.nodeBg,
        strokeWidth: isActive ? 3 : 1.5,
      });
      specs.push({
        type: "text",
        id: stableId(`graph-val-${n.id}`),
        x: n.x - 7,
        y: n.y - 8 + offsetY,
        text: n.label || n.id,
        fontSize: 16,
        strokeColor: isVisited ? colors.nodeVisitedText : colors.textPrimary,
      });
    });

    y = offsetY + 300;
  }

  /* ── Hash Table ── */
  if (state.hashTable) {
    specs.push({
      type: "text",
      id: stableId("ht-title"),
      x: 100,
      y,
      text: "Hash Table (Chaining)",
      fontSize: 22,
      strokeColor: colors.title,
    });
    y += 40;
    state.hashTable.buckets.forEach((bucket) => {
      const rowY = y + bucket.index * 48;
      const isHighlighted = state.hashTable!.highlightBucket === bucket.index;
      specs.push({
        type: "rectangle",
        id: stableId(`ht-bucket-${bucket.index}`),
        x: 100,
        y: rowY,
        width: 65,
        height: 40,
        strokeColor: isHighlighted ? colors.cellBorderActive : colors.cellBorder,
        backgroundColor: isHighlighted ? colors.cellBgActive : colors.boxBg,
        strokeWidth: isHighlighted ? 2 : 1,
      });
      specs.push({
        type: "text",
        id: stableId(`ht-idx-${bucket.index}`),
        x: 115,
        y: rowY + 10,
        text: `[${bucket.index}]`,
        fontSize: 16,
        strokeColor: colors.textSecondary,
      });
      bucket.items.forEach((item, ii) => {
        const itemX = 190 + ii * 110;
        specs.push({
          type: "arrow",
          id: stableId(`ht-arrow-${bucket.index}-${ii}`),
          x: itemX - 25,
          y: rowY + 20,
          width: 25,
          height: 0,
          strokeColor: colors.cellBorder,
        });
        specs.push({
          type: "rectangle",
          id: stableId(`ht-item-${bucket.index}-${ii}`),
          x: itemX,
          y: rowY,
          width: 80,
          height: 40,
          strokeColor: colors.cellBorderSorted,
          backgroundColor: colors.cellBgSorted,
          strokeWidth: 1,
        });
        specs.push({
          type: "text",
          id: stableId(`ht-val-${bucket.index}-${ii}`),
          x: itemX + 15,
          y: rowY + 10,
          text: String(item.key),
          fontSize: 16,
          strokeColor: colors.textPrimary,
        });
      });
    });
    y += state.hashTable.buckets.length * 48 + 40;
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
        strokeColor: colors.varBorder,
        backgroundColor: colors.varBg,
        strokeWidth: 1,
      });
      specs.push({
        type: "text",
        id: stableId(`var-text-${name}`),
        x: 115 + i * 180,
        y: y + 17,
        text: `${name} = ${value}`,
        fontSize: 17,
        strokeColor: colors.varText,
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
      strokeColor: colors.compare,
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
      strokeColor: colors.title,
    });
    const order =
      state.linkedList.order ??
      state.linkedList.nodes.map((n) => n.value);

    order.forEach((v, i) => {
      const x = 100 + i * 120;
      specs.push({
        type: "rectangle",
        id: stableId(`ll-node-${v}`),
        x,
        y: y + 30,
        width: 70,
        height: 48,
        strokeColor: colors.cellBorder,
        backgroundColor: colors.cellBg,
        strokeWidth: 1,
      });
      specs.push({
        type: "text",
        id: stableId(`ll-val-${v}`),
        x: x + 25,
        y: y + 43,
        text: String(v),
        fontSize: 18,
        strokeColor: colors.textPrimary,
      });
      if (i < order.length - 1) {
        specs.push({
          type: "arrow",
          id: stableId(`ll-arrow-${i}`),
          x: x + 70,
          y: y + 54,
          width: 50,
          height: 0,
          strokeColor: colors.title,
        });
      }
    });

    /* ── Linked list pointers ── */
    Object.entries(state.linkedList.pointers).forEach(([ptrName, targetId]) => {
      if (targetId === null) {
        const x = 100 + order.length * 120;
        specs.push({
          type: "text",
          id: stableId(`llptr-${ptrName}-null`),
          x,
          y: y + 86,
          text: `${ptrName} → null`,
          fontSize: 14,
          strokeColor: colors.pointer,
        });
        return;
      }
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
        strokeColor: colors.pointer,
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
      strokeColor: colors.title,
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
          strokeColor: colors.edgeNormal,
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
          strokeColor: active ? colors.cellBorderActive : colors.nodeBorder,
          backgroundColor: active ? colors.nodeActiveBg : colors.nodeBg,
          strokeWidth: active ? 3 : 1,
        });
        specs.push({
          type: "text",
          id: stableId(`tree-val-${n.id}`),
          x: n.x - 9,
          y: n.y - 8 + offsetY - 60,
          text: String(n.value),
          fontSize: 16,
          strokeColor: colors.textPrimary,
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
      strokeColor: colors.compare,
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
      strokeColor: colors.message,
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
      strokeColor: colors.complexity,
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

export default function SemanticCanvas({
  state,
  theme = "light",
}: {
  state: CanvasState;
  theme?: "light" | "dark";
}) {
  const apiRef = useRef<{ updateScene: (scene: { elements: unknown[]; appState?: Record<string, unknown> }) => void } | null>(null);
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
    const stateKey = JSON.stringify(state) + "_" + theme;
    if (stateKey === prevStateRef.current) return;
    prevStateRef.current = stateKey;

    const specs = buildScene(state, theme);
    const elements = convertFn(specs);
    apiRef.current.updateScene({
      elements,
      appState: {
        viewBackgroundColor: theme === "dark" ? "#12121A" : "#FAFAF8",
        theme,
      },
    });
  }, [state, theme]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  if (!loaded || !ExcalidrawComponent) {
    return (
      <div
        className={`h-full w-full flex items-center justify-center ${
          theme === "dark" ? "bg-[#12121A] text-[#6C7293]" : "bg-[#FAFAF8] text-[#9498B3]"
        }`}
      >
        <div className="text-sm">Loading canvas...</div>
      </div>
    );
  }

  const Exc = ExcalidrawComponent;
  const specs = buildScene(state, theme);
  const initialElements = convertFn ? convertFn(specs) : [];

  return (
    <div ref={containerRef} className="h-full w-full excalidraw-wrapper">
      <Exc
        theme={theme}
        initialData={{
          elements: initialElements,
          appState: {
            viewBackgroundColor: theme === "dark" ? "#12121A" : "#FAFAF8",
            zenModeEnabled: false,
            gridSize: 20,
            theme,
          },
        }}
        excalidrawAPI={(a: unknown) => {
          apiRef.current = a as {
            updateScene: (scene: { elements: unknown[]; appState?: Record<string, unknown> }) => void;
          };
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
