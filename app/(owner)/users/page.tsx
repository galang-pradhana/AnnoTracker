"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";
import type { User } from "@/types";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "employee" | "owner">("all");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState<"employee" | "owner">("employee");
  const [isActive, setIsActive] = useState(true);

  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(ROUTES.LOGIN); return; }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setUsers(data as User[]);
    } catch (err) {
      console.error("Fetch users error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast("Nama lengkap pengguna wajib diisi.", "error");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      showToast("Alamat email tidak valid.", "error");
      return;
    }
    if (!password || password.length < 6) {
      showToast("Password minimal 6 karakter.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          role,
          isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat user baru");
      }

      if (data.user) {
        setUsers((prev) => [data.user as User, ...prev]);
      } else {
        await fetchUsers();
      }

      setShowAddModal(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      setIsActive(true);
      showToast(`✅ Akun ${fullName.trim()} (${email.trim()}) berhasil dibuat!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambah pengguna";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !fullName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          userId: editingUser.id,
          fullName: fullName.trim(),
          role,
          isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengedit pengguna");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, full_name: fullName.trim(), role, is_active: isActive }
            : u
        )
      );

      setEditingUser(null);
      setFullName("");
      setEmail("");
      showToast("✅ Data pengguna berhasil diperbarui!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengedit pengguna";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword || newPassword.length < 6) {
      showToast("Password baru minimal 6 karakter.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          userId: resetPasswordUser.id,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal reset password");
      }

      showToast(`✅ Password baru untuk ${resetPasswordUser.full_name} berhasil disimpan!`);
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal reset password";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email || "");
    setRole(user.role);
    setIsActive(user.is_active ?? true);
  };

  const toggleUserStatus = async (user: User) => {
    const newStatus = !user.is_active;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          userId: user.id,
          fullName: user.full_name,
          role: user.role,
          isActive: newStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengubah status");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
      );
      showToast(
        `Status ${user.full_name} diubah menjadi ${newStatus ? "Aktif" : "Nonaktif"}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status";
      showToast(msg, "error");
    }
  };

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUser = async (userToDelete: User, force = false) => {
    setIsDeleting(true);
    setDeleteWarningMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          userId: userToDelete.id,
          force,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.hasHistory) {
          setDeleteWarningMsg(data.error);
          return;
        }
        throw new Error(data.error || "Gagal menghapus pengguna.");
      }

      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteConfirmUser(null);
      showToast(`User ${userToDelete.full_name} telah dihapus permanen.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus pengguna";
      showToast(msg, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchLower) ||
      (u.email && u.email.toLowerCase().includes(searchLower));
    const matchesRole = roleFilter === "all" || u.role === roleFilter;

    const userIsActive = u.is_active ?? true;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && userIsActive) ||
      (statusFilter === "inactive" && !userIsActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-12 transition-colors duration-200">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4 sticky top-0 z-10 transition-colors shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo variant="icon" size="md" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Manajemen Pengguna</h1>
              <p className="text-xs text-[var(--text-secondary)]">Tambah akun karyawan baru, atur password & role pengguna</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold overflow-x-auto border border-[var(--border)]">
              <Link href={ROUTES.OWNER_DASHBOARD} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
              <Link href={ROUTES.OWNER_PAYROLL} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Payroll</Link>
              <Link href={ROUTES.OWNER_MASTER_DATA} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Master Data</Link>
              <Link href={ROUTES.OWNER_USERS} className="px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30">User</Link>
              <Link href={ROUTES.OWNER_ASSESSMENT} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Assessment</Link>
              <Link href={ROUTES.OWNER_SETTINGS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Settings</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {feedback && (
          <div className={`p-4 rounded-xl text-sm font-medium border animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]"
              : "bg-[var(--primary-soft)] border-[var(--danger)]/30 text-[var(--danger)]"
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <input
                type="text"
                placeholder="🔍 Cari nama atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold border border-[var(--border)]">
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] font-bold border border-[var(--accent-teal)]/30"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Aktif ({users.filter(u => u.is_active ?? true).length})
              </button>
              <button
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "inactive"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Nonaktif ({users.filter(u => !(u.is_active ?? true)).length})
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Semua ({users.length})
              </button>
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | "employee" | "owner")}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer font-medium"
            >
              <option value="all">Semua Role</option>
              <option value="employee">Employee</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          <button
            onClick={() => {
              setShowAddModal(true);
              setFullName("");
              setEmail("");
              setPassword("");
              setRole("employee");
              setIsActive(true);
            }}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>+ Tambah User Baru</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Daftar Pengguna Sistem</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Menampilkan {filteredUsers.length} dari total {users.length} pengguna
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Memuat data pengguna...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Tidak ada pengguna yang cocok dengan filter pencarian.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    <th className="px-6 py-3">Nama Pengguna</th>
                    <th className="px-6 py-3">Email Login</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-primary)]">{u.full_name}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-mono">{u.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-[var(--text-primary)]">
                        {u.email || (u.role === "employee" ? "employee@annotracker.com" : "owner@email.com")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === "owner"
                            ? "bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/30"
                            : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border border-[var(--border)]"
                        }`}>
                          {u.role === "owner" ? "👑 Owner" : "👤 Employee"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          u.is_active ?? true
                            ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        }`}>
                          {u.is_active ?? true ? "● Aktif" : "○ Nonaktif"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors font-semibold cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => { setResetPasswordUser(u); setNewPassword(""); }}
                            className="px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors font-semibold cursor-pointer"
                            title="Reset password karyawan ini"
                          >
                            🔑 Password
                          </button>
                          <button
                            onClick={() => toggleUserStatus(u)}
                            className={`px-2.5 py-1.5 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                              u.is_active ?? true
                                ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                : "text-[var(--accent-teal)] hover:bg-[var(--accent-teal-soft)]"
                            }`}
                          >
                            {u.is_active ?? true ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirmUser(u);
                              setDeleteWarningMsg(null);
                            }}
                            className="px-2.5 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors font-semibold cursor-pointer"
                            title="Hapus permanen pengguna ini"
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Add / Edit User Modal ────────────────────────────────────────── */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => { setShowAddModal(false); setEditingUser(null); }}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 text-white">
              <h3 className="text-base font-bold">
                {editingUser ? "✏️ Edit Data Pengguna" : "+ Tambah Pengguna Baru"}
              </h3>
              <p className="text-xs text-teal-200 mt-0.5">
                {editingUser ? `Mengubah akun ${editingUser.full_name}` : "Tentukan email & password login untuk karyawan baru"}
              </p>
            </div>

            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Login *
                </label>
                <input
                  type="email"
                  required
                  placeholder="Contoh: budi@annotracker.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Password Awal Login *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Password ini digunakan karyawan untuk pertama kali masuk.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Role Pengguna *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "employee" | "owner")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="employee">Employee (Karyawan Anotasi)</option>
                  <option value="owner">Owner (Admin / Pemilik)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Akun Aktif (Dapat mencatat pekerjaan & masuk sistem)
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingUser(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Memproses..." : editingUser ? "Simpan Perubahan" : "+ Buat User Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ───────────────────────────────────────────── */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setResetPasswordUser(null)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 text-white">
              <h3 className="text-base font-bold">🔑 Reset Password Karyawan</h3>
              <p className="text-xs text-amber-100 mt-0.5">Akun: {resetPasswordUser.full_name}</p>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password Baru *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Ketik password baru (minimal 6 karakter)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Menyimpan..." : "✓ Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete User Modal ─────────────────────────────────────────────── */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeleteConfirmUser(null)}>
          <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--primary)] px-6 py-5 text-white">
              <h3 className="text-base font-bold">🗑️ Konfirmasi Hapus Pengguna</h3>
              <p className="text-xs text-white/90 mt-0.5">{deleteConfirmUser.full_name}</p>
            </div>

            <div className="p-6 space-y-4">
              {deleteWarningMsg ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs space-y-3">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                    <span>⚠️ Proteksi Riwayat Sesi & Payroll:</span>
                  </p>
                  <p>{deleteWarningMsg}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Pilih <strong>Nonaktifkan</strong> jika ingin mengarsipkan akun secara aman, atau pilih <strong>Tetap Hapus Permanen</strong> jika akun ini adalah akun test/dummy yang ingin dibersihkan dari database.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        toggleUserStatus(deleteConfirmUser);
                        setDeleteConfirmUser(null);
                      }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      🔒 Nonaktifkan Akun Ini Saja (Rekomendasi Aman)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(deleteConfirmUser, true)}
                      disabled={isDeleting}
                      className="w-full py-2 bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isDeleting ? "Menghapus..." : "🔥 Tetap Hapus Permanen Akun Ini"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun <span className="font-bold">{deleteConfirmUser.full_name}</span> secara permanen? Data user yang belum memiliki riwayat pengerjaan jam kerja akan dihapus bersih dari sistem dan database Supabase Auth.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                {!deleteWarningMsg && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(deleteConfirmUser)}
                    disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isDeleting ? "Hapus..." : "🗑️ Ya, Hapus Permanen"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
