"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  School,
  IdCard,
  Shield,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  LayoutDashboard,
  KeyRound,
  Lock,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { ThemeToggle } from "../../components/ThemeToggle";
import { getSupabaseBrowser } from "@/lib/supabase";

function ProfileContent() {
  const router = useRouter();
  const { profile, role, updateProfile, signOut, user, refreshProfile } = useAuthStore();

  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [college, setCollege] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || profile.display_name || "");
      setStudentId(profile.student_id || "");
      setCollege(profile.college || "");
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    const res = await updateProfile({
      full_name: fullName.trim(),
      display_name: fullName.trim(),
      student_id: studentId.trim(),
      college: college.trim(),
    });

    setSaving(false);
    if (res.error) {
      setStatusMsg({ type: "error", text: res.error });
    } else {
      setStatusMsg({ type: "success", text: "Profile details successfully updated!" });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        setPasswordMsg({ type: "error", text: "Supabase connection is not available in local mode." });
        setChangingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });
      if (error) {
        setPasswordMsg({ type: "error", text: error.message });
      } else {
        setPasswordMsg({
          type: "success",
          text: "Password successfully updated! Your temporary staff password has been replaced.",
        });
        setNewPassword("");
        setConfirmPassword("");
        await refreshProfile();
      }
    } catch (err: unknown) {
      setPasswordMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const roleDisplayName = {
    super_admin: "Super Admin",
    admin: "Administrator",
    contest_admin: "Contest Admin",
    student: "Student Learner",
  }[role] || "Student";

  const accountStatus = profile?.account_status || "verified";
  const isVerified = accountStatus === "verified";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-[#F1F5F9] transition-colors">
      <div className="w-full max-w-xl space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#5B5FEF] dark:hover:text-[#A5B4FC] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>SmartZero Learn</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#E7E7E2] dark:border-[#27273D] hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors"
            >
              <LayoutDashboard size={14} />
              <span>Student Dashboard</span>
            </Link>

            {(role === "admin" || role === "super_admin") && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#5B5FEF]/10 text-[#5B5FEF] dark:text-[#A5B4FC] hover:bg-[#5B5FEF]/20 font-medium transition-colors"
              >
                <span>Admin Hub</span>
              </Link>
            )}
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header & Avatar */}
          <div className="flex items-start justify-between pb-6 border-b border-[#E7E7E2] dark:border-[#27273D]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#5B5FEF] text-white flex items-center justify-center text-xl font-bold shadow-md">
                {(fullName || profile?.email || "SZ").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#232946] dark:text-white">
                  {fullName || "SmartZero Learner"}
                </h1>
                <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] flex items-center gap-1.5 mt-0.5 font-mono">
                  <Mail size={13} />
                  <span>{profile?.email}</span>
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Shield size={11} />
                    <span>{roleDisplayName}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                      isVerified
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {isVerified ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                    <span>Status: {accountStatus}</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Feedback Banner */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                statusMsg.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400"
              }`}
            >
              {statusMsg.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <AlertCircle size={16} className="shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Edit Profile Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B6F8A] dark:text-[#A0A6C2]">
              Academic & Personal Details
            </h2>

            <div>
              <label className="block text-xs font-semibold text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
                />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
                  Student ID
                </label>
                <div className="relative">
                  <IdCard
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
                  />
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. STU-2026-99"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
                  College / Univ
                </label>
                <div className="relative">
                  <School
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
                  />
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g. MIT"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Details</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security & Password Section (Staff Only) */}
          {role !== "student" && (
            <div id="security" className="pt-6 border-t border-[#E7E7E2] dark:border-[#27273D] space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-[#5B5FEF]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B6F8A] dark:text-[#A0A6C2]">
                  Security & Password Update (Staff Only)
                </h2>
              </div>

              {Boolean(user?.user_metadata?.must_change_password) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Your account is currently using the temporary staff password. Please change your password to secure your staff account.
                  </span>
                </div>
              )}

              {passwordMsg && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                    passwordMsg.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400"
                  }`}
                >
                  {passwordMsg.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0" />
                  )}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6B6F8A] dark:text-[#A0A6C2] mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9498B3]"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-sm focus:outline-none focus:border-[#5B5FEF] focus:ring-1 focus:ring-[#5B5FEF] transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword || !newPassword}
                  className="w-full py-2.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#232946] dark:bg-[#1E1E2E] hover:bg-[#343859] dark:hover:bg-[#252646] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound size={14} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
