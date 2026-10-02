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
}

export default function AdminUsersPage() {
  const { role: callerRole } = useAuthStore();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
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
        setStatusMsg({ type: "error", text: data.error || "Failed to update role." });
      } else {
        setStatusMsg({ type: "success", text: `Role updated to "${nextRole}".` });
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? { ...u, role: nextRole } : u))
        );
      }
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error updating role.",
      });
    } finally {
      setUpdatingUserId(null);
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
            className="inline-flex items-center gap-1.5 text-xs text-[#A0A6C2] hover:text-white transition-colors mb-2"
          >
            <ArrowLeft size={14} />
            <span>Admin Hub</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users size={22} className="text-[#5B5FEF]" />
            <span>User Management & RBAC Hierarchy</span>
          </h1>
          <p className="text-xs text-[#A0A6C2] mt-0.5">
            Verify student accounts, enforce exam access policies, and manage administrative roles.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
            statusMsg.type === "success"
              ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400"
              : "bg-red-950/40 border-red-900/50 text-red-400"
          }`}
        >
          {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-[#181824] border border-[#27273D] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6F8A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#27273D] bg-[#12121A] text-xs text-white placeholder-[#6B6F8A] focus:outline-none focus:border-[#5B5FEF]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-[#A0A6C2]">
            <Filter size={13} />
            <span>Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#27273D] bg-[#12121A] text-xs text-white focus:outline-none focus:border-[#5B5FEF]"
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="contest_admin">Contest Admin</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-[#A0A6C2] ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#27273D] bg-[#12121A] text-xs text-white focus:outline-none focus:border-[#5B5FEF]"
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
      <div className="bg-[#181824] border border-[#27273D] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#5B5FEF]" />
            <span className="text-xs text-[#A0A6C2]">Loading institutional users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#A0A6C2]">
            No users match the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12121A] border-b border-[#27273D] text-[#A0A6C2] uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Institution / ID</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27273D]">
                {filteredUsers.map((u) => {
                  const isBusy = updatingUserId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {u.full_name || u.display_name || "Student"}
                        </div>
                        <div className="text-[11px] text-[#A0A6C2] font-mono">{u.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          value={u.role}
                          disabled={isBusy || (u.role === "super_admin" && callerRole !== "super_admin")}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                          className="px-2 py-1 rounded-lg border border-[#27273D] bg-[#12121A] text-xs font-semibold text-white focus:outline-none focus:border-[#5B5FEF] disabled:opacity-50"
                        >
                          <option value="student">Student</option>
                          <option value="contest_admin">Contest Admin</option>
                          <option value="admin">Admin</option>
                          {callerRole === "super_admin" && (
                            <option value="super_admin">Super Admin</option>
                          )}
                        </select>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            u.account_status === "verified"
                              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/50"
                              : u.account_status === "pending"
                              ? "bg-amber-950/60 text-amber-400 border-amber-800/50"
                              : u.account_status === "suspended"
                              ? "bg-rose-950/60 text-rose-400 border-rose-800/50"
                              : "bg-zinc-900 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {u.account_status === "verified" && <ShieldCheck size={11} />}
                          {u.account_status === "pending" && <ShieldAlert size={11} />}
                          {u.account_status === "suspended" && <ShieldX size={11} />}
                          <span>{u.account_status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#A0A6C2]">
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
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
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
                              className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
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
                              className="p-1 rounded-lg border border-[#27273D] hover:bg-rose-950/40 text-[#A0A6C2] hover:text-rose-400 transition-colors disabled:opacity-50"
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
    </div>
  );
}
