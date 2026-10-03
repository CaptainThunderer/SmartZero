"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Clock,
  Calendar,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play,
  ArrowLeft,
  Shield,
  User,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Contest, ContestParticipant, ContestStatus } from "@/types/contest";

export default function StudentContestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();

  const { isAuthenticated, user, profile, isLoading: authLoading, initialize } = useAuthStore();

  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [passcode, setPasscode] = useState("");
  const [joining, setJoining] = useState(false);
  const [participant, setParticipant] = useState<ContestParticipant | null>(null);

  // Server-authoritative timer state
  const [serverStatus, setServerStatus] = useState<ContestStatus>("UPCOMING");
  const [secondsToStart, setSecondsToStart] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load contest metadata
  useEffect(() => {
    fetch(`/api/contest/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.contest) {
          setContest(d.contest);
          setServerStatus(d.contest.status);
        } else {
          setErrorMsg(d.error || "Contest not found.");
        }
      })
      .catch(() => setErrorMsg("Failed to load contest."))
      .finally(() => setLoading(false));
  }, [slug]);

  // Sync server timer periodically
  useEffect(() => {
    const syncTimer = () => {
      fetch(`/api/contest/${slug}/state`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status) {
            setServerStatus(d.status);
            setSecondsToStart(d.seconds_to_start);
            setSecondsRemaining(d.seconds_remaining);
          }
        })
        .catch(() => {});
    };

    syncTimer();
    const interval = setInterval(syncTimer, 4000);
    return () => clearInterval(interval);
  }, [slug]);

  // Local 1-second countdown tick
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsToStart((s) => Math.max(0, s - 1));
      setSecondsRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setErrorMsg("Please enter the contest passcode.");
      return;
    }

    setJoining(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/contest/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: passcode.trim(),
          user_id: user?.id || profile?.id || "student-user",
        }),
      });

      const data = await res.json();
      setJoining(false);

      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Failed to join contest.");
      } else {
        setParticipant(data.participant);
      }
    } catch (err: unknown) {
      setJoining(false);
      setErrorMsg(err instanceof Error ? err.message : "Network error.");
    }
  };

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-white flex flex-col items-center justify-center p-6 space-y-3">
        <AlertCircle size={32} className="text-red-400" />
        <h1 className="text-base font-bold">Contest Not Found</h1>
        <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">The requested contest URL does not exist or has been removed.</p>
        <Link href="/contests" className="text-xs text-[#5B5FEF] underline">
          Return to Contests Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#E7E7E2] dark:border-[#27273D] bg-white/95 dark:bg-[#181824]/95 px-6 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/contests" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#5B5FEF] text-white flex items-center justify-center">
              <Trophy size={14} />
            </div>
            <span className="font-bold tracking-tight text-sm text-[#232946] dark:text-white">
              Smart<span className="text-[#5B5FEF]">Zero</span> Assessment
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-2 text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
              <User size={13} />
              <span>{profile?.full_name || profile?.email || "Student"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href={`/login?redirect=/contest/${slug}`}
                className="px-3 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#181824] hover:bg-white dark:hover:bg-[#1E1E2E] text-xs font-semibold text-[#232946] dark:text-[#F1F5F9] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href={`/signup?redirect=/contest/${slug}`}
                className="px-3 py-1.5 rounded-lg bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl w-full mx-auto space-y-6">
        <div className="w-full bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Header & Status */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E7E7E2] dark:border-[#27273D]">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl font-bold tracking-tight text-[#232946] dark:text-white">{contest.title}</h1>
              </div>
              <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">{contest.description || "Official SmartZero assessment."}</p>
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                serverStatus === "LIVE"
                  ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 animate-pulse border border-emerald-200 dark:border-emerald-500/30"
                  : serverStatus === "UPCOMING" || serverStatus === "PUBLISHED"
                  ? "bg-indigo-50 dark:bg-blue-500/20 text-[#4338CA] dark:text-blue-400 border border-indigo-200 dark:border-blue-500/30"
                  : "bg-zinc-100 dark:bg-gray-500/20 text-zinc-600 dark:text-gray-400 border border-zinc-200 dark:border-gray-500/30"
              }`}
            >
              {serverStatus}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Timing details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#FAFAF8] dark:bg-[#12121A] border border-[#E7E7E2] dark:border-[#27273D]">
              <span className="text-[10px] text-[#6B6F8A] uppercase font-semibold block mb-0.5">Duration</span>
              <div className="font-bold text-[#232946] dark:text-white flex items-center gap-1.5">
                <Clock size={13} className="text-[#5B5FEF]" />
                <span>{contest.duration_minutes} minutes</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FAFAF8] dark:bg-[#12121A] border border-[#E7E7E2] dark:border-[#27273D]">
              <span className="text-[10px] text-[#6B6F8A] uppercase font-semibold block mb-0.5">Start Window</span>
              <div className="font-bold text-[#232946] dark:text-white text-[11px] truncate">
                {new Date(contest.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>

          {/* Flow 1: Not Authenticated */}
          {!isAuthenticated ? (
            <div className="p-6 rounded-xl bg-[#FAFAF8] dark:bg-[#12121A] border border-[#E7E7E2] dark:border-[#27273D] text-center space-y-3">
              <Shield size={24} className="mx-auto text-[#5B5FEF]" />
              <div className="text-xs font-semibold text-[#232946] dark:text-white">Student Sign In Required</div>
              <p className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] max-w-sm mx-auto">
                Authentication is required to participate in official contests and register your verified scorecard.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Link
                  href={`/login?redirect=/contest/${slug}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold transition-colors"
                >
                  Sign In to Join
                </Link>
                <Link
                  href={`/signup?redirect=/contest/${slug}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-[#1E1E2E] hover:bg-indigo-100 dark:hover:bg-[#282942] text-[#4338CA] dark:text-[#A5B4FC] text-xs font-semibold border border-indigo-200 dark:border-[#373A58] transition-colors"
                >
                  Register Student Account
                </Link>
              </div>
            </div>
          ) : !participant ? (
            /* Flow 2: Authenticated, but not unlocked with passcode */
            <form onSubmit={handleJoin} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
                  Enter Contest Passcode
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6F8A]" />
                  <input
                    type="password"
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm font-mono text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={joining}
                className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {joining ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Verifying Passcode...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Enter Waiting Room</span>
                  </>
                )}
              </button>
            </form>
          ) : serverStatus === "UPCOMING" || serverStatus === "PUBLISHED" ? (
            /* Flow 3: Unlocked, waiting in WAITING ROOM */
            <div className="space-y-6 pt-2">
              <div className="p-6 rounded-2xl bg-[#FAFAF8] dark:bg-[#12121A] border border-[#E7E7E2] dark:border-[#27273D] text-center space-y-3">
                <div className="text-[11px] font-bold text-[#5B5FEF] dark:text-[#A5B4FC] uppercase tracking-wider">
                  Waiting Room • Contest Begins In
                </div>
                <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-[#232946] dark:text-white">
                  {formatCountdown(secondsToStart)}
                </div>
                <div className="text-[11px] text-[#6B6F8A] flex items-center justify-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Synchronized with authoritative server clock</span>
                </div>
              </div>

              {/* Instructions Callout */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] space-y-1.5 text-xs">
                <div className="font-bold text-[#232946] dark:text-white text-xs">Assessment Rules:</div>
                <div className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] whitespace-pre-line leading-relaxed">
                  {contest.instructions}
                </div>
              </div>

              <div className="text-center text-[11px] text-[#6B6F8A]">
                The exam will automatically begin the moment the countdown reaches zero.
              </div>
            </div>
          ) : serverStatus === "LIVE" ? (
            /* Flow 4: Contest is LIVE */
            <div className="space-y-4 pt-2 text-center">
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                <CheckCircle2 size={32} className="mx-auto text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-[#232946] dark:text-white">Contest is Now LIVE!</h2>
                <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
                  Time remaining: <span className="font-mono font-bold text-[#232946] dark:text-white">{formatCountdown(secondsRemaining)}</span>
                </p>
                <Link
                  href={`/contest/${slug}/live`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  <Play size={14} />
                  <span>Start Live Exam</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Flow 5: Contest has ENDED */
            <div className="p-6 rounded-2xl bg-[#FAFAF8] dark:bg-[#12121A] border border-[#E7E7E2] dark:border-[#27273D] text-center space-y-2">
              <div className="text-sm font-bold text-[#232946] dark:text-white">This Contest Has Concluded</div>
              <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
                Submissions are now closed. Results will be published by the contest administrator.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
