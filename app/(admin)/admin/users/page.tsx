"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Filter,
  UserCheck,
  Ban,
  UserX,
  UserPlus,
  X,
  Lock,
  Mail,
  Trophy,
} from "lucide-react";
import type { UserRole, AccountStatus } from "@/types/auth";
import { useAuthStore } from "@/stores/authStore";

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  display_name?: string;
  student_id?: string;
  college?: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
  assigned_contests?: string[];
}

interface ContestSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
}

export default function AdminUsersPage() {
  const { role: callerRole } = useAuthStore();
  const [serverCallerRole, setServerCallerRole] = useState<UserRole | null>(null);
  const effectiveCallerRole: UserRole = serverCallerRole || callerRole || "student";

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Staff provisioning modal state
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [provFullName, setProvFullName] = useState("");
  const [provEmail, setProvEmail] = useState("");
  const [provPassword, setProvPassword] = useState("");
  const [provRole, setProvRole] = useState<"admin" | "contest_admin">("admin");
  const [provContestIds, setProvContestIds] = useState<string[]>([]);
  const [provisioning, setProvisioning] = useState(false);
  const [provError, setProvError] = useState<string | null>(null);

  // Contest assignment edit modal state
  const [editingAssignmentsUser, setEditingAssignmentsUser] = useState<ManagedUser | null>(null);
  const [selectedContestIds, setSelectedContestIds] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
      if (data.contests) {
        setContests(data.contests);
      }
      if (data.callerRole) {
        setServerCallerRole(data.callerRole);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStatus = async (targetUserId: string, nextStatus: AccountStatus) => {
    setUpdatingUserId(targetUserId);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          account_status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatusMsg({ type: "error", text: data.error || "Failed to update status." });
      } else {
        setStatusMsg({ type: "success", text: `Account status updated to "${nextStatus}".` });
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, account_status: nextStatus } : u))
        );
      }
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error updating status.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleUpdateRole = async (targetUserId: string, nextRole: UserRole) => {
    setUpdatingUserId(targetUserId);
    setStatusMsg(null);
    const prevUsers = users;
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, role: nextRole } : u))
    );
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          role: nextRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        // Rollback on failure
        setUsers(prevUsers);
        setStatusMsg({ type: "error", text: data.error || "Failed to update role." });
      } else {
        setStatusMsg({ type: "success", text: `Role successfully updated to "${nextRole}".` });
        fetchUsers();
      }
    } catch (err: unknown) {
      setUsers(prevUsers);
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error updating role.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleSaveAssignments = async () => {
    if (!editingAssignmentsUser) return;
    setUpdatingUserId(editingAssignmentsUser.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: editingAssignmentsUser.id,
          role: "contest_admin",
          contest_ids: selectedContestIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatusMsg({ type: "error", text: data.error || "Failed to update assignments." });
      } else {
        setStatusMsg({ type: "success", text: "Contest assignments updated successfully." });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingAssignmentsUser.id ? { ...u, assigned_contests: selectedContestIds } : u
          )
        );
        setEditingAssignmentsUser(null);
      }
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error updating assignments.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provFullName || !provEmail || !provPassword) {
      setProvError("Please complete all required fields.");
      return;
    }
    if (provPassword.length < 8) {
      setProvError("Password must be at least 8 characters long.");
      return;
    }

    setProvisioning(true);
    setProvError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: provFullName.trim(),
          email: provEmail.trim(),
          password: provPassword.trim(),
          role: provRole,
          contest_ids: provRole === "contest_admin" ? provContestIds : [],
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setProvError(data.error || "Failed to provision staff account.");
      } else {
        setStatusMsg({
          type: "success",
          text: `Staff user "${provFullName}" successfully provisioned with role "${provRole}".`,
        });
        setIsProvisionOpen(false);
        setProvFullName("");
        setProvEmail("");
        setProvPassword("");
        setProvContestIds([]);
        fetchUsers();
      }
    } catch (err: unknown) {
      setProvError(err instanceof Error ? err.message : "Network error provisioning user.");
    } finally {
      setProvisioning(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.student_id && u.student_id.toLowerCase().includes(q));

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.account_status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            <span>Admin Hub</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-[#232946] dark:text-white flex items-center gap-2">
            <Users size={22} className="text-[#5B5FEF]" />
            <span>User Management & RBAC Hierarchy</span>
          </h1>
          <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] mt-0.5">
            Verify student accounts, enforce exam access policies, and provision administrative roles.
          </p>
        </div>

        {effectiveCallerRole === "super_admin" && (
          <button
            onClick={() => {
              setIsProvisionOpen(true);
              setProvError(null);
            }}
            className="h-9 px-4 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm self-start sm:self-auto shrink-0"
          >
            <UserPlus size={15} />
            <span>Provision Staff User</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
            statusMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-400"
          }`}
        >
          {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6F8A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-xs text-[#232946] dark:text-white placeholder-[#6B6F8A] focus:outline-none focus:border-[#5B5FEF]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
            <Filter size={13} />
            <span>Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-xs text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="contest_admin">Contest Admin</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-[#6B6F8A] dark:text-[#A0A6C2] ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-xs text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
            <span className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">Loading institutional users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
            No users match the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAF8] dark:bg-[#12121A] border-b border-[#E7E7E2] dark:border-[#27273D] text-[#6B6F8A] dark:text-[#A0A6C2] uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Contest Scope</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Institution / ID</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E7E2] dark:divide-[#27273D]">
                {filteredUsers.map((u) => {
                  const isBusy = updatingUserId === u.id;
                  const isContestAdmin = u.role === "contest_admin";
                  const assignmentCount = u.assigned_contests?.length || 0;
                  const isPrimarySuperAdmin = u.email.toLowerCase() === "phaneendhra2508@gmail.com";
                  const isTargetAdminOrSuper = u.role === "admin" || u.role === "super_admin";
                  const canEditRole =
                    !isBusy &&
                    !isPrimarySuperAdmin &&
                    (effectiveCallerRole === "super_admin" ||
                      (effectiveCallerRole === "admin" && !isTargetAdminOrSuper));

                  return (
                    <tr key={u.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#232946] dark:text-white">
                          {u.full_name || u.display_name || "Student"}
                        </div>
                        <div className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] font-mono">{u.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isPrimarySuperAdmin ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 text-[#4338CA] dark:text-[#A5B4FC] font-semibold text-xs"
                            title="Primary Super Administrator account (Protected)"
                          >
                            <Lock size={12} className="text-[#5B5FEF]" />
                            <span>Super Admin</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={u.role}
                              disabled={!canEditRole}
                              onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                              title={
                                !canEditRole
                                  ? effectiveCallerRole === "admin"
                                    ? "Administrators cannot modify peer Admins or Super Admins."
                                    : "You do not have permission to modify this role."
                                  : "Change user role"
                              }
                              className="px-2 py-1 rounded-lg border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-xs font-semibold text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <option value="student">Student</option>
                              <option value="contest_admin">Contest Admin</option>
                              {effectiveCallerRole === "super_admin" && (
                                <>
                                  <option value="admin">Admin</option>
                                  <option value="super_admin">Super Admin</option>
                                </>
                              )}
                              {effectiveCallerRole === "admin" && isTargetAdminOrSuper && (
                                <option value={u.role} disabled>
                                  {u.role === "super_admin" ? "Super Admin" : "Admin"}
                                </option>
                              )}
                            </select>
                            {isBusy && <Loader2 size={12} className="animate-spin text-[#5B5FEF]" />}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isContestAdmin ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#4338CA] dark:text-[#A5B4FC] border border-indigo-200 dark:border-indigo-800/50">
                              {assignmentCount} {assignmentCount === 1 ? "contest" : "contests"}
                            </span>
                            {(effectiveCallerRole === "super_admin" || effectiveCallerRole === "admin") && (
                              <button
                                onClick={() => {
                                  setEditingAssignmentsUser(u);
                                  setSelectedContestIds(u.assigned_contests || []);
                                }}
                                className="text-[10px] text-[#5B5FEF] hover:underline"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        ) : u.role === "admin" || u.role === "super_admin" ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">All Contests</span>
                        ) : (
                          <span className="text-[11px] text-[#9CA3AF]">N/A</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            u.account_status === "verified"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                              : u.account_status === "pending"
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                              : u.account_status === "suspended"
                              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50"
                              : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {u.account_status === "verified" && <ShieldCheck size={11} />}
                          {u.account_status === "pending" && <ShieldAlert size={11} />}
                          {u.account_status === "suspended" && <ShieldX size={11} />}
                          <span>{u.account_status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#6B6F8A] dark:text-[#A0A6C2]">
                        <div>{u.college || "—"}</div>
                        <div className="text-[10px] font-mono">{u.student_id || "No ID"}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {u.account_status !== "verified" && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, "verified")}
                              disabled={isBusy}
                              title="Verify Student Account"
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-600/40 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <UserCheck size={12} />
                              <span>Verify</span>
                            </button>
                          )}

                          {u.account_status === "verified" && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, "suspended")}
                              disabled={isBusy}
                              title="Suspend Account Access"
                              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-600/20 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-600/40 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              <Ban size={12} />
                              <span>Suspend</span>
                            </button>
                          )}

                          {u.account_status !== "disabled" && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, "disabled")}
                              disabled={isBusy}
                              title="Disable Account"
                              className="p-1 rounded-lg border border-[#E7E7E2] dark:border-[#27273D] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
                            >
                              <UserX size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Provision Staff User */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E7E2] dark:border-[#27273D] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#5B5FEF] text-white flex items-center justify-center">
                  <UserPlus size={15} />
                </div>
                <h3 className="font-bold text-sm text-[#232946] dark:text-white">Provision Staff Account</h3>
              </div>
              <button
                onClick={() => setIsProvisionOpen(false)}
                className="text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {provError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{provError}</span>
              </div>
            )}

            <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#232946] dark:text-white mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Smith"
                  value={provFullName}
                  onChange={(e) => setProvFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#232946] dark:text-white mb-1">Staff Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="staff@institution.edu"
                  value={provEmail}
                  onChange={(e) => setProvEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#232946] dark:text-white mb-1">Temporary Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={provPassword}
                  onChange={(e) => setProvPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#232946] dark:text-white mb-1">Administrative Role</label>
                <select
                  value={provRole}
                  onChange={(e) => setProvRole(e.target.value as "admin" | "contest_admin")}
                  className="w-full px-3 py-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A] text-[#232946] dark:text-white focus:outline-none focus:border-[#5B5FEF]"
                >
                  <option value="admin">Administrator (Full contest & user management)</option>
                  <option value="contest_admin">Contest Admin (Scoped to assigned contests)</option>
                </select>
              </div>

              {provRole === "contest_admin" && (
                <div className="space-y-1.5 pt-1">
                  <label className="block font-semibold text-[#232946] dark:text-white">Assign to Contests</label>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A]">
                    {contests.length === 0 ? (
                      <div className="text-[11px] text-[#6B6F8A] dark:text-[#A0A6C2] py-2 text-center">No contests available to assign.</div>
                    ) : (
                      contests.map((c) => {
                        const checked = provContestIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 p-1 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setProvContestIds([...provContestIds, c.id]);
                                } else {
                                  setProvContestIds(provContestIds.filter((id) => id !== c.id));
                                }
                              }}
                              className="rounded border-[#27273D] text-[#5B5FEF]"
                            />
                            <span className="text-[11px] text-[#232946] dark:text-white truncate">{c.title}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E7E2] dark:border-[#27273D]">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning}
                  className="px-4 py-1.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {provisioning ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  <span>Provision Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Contest Admin Assignments */}
      {editingAssignmentsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181824] border border-[#E7E7E2] dark:border-[#27273D] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E7E7E2] dark:border-[#27273D] pb-3">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[#5B5FEF]" />
                <h3 className="font-bold text-sm text-[#232946] dark:text-white">
                  Contest Assignments: {editingAssignmentsUser.full_name}
                </h3>
              </div>
              <button
                onClick={() => setEditingAssignmentsUser(null)}
                className="text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2]">
              Select which contests this Contest Administrator is authorized to manage:
            </p>

            <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] bg-[#FAFAF8] dark:bg-[#12121A]">
              {contests.length === 0 ? (
                <div className="text-xs text-[#6B6F8A] dark:text-[#A0A6C2] py-4 text-center">No contests available.</div>
              ) : (
                contests.map((c) => {
                  const checked = selectedContestIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContestIds([...selectedContestIds, c.id]);
                          } else {
                            setSelectedContestIds(selectedContestIds.filter((id) => id !== c.id));
                          }
                        }}
                        className="rounded border-[#27273D] text-[#5B5FEF]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-[#232946] dark:text-white truncate">{c.title}</div>
                        <div className="text-[10px] text-[#6B6F8A] dark:text-[#A0A6C2] uppercase">{c.status}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E7E7E2] dark:border-[#27273D]">
              <button
                onClick={() => setEditingAssignmentsUser(null)}
                className="px-3 py-1.5 rounded-xl border border-[#E7E7E2] dark:border-[#27273D] text-xs text-[#6B6F8A] dark:text-[#A0A6C2] hover:text-[#232946] dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignments}
                disabled={updatingUserId === editingAssignmentsUser.id}
                className="px-4 py-1.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4D51E0] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {updatingUserId === editingAssignmentsUser.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                <span>Save Assignments</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
