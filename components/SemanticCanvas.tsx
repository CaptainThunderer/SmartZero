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

/* ── Text wrapping utility for collision-free canvas layout ── */
function wrapText(text: string, maxChars = 75): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxChars) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/* ── Convert CanvasState → Excalidraw element specs ── */
export function buildScene(state: CanvasState, theme: "light" | "dark" = "light") {
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

  /* ── Whiteboard Header ── */
  if (state.boardHeader) {
    let rawTitle = state.boardHeader.title;
    let rawSubtitle = state.boardHeader.subtitle;
    if (rawTitle.length > 50) {
      if (!rawSubtitle) rawSubtitle = rawTitle;
      rawTitle = rawTitle.slice(0, 47) + "...";
    }

    specs.push({
      type: "text",
      id: stableId("wb-title"),
      x: 100,
      y,
      text: rawTitle.toUpperCase(),
      fontSize: 22,
      strokeColor: colors.title,
    });

    if (rawSubtitle) {
      const subLines = wrapText(rawSubtitle, 65);
      specs.push({
        type: "text",
        id: stableId("wb-subtitle"),
        x: 100,
        y: y + 30,
        text: subLines.join("\n"),
        fontSize: 14,
        strokeColor: colors.textSecondary,
      });
      y += 36 + subLines.length * 20 + 16;
    } else {
      y += 48;
    }

    if (state.boardHeader.badge) {
      specs.push({
        type: "text",
        id: stableId("wb-badge"),
        x: 640,
        y: 80,
        text: `[ ${state.boardHeader.badge} ]`,
        fontSize: 13,
        strokeColor: colors.accent,
      });
    }
  }


  /* ── Side-by-Side Comparison Board ── */
  if (state.comparisonBoard) {
    const board = state.comparisonBoard;
    specs.push({
      type: "rectangle",
      id: stableId("cmp-left-box"),
      x: 100,
      y,
      width: 340,
      height: 160,
      strokeColor: colors.cellBorderActive,
      backgroundColor: colors.boxBg,
      strokeWidth: 1.5,
    });
    specs.push({
      type: "text",
      id: stableId("cmp-left-title"),
      x: 115,
      y: y + 12,
      text: board.leftTitle,
      fontSize: 18,
      strokeColor: colors.title,
    });
    board.leftItems.slice(0, 4).forEach((item, idx) => {
      specs.push({
        type: "text",
        id: stableId(`cmp-left-item-${idx}`),
        x: 115,
        y: y + 42 + idx * 26,
        text: `• ${item}`,
        fontSize: 14,
        strokeColor: colors.textPrimary,
      });
    });

    specs.push({
      type: "rectangle",
      id: stableId("cmp-right-box"),
      x: 480,
      y,
      width: 340,
      height: 160,
      strokeColor: colors.cellBorderSorted,
      backgroundColor: colors.boxBg,
      strokeWidth: 1.5,
    });
    specs.push({
      type: "text",
      id: stableId("cmp-right-title"),
      x: 495,
      y: y + 12,
      text: board.rightTitle,
      fontSize: 18,
      strokeColor: colors.cellBorderSorted,
    });
    board.rightItems.slice(0, 4).forEach((item, idx) => {
      specs.push({
        type: "text",
        id: stableId(`cmp-right-item-${idx}`),
        x: 495,
        y: y + 42 + idx * 26,
        text: `• ${item}`,
        fontSize: 14,
        strokeColor: colors.textPrimary,
      });
    });

    if (board.verdict) {
      specs.push({
        type: "text",
        id: stableId("cmp-verdict"),
        x: 100,
        y: y + 175,
        text: `Verdict: ${board.verdict}`,
        fontSize: 15,
        strokeColor: colors.accent,
      });
      y += 210;
    } else {
      y += 180;
    }
  }

  /* ── Merge Tree (Gold Standard Divide & Conquer) ── */
  if (state.mergeTree) {
    state.mergeTree.levels.forEach((lvl, li) => {
      const isLvlActive = state.mergeTree!.activeLevel === li;
      specs.push({
        type: "text",
        id: stableId(`mt-lbl-${li}`),
        x: 100,
        y,
        text: lvl.label,
        fontSize: 14,
        strokeColor: isLvlActive ? colors.accent : colors.title,
      });

      let subX = 250;
      lvl.arrays.forEach((subArr, ai) => {
        const subWidth = Math.max(70, subArr.length * 36 + 14);
        specs.push({
          type: "rectangle",
          id: stableId(`mt-box-${li}-${ai}`),
          x: subX,
          y: y - 6,
          width: subWidth,
          height: 32,
          strokeColor: isLvlActive ? colors.cellBorderActive : colors.cellBorder,
          backgroundColor: isLvlActive ? colors.cellBgActive : colors.cellBg,
          strokeWidth: isLvlActive ? 2 : 1,
        });
        specs.push({
          type: "text",
          id: stableId(`mt-val-${li}-${ai}`),
          x: subX + 10,
          y: y + 2,
          text: `[ ${subArr.join(", ")} ]`,
          fontSize: 14,
          strokeColor: colors.textPrimary,
        });
        subX += subWidth + 20;
      });

      if (li < state.mergeTree!.levels.length - 1) {
        specs.push({
          type: "text",
          id: stableId(`mt-arr-${li}`),
          x: 350,
          y: y + 30,
          text: "↓",
          fontSize: 16,
          strokeColor: colors.title,
        });
      }
      y += 50;
    });
    y += 15;
  }

  /* ── DP Table ── */
  if (state.dpTable) {
    const table = state.dpTable;
    specs.push({
      type: "text",
      id: stableId("dp-title"),
      x: 100,
      y,
      text: table.title || "DP State Table",
      fontSize: 20,
      strokeColor: colors.title,
    });
    y += 32;

    if (table.meaning) {
      specs.push({
        type: "text",
        id: stableId("dp-meaning"),
        x: 100,
        y,
        text: `State Meaning: ${table.meaning}`,
        fontSize: 14,
        strokeColor: colors.accent,
      });
      y += 26;
    }

    if (table.headers) {
      table.headers.forEach((h, hi) => {
        specs.push({
          type: "text",
          id: stableId(`dp-hdr-${hi}`),
          x: 170 + hi * 75,
          y,
          text: h,
          fontSize: 14,
          strokeColor: colors.indexText,
        });
      });
      y += 24;
    }

    table.rows.forEach((row, ri) => {
      if (table.rowHeaders && table.rowHeaders[ri]) {
        specs.push({
          type: "text",
          id: stableId(`dp-rhdr-${ri}`),
          x: 100,
          y: y + 8,
          text: table.rowHeaders[ri],
          fontSize: 14,
          strokeColor: colors.indexText,
        });
      }

      row.forEach((cell, ci) => {
        const cx = 160 + ci * 75;
        const isHighlighted =
          table.highlightCell &&
          table.highlightCell[0] === ri &&
          table.highlightCell[1] === ci;

        specs.push({
          type: "rectangle",
          id: stableId(`dp-cell-${ri}-${ci}`),
          x: cx,
          y,
          width: 65,
          height: 38,
          strokeColor: isHighlighted ? colors.cellBorderActive : colors.cellBorder,
          backgroundColor: isHighlighted ? colors.cellBgActive : colors.cellBg,
          strokeWidth: isHighlighted ? 2 : 1,
        });
        specs.push({
          type: "text",
          id: stableId(`dp-val-${ri}-${ci}`),
          x: cx + 18,
          y: y + 9,
          text: String(cell),
          fontSize: 15,
          strokeColor: isHighlighted ? colors.accent : colors.textPrimary,
        });
      });
      y += 46;
    });

    if (table.formula) {
      specs.push({
        type: "text",
        id: stableId("dp-formula"),
        x: 100,
        y: y + 5,
        text: `Transition: ${table.formula}`,
        fontSize: 15,
        strokeColor: colors.cellBorderSorted,
      });
      y += 35;
    }
    y += 15;
  }

  /* ── Set Container ── */
  if (state.setContainer) {
    const setC = state.setContainer;
    specs.push({
      type: "text",
      id: stableId("set-title"),
      x: 100,
      y,
      text: setC.title || "Set (Unique Elements)",
      fontSize: 20,
      strokeColor: colors.title,
    });
    y += 32;

    const setWidth = Math.max(300, setC.elements.length * 75 + 40);
    specs.push({
      type: "rectangle",
      id: stableId("set-box"),
      x: 100,
      y,
      width: setWidth,
      height: 68,
      strokeColor: colors.cellBorderActive,
      backgroundColor: colors.boxBg,
      strokeWidth: 2,
    });

    setC.elements.forEach((elem, ei) => {
      const ex = 120 + ei * 75;
      const isHigh = setC.highlightElements?.includes(elem) ?? false;
      specs.push({
        type: "rectangle",
        id: stableId(`set-elem-${ei}`),
        x: ex,
        y: y + 11,
        width: 55,
        height: 44,
        strokeColor: isHigh ? colors.cellBorderSorted : colors.cellBorder,
        backgroundColor: isHigh ? colors.cellBgSorted : colors.cellBg,
        strokeWidth: isHigh ? 2 : 1,
      });
      specs.push({
        type: "text",
        id: stableId(`set-elem-val-${ei}`),
        x: ex + 18,
        y: y + 23,
        text: String(elem),
        fontSize: 17,
        strokeColor: colors.textPrimary,
      });
    });

    if (setC.note) {
      specs.push({
        type: "text",
        id: stableId("set-note"),
        x: 100,
        y: y + 78,
        text: setC.note,
        fontSize: 14,
        strokeColor: colors.textSecondary,
      });
      y += 110;
    } else {
      y += 85;
    }
  }

  /* ── Call Stack ── */
  if (state.callStack) {
    specs.push({
      type: "text",
      id: stableId("cs-title"),
      x: 100,
      y,
      text: "Call Stack (Recursion Frames)",
      fontSize: 20,
      strokeColor: colors.title,
    });
    y += 32;

    state.callStack.frames.forEach((frame, fi) => {
      const isTop = frame.active ?? (fi === state.callStack!.frames.length - 1);
      specs.push({
        type: "rectangle",
        id: stableId(`cs-frame-${fi}`),
        x: 100,
        y,
        width: 320,
        height: 40,
        strokeColor: isTop ? colors.cellBorderActive : colors.cellBorder,
        backgroundColor: isTop ? colors.cellBgActive : colors.cellBg,
        strokeWidth: isTop ? 2 : 1,
      });
      specs.push({
        type: "text",
        id: stableId(`cs-frame-text-${fi}`),
        x: 115,
        y: y + 10,
        text: `${frame.fnName}(${frame.args})${frame.returnValue ? ` → ${frame.returnValue}` : ""}`,
        fontSize: 15,
        strokeColor: colors.textPrimary,
      });
      if (isTop) {
        specs.push({
          type: "text",
          id: stableId("cs-top-ptr"),
          x: 435,
          y: y + 10,
          text: "← ACTIVE FRAME",
          fontSize: 14,
          strokeColor: colors.accent,
        });
      }
      y += 46;
    });
    y += 15;
  }

  /* ── Decision Tree ── */
  if (state.decisionTree) {
    specs.push({
      type: "text",
      id: stableId("dt-title"),
      x: 100,
      y,
      text: "Decision Tree (Backtracking: Choose → Explore → Undo)",
      fontSize: 20,
      strokeColor: colors.title,
    });
    const offsetY = y + 40;
    const nodeMap = Object.fromEntries(state.decisionTree.nodes.map((n) => [n.id, n]));

    state.decisionTree.edges.forEach(([uId, vId], ei) => {
      const u = nodeMap[uId];
      const v = nodeMap[vId];
      if (u && v) {
        specs.push({
          type: "arrow",
          id: stableId(`dt-edge-${ei}`),
          x: u.x,
          y: u.y + offsetY,
          width: v.x - u.x,
          height: v.y - u.y,
          strokeColor: colors.edgeNormal,
        });
      }
    });

    state.decisionTree.nodes.forEach((n) => {
      const isPruned = n.state === "pruned";
      const isActive = n.state === "active";

      specs.push({
        type: "rectangle",
        id: stableId(`dt-node-${n.id}`),
        x: n.x - 30,
        y: n.y - 18 + offsetY,
        width: 60,
        height: 36,
        strokeColor: isPruned ? colors.compare : isActive ? colors.cellBorderActive : colors.cellBorder,
        backgroundColor: isPruned ? colors.cellBgDimmed : isActive ? colors.cellBgActive : colors.cellBg,
        strokeWidth: isActive ? 2 : 1,
      });
      specs.push({
        type: "text",
        id: stableId(`dt-text-${n.id}`),
        x: n.x - 18,
        y: n.y - 8 + offsetY,
        text: n.label,
        fontSize: 14,
        strokeColor: isPruned ? colors.textDimmed : colors.textPrimary,
      });
    });
    y = offsetY + 220;
  }

  /* ── Array ── */
  if (state.array) {
    const hasPointers = Object.keys(state.array.pointers).length > 0;
    const titleY = y;
    const pointerY = y + 36;
    const cellY = hasPointers ? y + 66 : y + 38;

    specs.push({
      type: "text",
      id: stableId("arr-title"),
      x: 100,
      y: titleY,
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
        y: cellY,
        width: 76,
        height: 62,
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
        x: x + 26,
        y: cellY + 20,
        text: String(v),
        fontSize: 20,
        strokeColor: dimmed ? colors.textDimmed : colors.textPrimary,
        opacity: dimmed ? 50 : 100,
      });
      specs.push({
        type: "text",
        id: stableId(`arr-idx-${i}`),
        x: x + 31,
        y: cellY + 68,
        text: String(i),
        fontSize: 14,
        strokeColor: colors.indexText,
      });

      /* Pointers above array cells (grouped to prevent overlapping text) */
      const ptrsAtI = Object.entries(state.array!.pointers)
        .filter(([_, idx]) => idx === i)
        .map(([pName]) => pName);

      if (ptrsAtI.length > 0) {
        specs.push({
          type: "text",
          id: stableId(`ptr-${i}`),
          x: x + (ptrsAtI.length > 1 ? 8 : 18),
          y: pointerY,
          text: `↓ ${ptrsAtI.join(", ")}`,
          fontSize: ptrsAtI.length > 2 ? 13 : 15,
          strokeColor: colors.pointer,
        });
      }
    });

    /* ── Sliding Window Bracket ── */
    if (state.slidingWindow) {
      const { startIndex, endIndex, label, conditionOrSum } = state.slidingWindow;
      const winX = 100 + startIndex * 90;
      const winWidth = Math.max(76, (endIndex - startIndex + 1) * 90 - 14);
      specs.push({
        type: "rectangle",
        id: stableId("sliding-window-box"),
        x: winX - 6,
        y: cellY - 6,
        width: winWidth + 12,
        height: 74,
        strokeColor: colors.accent,
        backgroundColor: "transparent",
        strokeWidth: 2.5,
      });
      specs.push({
        type: "text",
        id: stableId("sliding-window-label"),
        x: winX + 8,
        y: cellY + 95,
        text: `WINDOW: [${startIndex}..${endIndex}] ${conditionOrSum ? `(${conditionOrSum})` : ""}`,
        fontSize: 14,
        strokeColor: colors.accent,
      });
      if (label) {
        specs.push({
          type: "text",
          id: stableId("sliding-window-action"),
          x: winX + 8,
          y: pointerY - 22,
          text: `▲ ${label}`,
          fontSize: 14,
          strokeColor: colors.pointer,
        });
      }
    }

    y = cellY + 125;
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

    /* ── Linked list pointers (grouped to avoid overlapping text) ── */
    const nullPtrs = Object.entries(state.linkedList.pointers)
      .filter(([_, targetId]) => targetId === null)
      .map(([pName]) => pName);

    if (nullPtrs.length > 0) {
      const x = 100 + order.length * 120;
      specs.push({
        type: "text",
        id: stableId("llptr-null"),
        x,
        y: y + 86,
        text: `${nullPtrs.join(", ")} → null`,
        fontSize: 14,
        strokeColor: colors.pointer,
      });
    }

    state.linkedList.nodes.forEach((node) => {
      const ptrsAtNode = Object.entries(state.linkedList!.pointers)
        .filter(([_, targetId]) => targetId === node.id)
        .map(([pName]) => pName);

      if (ptrsAtNode.length > 0) {
        const displayIdx = order.indexOf(node.value);
        if (displayIdx !== -1) {
          const x = 100 + displayIdx * 120;
          specs.push({
            type: "text",
            id: stableId(`llptr-${node.id}`),
            x: x + 10,
            y: y + 86,
            text: `↑ ${ptrsAtNode.join(", ")}`,
            fontSize: 14,
            strokeColor: colors.pointer,
          });
        }
      }
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

  /* ── Current Operation & Decision Card ── */
  if (state.compareText) {
    const lines = wrapText(state.compareText, 70);
    const cardHeight = Math.max(52, 28 + lines.length * 22 + 8);

    specs.push({
      type: "rectangle",
      id: stableId("op-card-bg"),
      x: 100,
      y,
      width: 740,
      height: cardHeight,
      strokeColor: colors.compare,
      backgroundColor: isDark ? "#231E17" : "#FFFDF5",
      strokeWidth: 1.5,
    });

    specs.push({
      type: "text",
      id: stableId("op-card-badge"),
      x: 115,
      y: y + 8,
      text: "▶ OPERATION & DECISION",
      fontSize: 12,
      strokeColor: colors.compare,
    });

    specs.push({
      type: "text",
      id: stableId("compare"),
      x: 115,
      y: y + 26,
      text: lines.join("\n"),
      fontSize: 15,
      strokeColor: colors.textPrimary,
    });
    y += cardHeight + 20;
  }

  /* ── Variables ── */
  const vars = Object.entries(state.variables);
  if (vars.length > 0) {
    const perRow = 4;
    const numRows = Math.ceil(vars.length / perRow);
    vars.forEach(([name, value], i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const varX = 100 + col * 180;
      const varY = y + row * 65;

      specs.push({
        type: "rectangle",
        id: stableId(`var-bg-${name}`),
        x: varX,
        y: varY,
        width: 165,
        height: 52,
        strokeColor: colors.varBorder,
        backgroundColor: colors.varBg,
        strokeWidth: 1,
      });
      specs.push({
        type: "text",
        id: stableId(`var-text-${name}`),
        x: varX + 14,
        y: varY + 16,
        text: `${name} = ${value}`,
        fontSize: 16,
        strokeColor: colors.varText,
      });
    });
    y += numRows * 65 + 24;
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

  /* ── Callout Box ── */
  if (state.callout) {
    const boxColor =
      state.callout.boxType === "insight"
        ? colors.cellBorderActive
        : state.callout.boxType === "warning"
          ? colors.compare
          : state.callout.boxType === "success"
            ? colors.cellBorderSorted
            : colors.boxBorder;
    const bgColor =
      state.callout.boxType === "insight"
        ? colors.cellBgActive
        : state.callout.boxType === "success"
          ? colors.cellBgSorted
          : colors.boxBg;

    const wrappedLines = wrapText(state.callout.text, 72);
    const boxHeight = Math.max(48, wrappedLines.length * 24 + 20);

    specs.push({
      type: "rectangle",
      id: stableId("callout-box"),
      x: 100,
      y,
      width: 740,
      height: boxHeight,
      strokeColor: boxColor,
      backgroundColor: bgColor,
      strokeWidth: 1.5,
    });
    specs.push({
      type: "text",
      id: stableId("callout-text"),
      x: 115,
      y: y + 12,
      text: wrappedLines.join("\n"),
      fontSize: 15,
      strokeColor: colors.textPrimary,
    });
    y += boxHeight + 24;
  }

  /* ── Key Insight Card ── */
  if (state.insightCard) {
    const wrappedInsight = wrapText(state.insightCard.text, 72);
    const cardHeight = Math.max(56, 32 + wrappedInsight.length * 22 + 16);

    specs.push({
      type: "rectangle",
      id: stableId("insight-card-box"),
      x: 100,
      y,
      width: 740,
      height: cardHeight,
      strokeColor: colors.cellBorderActive,
      backgroundColor: colors.cellBgActive,
      strokeWidth: 2,
    });
    specs.push({
      type: "text",
      id: stableId("insight-card-title"),
      x: 115,
      y: y + 10,
      text: `★ KEY INSIGHT: ${state.insightCard.title}`,
      fontSize: 13,
      strokeColor: colors.accent,
    });
    specs.push({
      type: "text",
      id: stableId("insight-card-text"),
      x: 115,
      y: y + 32,
      text: wrappedInsight.join("\n"),
      fontSize: 14,
      strokeColor: colors.textPrimary,
    });
    y += cardHeight + 24;
  }

  /* ── Message ── */
  if (state.message) {
    const lines = wrapText(state.message, 70);
    specs.push({
      type: "text",
      id: stableId("message"),
      x: 100,
      y,
      text: lines.join("\n"),
      fontSize: 18,
      strokeColor: colors.message,
    });
    y += Math.max(36, lines.length * 24 + 16);
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
          if (typeof window !== "undefined") {
            (window as unknown as { __EXCALIDRAW_API__?: unknown }).__EXCALIDRAW_API__ = a;
          }
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
