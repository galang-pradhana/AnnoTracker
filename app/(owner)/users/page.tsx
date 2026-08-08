"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";
import type { User } from "@/types";

/* ─── tiny icon helpers ──────────────────────────────────────────────── */
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const IconBank = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);
const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const IconToggle = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
    {on
      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
      : <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />}
  </svg>
);

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "employee" | "owner">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Detail Drawer
  const [detailUser, setDetailUser] = useState<User | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState<"employee" | "owner">("employee");
  const [isActive, setIsActive] = useState(true);
  // Extended fields
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");

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

  /* ─── helpers ──────────────────────────────── */
  const resetForm = () => {
    setFullName(""); setEmail(""); setPassword(""); setRole("employee");
    setIsActive(true); setPhone(""); setBankName("");
    setBankAccountNumber(""); setBankAccountHolder("");
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email || "");
    setRole(user.role);
    setIsActive(user.is_active ?? true);
    setPhone(user.phone || "");
    setBankName(user.bank_name || "");
    setBankAccountNumber(user.bank_account_number || "");
    setBankAccountHolder(user.bank_account_holder || "");
    setDetailUser(null); // close drawer if open
  };

  /* ─── CRUD handlers ─────────────────────────── */
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { showToast("Nama lengkap wajib diisi.", "error"); return; }
    if (!email.trim() || !email.includes("@")) { showToast("Email tidak valid.", "error"); return; }
    if (!password || password.length < 6) { showToast("Password minimal 6 karakter.", "error"); return; }

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
          phone: phone.trim() || null,
          bankName: bankName.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankAccountHolder: bankAccountHolder.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat user baru");

      if (data.user) setUsers((prev) => [data.user as User, ...prev]);
      else await fetchUsers();

      setShowAddModal(false);
      resetForm();
      showToast(`✅ Akun ${fullName.trim()} berhasil dibuat!`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal menambah pengguna", "error");
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
          phone: phone.trim() || null,
          bankName: bankName.trim() || null,
          bankAccountNumber: bankAccountNumber.trim() || null,
          bankAccountHolder: bankAccountHolder.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengedit pengguna");

      const updatedUser: User = {
        ...editingUser,
        full_name: fullName.trim(),
        role,
        is_active: isActive,
        phone: phone.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        bank_account_number: bankAccountNumber.trim() || undefined,
        bank_account_holder: bankAccountHolder.trim() || undefined,
      };
      setUsers((prev) => prev.map((u) => u.id === editingUser.id ? updatedUser : u));
      // Sync detail drawer if it's open for the same user
      if (detailUser?.id === editingUser.id) setDetailUser(updatedUser);

      setEditingUser(null);
      resetForm();
      showToast("✅ Data pengguna berhasil diperbarui!");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal mengedit pengguna", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword || newPassword.length < 6) {
      showToast("Password baru minimal 6 karakter.", "error"); return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", userId: resetPasswordUser.id, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal reset password");
      showToast(`✅ Password baru untuk ${resetPasswordUser.full_name} berhasil disimpan!`);
      setResetPasswordUser(null); setNewPassword("");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal reset password", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    const newStatus = !user.is_active;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", userId: user.id, fullName: user.full_name, role: user.role, isActive: newStatus }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const updated = { ...user, is_active: newStatus };
      setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u));
      if (detailUser?.id === user.id) setDetailUser(updated);
      showToast(`Status ${user.full_name} → ${newStatus ? "Aktif" : "Nonaktif"}.`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal mengubah status", "error");
    }
  };

  const handleDeleteUser = async (userToDelete: User, force = false) => {
    setIsDeleting(true); setDeleteWarningMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId: userToDelete.id, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.hasHistory) { setDeleteWarningMsg(data.error); return; }
        throw new Error(data.error || "Gagal menghapus.");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteConfirmUser(null);
      if (detailUser?.id === userToDelete.id) setDetailUser(null);
      showToast(`User ${userToDelete.full_name} telah dihapus.`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal menghapus pengguna", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  /* ─── filtered list ─────────────────────────── */
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = u.full_name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q));
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const active = u.is_active ?? true;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" && active) || (statusFilter === "inactive" && !active);
    return matchSearch && matchRole && matchStatus;
  });

  /* ─── shared input style ─────────────────────── */
  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400 dark:placeholder:text-slate-500";
  const labelCls = "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {feedback && (
          <div className={`p-4 rounded-xl text-sm font-medium border animate-in fade-in duration-200 ${feedback.type === "success" ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]" : "bg-[var(--primary-soft)] border-[var(--danger)]/30 text-[var(--danger)]"}`}>
            {feedback.msg}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] shadow-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
              <input
                type="text"
                placeholder="Cari nama atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            {/* Status pills */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold border border-[var(--border)]">
              {(["active", "inactive", "all"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === s
                    ? s === "active" ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] font-bold border border-[var(--accent-teal)]/30"
                      : s === "inactive" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30"
                      : "bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}>
                  {s === "active" ? `Aktif (${users.filter(u => u.is_active ?? true).length})`
                   : s === "inactive" ? `Nonaktif (${users.filter(u => !(u.is_active ?? true)).length})`
                   : `Semua (${users.length})`}
                </button>
              ))}
            </div>
            {/* Role filter */}
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "all" | "employee" | "owner")}
              className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer font-medium">
              <option value="all">Semua Role</option>
              <option value="employee">Employee</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button onClick={() => { setShowAddModal(true); resetForm(); }}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Tambah User Baru
          </button>
        </div>

        {/* Table */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Daftar Pengguna Sistem</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Menampilkan {filteredUsers.length} dari {users.length} pengguna • Klik nama untuk lihat detail</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Memuat data pengguna...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Tidak ada pengguna yang cocok dengan filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    <th className="px-6 py-3">Nama Pengguna</th>
                    <th className="px-6 py-3">Email Login</th>
                    <th className="px-4 py-3">Kontak</th>
                    <th className="px-4 py-3">Rekening</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors group">
                      {/* Name */}
                      <td className="px-6 py-3.5">
                        <button onClick={() => setDetailUser(u)}
                          className="flex items-center gap-3 text-left cursor-pointer hover:opacity-80 transition-opacity">
                          <div className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-sm flex items-center justify-center shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">{u.full_name}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-mono">{u.id.slice(0, 8)}...</p>
                          </div>
                        </button>
                      </td>
                      {/* Email */}
                      <td className="px-6 py-3.5 text-xs text-[var(--text-primary)]">{u.email || "—"}</td>
                      {/* Phone */}
                      <td className="px-4 py-3.5">
                        {u.phone
                          ? <span className="inline-flex items-center gap-1 text-xs text-[var(--text-primary)]"><IconPhone />{u.phone}</span>
                          : <span className="text-[11px] text-[var(--text-secondary)] italic">Belum diisi</span>}
                      </td>
                      {/* Bank */}
                      <td className="px-4 py-3.5">
                        {u.bank_account_number
                          ? <div className="text-xs">
                              <p className="font-semibold text-[var(--text-primary)]">{u.bank_name || "—"}</p>
                              <p className="text-[10px] text-[var(--text-secondary)] font-mono">{u.bank_account_number}</p>
                            </div>
                          : <span className="text-[11px] text-[var(--text-secondary)] italic">Belum diisi</span>}
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === "owner" ? "bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/30" : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border border-[var(--border)]"}`}>
                          {u.role === "owner" ? "Owner" : "Employee"}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${(u.is_active ?? true) ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"}`}>
                          {(u.is_active ?? true) ? "● Aktif" : "○ Nonaktif"}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setDetailUser(u)} title="Lihat detail lengkap"
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </button>
                          <button onClick={() => openEditModal(u)} title="Edit data"
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer">
                            <IconEdit />
                          </button>
                          <button onClick={() => { setResetPasswordUser(u); setNewPassword(""); }} title="Reset password"
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer">
                            <IconKey />
                          </button>
                          <button onClick={() => toggleUserStatus(u)} title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-teal)] hover:bg-[var(--accent-teal-soft)] transition-colors cursor-pointer">
                            <IconToggle on={u.is_active ?? true} />
                          </button>
                          <button onClick={() => { setDeleteConfirmUser(u); setDeleteWarningMsg(null); }} title="Hapus permanen"
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer">
                            <IconTrash />
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DETAIL DRAWER ─ slide in from right                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {detailUser && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setDetailUser(null)}>
          {/* backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" />
          {/* panel */}
          <div
            className="w-full max-w-sm bg-[var(--bg-surface)] h-full overflow-y-auto shadow-2xl border-l border-[var(--border)] flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="relative bg-gradient-to-br from-[var(--primary)] to-teal-600 px-6 py-6 text-white shrink-0">
              <button onClick={() => setDetailUser(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors cursor-pointer">
                <IconX />
              </button>
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 text-white font-black text-2xl flex items-center justify-center mb-3 shadow-lg">
                {detailUser.full_name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-lg font-bold leading-tight">{detailUser.full_name}</h2>
              <p className="text-sm text-white/70 mt-0.5">{detailUser.email || "—"}</p>
              {/* badges */}
              <div className="flex gap-2 mt-3">
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                  {detailUser.role === "owner" ? "👑 Owner" : "👤 Employee"}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${(detailUser.is_active ?? true) ? "bg-emerald-400/30 text-white" : "bg-amber-400/30 text-white"}`}>
                  {(detailUser.is_active ?? true) ? "● Aktif" : "○ Nonaktif"}
                </span>
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 p-6 space-y-6">

              {/* Contact */}
              <section>
                <h3 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Info Kontak</h3>
                <div className="space-y-3">
                  <DetailRow icon={<IconMail />} label="Email Login" value={detailUser.email || "—"} />
                  <DetailRow icon={<IconPhone />} label="No. HP / WhatsApp"
                    value={detailUser.phone || undefined}
                    empty="Belum diisi" />
                  <DetailRow icon={<IconCalendar />} label="Bergabung"
                    value={detailUser.created_at ? new Date(detailUser.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
                </div>
              </section>

              <hr className="border-[var(--border)]" />

              {/* Bank */}
              <section>
                <h3 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Info Rekening Bank</h3>
                <div className="space-y-3">
                  <DetailRow icon={<IconBank />} label="Nama Bank"
                    value={detailUser.bank_name || undefined} empty="Belum diisi" />
                  <DetailRow icon={<IconBank />} label="No. Rekening"
                    value={detailUser.bank_account_number || undefined}
                    mono
                    empty="Belum diisi" />
                  <DetailRow icon={<IconUser />} label="Atas Nama"
                    value={detailUser.bank_account_holder || undefined}
                    empty="Belum diisi" />
                </div>
              </section>

              <hr className="border-[var(--border)]" />

              {/* System Info */}
              <section>
                <h3 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Info Sistem</h3>
                <div className="space-y-3">
                  <DetailRow icon={<IconUser />} label="User ID" value={detailUser.id} mono small />
                </div>
              </section>
            </div>

            {/* Drawer footer actions */}
            <div className="shrink-0 p-4 border-t border-[var(--border)] bg-[var(--bg-surface)] grid grid-cols-2 gap-2">
              <button onClick={() => openEditModal(detailUser)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-colors cursor-pointer">
                <IconEdit /> Edit Data
              </button>
              <button onClick={() => { setResetPasswordUser(detailUser); setDetailUser(null); setNewPassword(""); }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 text-xs font-bold transition-colors cursor-pointer">
                <IconKey /> Reset PW
              </button>
              <button onClick={() => toggleUserStatus(detailUser)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                  (detailUser.is_active ?? true)
                    ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                    : "border-[var(--accent-teal)]/30 text-[var(--accent-teal)] hover:bg-[var(--accent-teal-soft)]"}`}>
                {(detailUser.is_active ?? true) ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button onClick={() => { setDeleteConfirmUser(detailUser); setDeleteWarningMsg(null); setDetailUser(null); }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--primary-soft)] text-xs font-bold transition-colors cursor-pointer">
                <IconTrash /> Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ADD / EDIT MODAL                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
          onClick={() => { setShowAddModal(false); setEditingUser(null); }}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 text-white shrink-0">
              <h3 className="text-base font-bold">{editingUser ? "✏️ Edit Data Pengguna" : "+ Tambah Pengguna Baru"}</h3>
              <p className="text-xs text-teal-200 mt-0.5">
                {editingUser ? `Mengubah akun ${editingUser.full_name}` : "Isi data lengkap karyawan baru"}
              </p>
            </div>

            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
              className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* ── Basic Info ── */}
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Informasi Dasar</p>

              <div>
                <label className={labelCls}>Nama Lengkap *</label>
                <input type="text" required placeholder="Contoh: Budi Santoso" value={fullName}
                  onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Email Login *</label>
                <input type="email" required placeholder="Contoh: budi@annotracker.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} disabled={!!editingUser}
                  className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`} />
              </div>

              {!editingUser && (
                <div>
                  <label className={labelCls}>Password Awal *</label>
                  <input type="password" required minLength={6} placeholder="Minimal 6 karakter" value={password}
                    onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">Password ini digunakan karyawan pertama kali masuk.</p>
                </div>
              )}

              <div>
                <label className={labelCls}>Role Pengguna *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "employee" | "owner")}
                  className={`${inputCls} cursor-pointer`}>
                  <option value="employee">Employee (Karyawan Anotasi)</option>
                  <option value="owner">Owner (Admin / Pemilik)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="isActiveCheck" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer" />
                <label htmlFor="isActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Akun Aktif (Dapat mencatat pekerjaan &amp; masuk sistem)
                </label>
              </div>

              {/* ── Contact & Bank ── */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Kontak &amp; Rekening Bank <span className="normal-case font-normal text-slate-400">(opsional)</span></p>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>No. HP / WhatsApp</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><IconPhone /></span>
                      <input type="tel" placeholder="Contoh: 081234567890" value={phone}
                        onChange={(e) => setPhone(e.target.value)} className={`${inputCls} pl-10`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Nama Bank</label>
                      <input type="text" placeholder="BCA, BRI, Mandiri..." value={bankName}
                        onChange={(e) => setBankName(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>No. Rekening</label>
                      <input type="text" placeholder="1234567890" value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)} className={`${inputCls} font-mono`} />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Nama Pemilik Rekening</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><IconUser /></span>
                      <input type="text" placeholder="Sesuai buku tabungan" value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)} className={`${inputCls} pl-10`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingUser(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer">
                  {isSubmitting ? "Memproses..." : editingUser ? "Simpan Perubahan" : "+ Buat User Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* RESET PASSWORD MODAL                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setResetPasswordUser(null)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 text-white">
              <h3 className="text-base font-bold">🔑 Reset Password Karyawan</h3>
              <p className="text-xs text-amber-100 mt-0.5">Akun: {resetPasswordUser.full_name}</p>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Password Baru *</label>
                <input type="password" required minLength={6} placeholder="Ketik password baru (minimal 6 karakter)" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setResetPasswordUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50 cursor-pointer">
                  {isSubmitting ? "Menyimpan..." : "✓ Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DELETE MODAL                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setDeleteConfirmUser(null)}>
          <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--primary)] px-6 py-5 text-white">
              <h3 className="text-base font-bold">🗑️ Konfirmasi Hapus Pengguna</h3>
              <p className="text-xs text-white/90 mt-0.5">{deleteConfirmUser.full_name}</p>
            </div>
            <div className="p-6 space-y-4">
              {deleteWarningMsg ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs space-y-3">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">⚠️ Proteksi Riwayat Sesi & Payroll:</p>
                  <p>{deleteWarningMsg}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Pilih <strong>Nonaktifkan</strong> untuk arsipkan akun, atau <strong>Tetap Hapus</strong> jika ini akun dummy.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button type="button" onClick={() => { toggleUserStatus(deleteConfirmUser); setDeleteConfirmUser(null); }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">
                      🔒 Nonaktifkan Akun Ini (Rekomendasi Aman)
                    </button>
                    <button type="button" onClick={() => handleDeleteUser(deleteConfirmUser, true)} disabled={isDeleting}
                      className="w-full py-2 bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                      {isDeleting ? "Menghapus..." : "🔥 Tetap Hapus Permanen"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun <span className="font-bold">{deleteConfirmUser.full_name}</span> secara permanen? Akun tanpa riwayat sesi akan langsung dihapus dari sistem.
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setDeleteConfirmUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] text-xs font-semibold transition-colors cursor-pointer">
                  Batal
                </button>
                {!deleteWarningMsg && (
                  <button type="button" onClick={() => handleDeleteUser(deleteConfirmUser)} disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer">
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

/* ─── Detail Row helper component ─────────────────────────────────────────── */
function DetailRow({
  icon, label, value, empty = "—", mono = false, small = false
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  empty?: string;
  mono?: boolean;
  small?: boolean;
}) {
  const hasValue = value && value !== "—";
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-[var(--text-secondary)] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[var(--text-secondary)] font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className={`${small ? "text-[11px]" : "text-sm"} font-semibold break-all ${hasValue ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] italic font-normal"} ${mono ? "font-mono" : ""}`}>
          {hasValue ? value : empty}
        </p>
      </div>
    </div>
  );
}
