"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { ShieldAlert, Maximize2, AlertTriangle, Lock } from "lucide-react";
import type { SecurityEventType } from "@/types/contest";

interface ExamSecurityShieldProps {
  slug: string;
  participantId?: string;
  userId?: string;
  enabled?: boolean;
  onLockExam?: () => void;
  onAutoSubmit?: (violationsCount: number, message: string) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export default function ExamSecurityShield({
  slug,
  participantId,
  userId,
  enabled = true,
  onLockExam,
  onAutoSubmit,
  onFullscreenChange,
}: ExamSecurityShieldProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const lastEventTimeRef = useRef<number>(0);

  // Debounced reporter to avoid flooding server with repeated events within 1.5s
  const reportEvent = useCallback(
    async (eventType: SecurityEventType, metadata?: Record<string, unknown>) => {
      if (!enabled || isLocked) return;

      const now = Date.now();
      if (now - lastEventTimeRef.current < 1500) {
        return;
      }
      lastEventTimeRef.current = now;

      try {
        const res = await fetch(`/api/contest/${slug}/security-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participant_id: participantId,
            event_type: eventType,
            user_id: userId || "demo-student-user",
            metadata: {
              ...metadata,
              timestamp: new Date().toISOString(),
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
            },
          }),
        });

        const data = await res.json();
        if (data.success) {
          setWarningCount(data.total_events);

          if (data.action === "auto_submit" || data.auto_submitted) {
            setIsLocked(true);
            setWarningMessage(data.message);
            if (onAutoSubmit) {
              onAutoSubmit(data.total_events, data.message);
            }
          } else if (data.action === "lock" || data.action === "terminate") {
            setIsLocked(true);
            setWarningMessage(data.message);
            if (onLockExam) onLockExam();
          } else if (data.action === "warning") {
            setWarningMessage(data.message);
          }
        }
      } catch {
        // Silently continue
      }
    },
    [slug, participantId, userId, enabled, isLocked, onLockExam, onAutoSubmit]
  );

  // Request browser fullscreen
  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        if (onFullscreenChange) onFullscreenChange(true);
      }
    } catch {
      // Permission denied or not supported
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // Check initial fullscreen state
    if (typeof document !== "undefined") {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (onFullscreenChange) onFullscreenChange(active);
    }

    // 1. Fullscreen change listener
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (onFullscreenChange) onFullscreenChange(active);
      if (!active) {
        reportEvent("fullscreen_exit", { reason: "User exited fullscreen mode" });
      }
    };

    // 2. Tab switch / Visibility change listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportEvent("tab_switch", { reason: "Document visibility set to hidden" });
      }
    };

    // 3. Window blur listener (switching away from window)
    const handleBlur = () => {
      reportEvent("window_blur", { reason: "Window lost active focus" });
    };

    // 4. Copy attempt interception (exempt internal Monaco editor / inputs)
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".monaco-editor") || target?.closest("input") || target?.closest("textarea")) {
        return;
      }
      reportEvent("copy_attempt", { text_length: e.clipboardData?.getData("text")?.length || 0 });
    };

    // 5. Context menu (right click) interception (exempt internal Monaco editor / inputs)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".monaco-editor") || target?.closest("input") || target?.closest("textarea")) {
        return;
      }
      e.preventDefault();
      reportEvent("context_menu", { x: e.clientX, y: e.clientY });
    };

    // 6. Developer tools and shortcut interception
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept F12 or Ctrl+Shift+I or Ctrl+Shift+C
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "C" || e.key === "J")) ||
        (e.ctrlKey && e.key === "u")
      ) {
        e.preventDefault();
        reportEvent("devtools_open", { key: e.key });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, reportEvent, onFullscreenChange]);

  return (
    <>
      {/* ── FULLSCREEN REMINDER PROMPT (IF NOT IN FULLSCREEN) ── */}
      {!isFullscreen && enabled && !isLocked && (
        <div className="bg-amber-950/60 border-b border-amber-800/40 px-6 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-400 shrink-0" />
            <span>
              Exam Integrity: Fullscreen mode is recommended during the assessment.
            </span>
          </div>
          <button
            onClick={requestFullscreen}
            className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Maximize2 size={12} />
            <span>Enter Fullscreen</span>
          </button>
        </div>
      )}

      {/* ── SECURITY WARNING MODAL (NON-ACCUSATORY INTEGRITY ALERT) ── */}
      {warningMessage && !isLocked && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Focus Integrity Alert</h3>
                <p className="text-xs text-[#A0A6C2]">
                  Notice {warningCount} recorded
                </p>
              </div>
            </div>

            <p className="text-xs text-[#D8DCEF] leading-relaxed">
              {warningMessage}
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setWarningMessage(null)}
                className="px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-xs font-semibold text-white transition-colors shadow-sm"
              >
                I Understand & Return to Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOCKOUT SCREEN (IF VIOLATION THRESHOLD EXCEEDED) ── */}
      {isLocked && (
        <div className="fixed inset-0 bg-[#12121A]/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-rose-500/50 rounded-2xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 mx-auto flex items-center justify-center text-rose-400">
              <Lock size={28} />
            </div>
            <h3 className="text-base font-bold text-white">Exam Workspace Locked</h3>
            <p className="text-xs text-[#A0A6C2] leading-relaxed">
              Multiple browser focus interruptions have been recorded for this session. The assessment has been paused in accordance with contest integrity policy.
            </p>
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/30 font-mono text-[11px] text-rose-300">
              Violations Logged: {warningCount}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
