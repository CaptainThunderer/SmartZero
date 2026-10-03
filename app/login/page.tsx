"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Mail, Lock, Loader2, AlertCircle, ArrowLeft, User, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

import { ThemeToggle } from "../../components/ThemeToggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/";

  const { signInWithPassword, signInWithRegisteredEmail, isAuthenticated, role, isLoading, initialize } = useAuthStore();

  const [mode, setMode] = useState<"student" | "admin">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (redirectParam && redirectParam !== "/") {
        router.push(redirectParam);
      } else if (role === "admin" || role === "super_admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    }
  }, [isLoading, isAuthenticated, role, redirectParam, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your email address.");
      setErrorCode("EMAIL_REQUIRED");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setErrorCode(null);

    if (mode === "student") {
      const res = await signInWithRegisteredEmail(email.trim());
      setSubmitting(false);
      if (!res.success) {
        setErrorMsg(res.error || "No student profile found for this email. Please register an account first.");
        setErrorCode(res.code || "STUDENT_NOT_FOUND");
      } else {
        if (redirectParam && redirectParam !== "/") {
          router.push(redirectParam);
        } else {
          router.push("/");
        }
      }
    } else {
      if (!password) {
        setErrorMsg("Please enter your password for admin sign in.");
        setErrorCode("PASSWORD_REQUIRED");
        setSubmitting(false);
        return;
      }
      const res = await signInWithPassword(email.trim(), password);
      setSubmitting(false);
      if (res.error) {
        setErrorMsg(res.error);
        setErrorCode("AUTH_FAILED");
      } else {
        const state = useAuthStore.getState();
        if (state.role === "student") {
          await state.signOut();
          setErrorMsg("Access denied. This account does not have staff privileges. Please use Student Access.");
          setErrorCode("FORBIDDEN_ROLE");
          return;
        }

        if (redirectParam && redirectParam !== "/") {
          router.push(redirectParam);
        } else {
          router.push("/admin");
        }
      }
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Top navigation with ThemeToggle */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#5B5FEF] dark:hover:text-[#A5B4FC] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to SmartZero Learn</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-8 shadow-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-md mb-3">
            <Sparkles size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Sign in to Smart<span className="text-[#5B5FEF]">Zero</span>
          </h1>
          <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] mt-1 text-center">
            Access your student profile, contests, and dashboard
          </p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 p-1 bg-[#FAFAF8] dark:bg-[#12121A] border border-[#E7E7E2] dark:border-[#27273D] rounded-xl mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("student");
              setErrorMsg(null);
              setErrorCode(null);
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mode === "student"
                ? "bg-white dark:bg-[#1E1E2E] text-[#5B5FEF] dark:text-[#A5B4FC] shadow-xs"
                : "text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white"
            }`}
          >
            <User size={14} />
            <span>Student Access</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("admin");
              setErrorMsg(null);
              setErrorCode(null);
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              mode === "admin"
                ? "bg-white dark:bg-[#1E1E2E] text-[#5B5FEF] dark:text-[#A5B4FC] shadow-xs"
                : "text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white"
            }`}
          >
            <ShieldCheck size={14} />
            <span>Admin / Staff</span>
          </button>
        </div>

        {/* Informative notice */}
        {mode === "student" ? (
          <div className="mb-4 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/30 text-[11px] text-indigo-800 dark:text-indigo-300">
            Enter the email address you registered as a student. No password required.
          </div>
        ) : (
          <div className="mb-4 p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/30 text-[11px] text-purple-800 dark:text-purple-300">
            Sign in with your authorized staff credentials.
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-400">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
            {errorCode === "STAFF_ACCOUNT_DETECTED" && (
              <div className="mt-2.5 pt-2 border-t border-red-200/50 dark:border-red-900/40 flex items-center justify-between">
                <span className="text-[11px] text-red-600 dark:text-red-400">Staff or Admin account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("admin");
                    setErrorMsg(null);
                    setErrorCode(null);
                  }}
                  className="text-xs font-semibold text-[#5B5FEF] dark:text-[#A5B4FC] hover:underline cursor-pointer"
                >
                  Switch to Admin / Staff →
                </button>
              </div>
            )}
            {errorCode === "STUDENT_NOT_FOUND" && (
              <div className="mt-2.5 pt-2 border-t border-red-200/50 dark:border-red-900/40 flex items-center justify-between">
                <span className="text-[11px] text-red-600 dark:text-red-400">Need to create an account?</span>
                <Link
                  href="/signup"
                  className="text-xs font-semibold text-[#5B5FEF] dark:text-[#A5B4FC] hover:underline"
                >
                  Register Student Account →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === "student" ? "student@university.edu" : "admin@smartzero.io"}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
              />
            </div>
          </div>

          {mode === "admin" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6F8A] dark:text-[#A0A6C2]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#5B5FEF] hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors mt-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>{mode === "student" ? "Continue as Student" : "Sign in to Staff Portal"}</span>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-6 border-t border-[#E7E7E2] dark:border-[#27273D] text-center text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
          Don&apos;t have an account yet?{" "}
          <Link href="/signup" className="text-[#5B5FEF] font-semibold hover:underline">
            Register Student Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] transition-colors">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#5B5FEF]" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
