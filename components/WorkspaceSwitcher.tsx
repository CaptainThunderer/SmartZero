"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, X, Edit3, Check } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import type { AppTheme } from "../types/dsa";

export default function WorkspaceSwitcher({ theme }: { theme: AppTheme }) {
  const {
    workspaces,
    activeWorkspaceId,
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    renameWorkspace,
  } = useWorkspaceStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startRename(id: string, currentTitle: string) {
    setEditingId(id);
    setEditTitle(currentTitle);
  }

  function commitRename() {
    if (editingId) {
      renameWorkspace(editingId, editTitle);
      setEditingId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  }

  const isDark = theme === "dark";

  return (
    <div
      className={`h-10 shrink-0 border-b flex items-center px-3 gap-1.5 overflow-x-auto z-10 select-none ${
        isDark ? "bg-[#181824] border-[#27273D]" : "bg-[#F7F7F5] border-[#E7E7E2]"
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-max py-0.5">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isEditing = editingId === ws.id;

          return (
            <div
              key={ws.id}
              onClick={() => !isEditing && switchWorkspace(ws.id)}
              onDoubleClick={() => startRename(ws.id, ws.title)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer border ${
                isActive
                  ? isDark
                    ? "bg-[#252646] border-[#4E5199] text-[#E0E7FF] shadow-sm"
                    : "bg-white border-[#D6D8EA] text-[#3730A3] shadow-sm font-semibold"
                  : isDark
                    ? "bg-[#12121A]/60 border-transparent text-[#9498B3] hover:bg-[#1E1E2E] hover:text-[#D1D5DB]"
                    : "bg-transparent border-transparent text-[#6B6F8A] hover:bg-white/80 hover:text-[#232946]"
              }`}
            >
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleKeyDown}
                    className={`h-5 px-1.5 rounded text-[11px] outline-none border ${
                      isDark
                        ? "bg-[#12121A] border-[#6366F1] text-white"
                        : "bg-white border-[#5B5FEF] text-[#232946]"
                    }`}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      commitRename();
                    }}
                    className="p-0.5 hover:opacity-80 text-[#10B981]"
                    title="Save"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <span className="truncate max-w-[190px]">{ws.title}</span>
              )}

              {/* Rename icon on hover when active */}
              {isActive && !isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(ws.id, ws.title);
                  }}
                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity ${
                    isDark ? "hover:text-white" : "hover:text-[#232946]"
                  }`}
                  title="Rename canvas"
                >
                  <Edit3 size={11} />
                </button>
              )}

              {/* Close Tab Button */}
              {workspaces.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      ws.notes.length > 0 &&
                      !window.confirm(
                        `Workspace "${ws.title}" contains ${ws.notes.length} note(s). Delete this workspace?`
                      )
                    ) {
                      return;
                    }
                    deleteWorkspace(ws.id);
                  }}
                  className={`p-0.5 rounded-full transition-colors opacity-70 hover:opacity-100 ${
                    isDark ? "hover:bg-[#374151] hover:text-white" : "hover:bg-[#E5E7EB] hover:text-[#111827]"
                  }`}
                  title="Close canvas"
                  aria-label={`Close ${ws.title}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* New Canvas Button */}
        <button
          onClick={() => createWorkspace(undefined, `Canvas ${workspaces.length + 1}`)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border border-dashed ${
            isDark
              ? "border-[#3E4466] text-[#A0A6C2] hover:bg-[#1E1E2E] hover:text-white hover:border-[#6366F1]"
              : "border-[#C7C9D9] text-[#6B6F8A] hover:bg-white hover:text-[#3730A3] hover:border-[#5B5FEF]"
          }`}
          title="Create a new independent learning canvas"
        >
          <Plus size={13} />
          <span>New Canvas</span>
        </button>
      </div>
    </div>
  );
}
