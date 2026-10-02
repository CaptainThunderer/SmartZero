"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { getSupabaseBrowser } from "../../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setErrorMsg("Authentication service unavailable. Please check configuration.");
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/profile`,
      });

      setSubmitting(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setSubmitting(false);
      setErrorMsg(err instanceof Error ? err.message : "Failed to send reset link.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] transition-colors">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#5B5FEF] dark:hover:text-[#A5B4FC] mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-8 shadow-sm">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#5B5FEF] text-white flex items-center justify-center shadow-md mb-3">
              <Sparkles size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
            <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] mt-1 text-center">
              We will send you a secure link to reset your SmartZero credentials
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-semibold mb-1">Check your inbox</div>
                  <div>
                    If an account exists with that email, a password recovery link has been dispatched.
                  </div>
                </div>
              </div>

              <Link
                href="/login"
                className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-medium text-sm flex items-center justify-center transition-colors"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

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
                    placeholder="student@university.edu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
