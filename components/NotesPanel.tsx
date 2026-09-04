"use client";
import { useState } from "react";
import { X, Trash2, Edit3, Check, FileText, Plus } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import type { AppTheme } from "../types/dsa";

export default function NotesPanel({ theme }: { theme: AppTheme }) {
  const {
    getActiveWorkspace,
    addNote,
    updateNote,
    deleteNote,
    isNotesOpen,
    setNotesOpen,
  } = useWorkspaceStore();

  const activeWs = getActiveWorkspace();
  const notes = activeWs?.notes || [];

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  if (!isNotesOpen) return null;

  function handleAdd() {
    if (!newTitle.trim() && !newContent.trim()) return;
    addNote(newTitle, newContent);
    setNewTitle("");
    setNewContent("");
  }

  function startEdit(note: { id: string; title: string; content: string }) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  }

  function saveEdit() {
    if (editingId) {
      updateNote(editingId, editTitle, editContent);
      setEditingId(null);
    }
  }

  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col max-h-[85vh] transition-all overflow-hidden ${
          isDark
            ? "bg-[#181824] border-[#2E314D] text-[#F1F5F9]"
            : "bg-white border-[#E7E7E2] text-[#232946]"
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isDark ? "border-[#27273D] bg-[#1E1E2E]" : "border-[#E7E7E2] bg-[#FAFAF8]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#5B5FEF]/10 text-[#5B5FEF] flex items-center justify-center">
              <FileText size={15} />
            </div>
            <div>
              <div className="font-bold text-[13px] leading-tight">Workspace Notes</div>
              <div className="text-[10px] text-[#9498B3] truncate max-w-[320px]">
                {activeWs.title}
              </div>
            </div>
          </div>
          <button
            onClick={() => setNotesOpen(false)}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "hover:bg-[#27273D] text-[#9498B3]" : "hover:bg-[#F2F2EE] text-[#6B6F8A]"
            }`}
            title="Close notes"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* New Note Form */}
          <div
            className={`p-3.5 rounded-xl border ${
              isDark ? "bg-[#12121A] border-[#2A2D48]" : "bg-[#F9F9F8] border-[#E5E7EB]"
            }`}
          >
            <div className="text-[11px] font-semibold mb-2 flex items-center gap-1.5 text-[#5B5FEF]">
              <Plus size={13} />
              <span>Add Note for this Canvas</span>
            </div>
            <input
              type="text"
              placeholder="Note title (e.g., Pivot Choice Invariant)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={`w-full px-3 py-1.5 rounded-lg text-[12px] mb-2 outline-none border transition-colors ${
                isDark
                  ? "bg-[#181824] border-[#373A58] text-white placeholder-[#6C7293] focus:border-[#6366F1]"
                  : "bg-white border-[#D1D5DB] text-[#232946] placeholder-[#9CA3AF] focus:border-[#5B5FEF]"
              }`}
            />
            <textarea
              placeholder="Write your observations, invariant checks, or questions..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 rounded-lg text-[12px] outline-none border resize-none transition-colors ${
                isDark
                  ? "bg-[#181824] border-[#373A58] text-white placeholder-[#6C7293] focus:border-[#6366F1]"
                  : "bg-white border-[#D1D5DB] text-[#232946] placeholder-[#9CA3AF] focus:border-[#5B5FEF]"
              }`}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() && !newContent.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white text-[11.5px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>Save Note</span>
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#9498B3]">
              Saved Notes ({notes.length})
            </div>

            {notes.length === 0 ? (
              <div
                className={`py-8 text-center text-[12px] rounded-xl border border-dashed ${
                  isDark ? "border-[#2A2D48] text-[#6C7293]" : "border-[#E5E7EB] text-[#9CA3AF]"
                }`}
              >
                No notes yet for this workspace. Record key invariants, pointer steps, or takeaways.
              </div>
            ) : (
              notes.map((note) => {
                const isEditing = editingId === note.id;

                return (
                  <div
                    key={note.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isDark
                        ? "bg-[#1C1D2E] border-[#2A2D48] text-[#F1F5F9]"
                        : "bg-white border-[#E5E7EB] text-[#232946] shadow-2xs"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className={`w-full px-2.5 py-1 rounded text-[12px] outline-none border ${
                            isDark
                              ? "bg-[#12121A] border-[#6366F1] text-white"
                              : "bg-white border-[#5B5FEF] text-[#232946]"
                          }`}
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          className={`w-full px-2.5 py-1.5 rounded text-[12px] outline-none border resize-none ${
                            isDark
                              ? "bg-[#12121A] border-[#6366F1] text-white"
                              : "bg-white border-[#5B5FEF] text-[#232946]"
                          }`}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className={`px-2.5 py-1 rounded text-[11px] ${
                              isDark ? "hover:bg-[#27273D] text-[#9498B3]" : "hover:bg-[#F2F2EE] text-[#6B6F8A]"
                            }`}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1 rounded bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Check size={12} />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-[12.5px] leading-snug">
                            {note.title}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(note)}
                              className={`p-1 rounded transition-colors ${
                                isDark ? "hover:bg-[#27273D] text-[#9498B3]" : "hover:bg-[#F2F2EE] text-[#6B6F8A]"
                              }`}
                              title="Edit note"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              className="p-1 rounded text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                              title="Delete note"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {note.content && (
                          <div
                            className={`mt-1.5 text-[11.5px] leading-relaxed whitespace-pre-wrap ${
                              isDark ? "text-[#C7C9D9]" : "text-[#4A4E68]"
                            }`}
                          >
                            {note.content}
                          </div>
                        )}
                        <div className="mt-2 text-[9.5px] text-[#9498B3]">
                          {new Date(note.updatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-2.5 border-t text-[10.5px] text-[#9498B3] flex items-center justify-between ${
            isDark ? "border-[#27273D] bg-[#181824]" : "border-[#E7E7E2] bg-[#FAFAF8]"
          }`}
        >
          <span>Notes are saved locally in your browser for this workspace</span>
          <button
            onClick={() => setNotesOpen(false)}
            className="px-3 py-1 rounded bg-[#5B5FEF]/10 hover:bg-[#5B5FEF]/20 text-[#5B5FEF] font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
