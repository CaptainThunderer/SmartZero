"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme, rehydrateFromStorage } = useWorkspaceStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    rehydrateFromStorage();
  }, [rehydrateFromStorage]);

  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-white dark:bg-[#181824] opacity-50 shrink-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      className={`h-8 w-8 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-white dark:bg-[#181824] hover:bg-[#FAFAF8] dark:hover:bg-[#202030] text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer ${className}`}
    >
      {isDark ? (
        <Sun size={15} className="text-amber-400" />
      ) : (
        <Moon size={15} className="text-[#5B5FEF]" />
      )}
    </button>
  );
}

export default ThemeToggle;
