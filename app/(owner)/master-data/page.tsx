"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MasterDataTable, type MasterDataItem } from "@/components/shared/MasterDataTable";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ROUTES } from "@/constants";

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<"task_types" | "client_accounts">("task_types");
  const [taskTypes, setTaskTypes] = useState<MasterDataItem[]>([]);
  const [clientAccounts, setClientAccounts] = useState<MasterDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const [taskRes, accountRes] = await Promise.all([
        supabase.from("task_types").select("*").order("name"),
        supabase.from("client_accounts").select("*").order("name"),
      ]);

      if (taskRes.data) setTaskTypes(taskRes.data);
      if (accountRes.data) setClientAccounts(accountRes.data);
    } catch {
      // Fallback state if offline
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddTaskType = async (name: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("task_types").insert({ name, is_active: true }).select().single();
    if (data) {
      setTaskTypes((prev) => [...prev, data]);
    }
  };

  const handleToggleTaskTypeStatus = async (id: string, currentStatus: boolean) => {
    const supabase = createClient();
    await supabase.from("task_types").update({ is_active: !currentStatus }).eq("id", id);
    setTaskTypes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_active: !currentStatus } : item))
    );
  };

  const handleEditTaskType = async (id: string, newName: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("task_types").update({ name: newName }).eq("id", id);
    if (error) throw error;
    setTaskTypes((prev) => prev.map((t) => (t.id === id ? { ...t, name: newName } : t)));
  };

  const handleDeleteTaskType = async (id: string, force = false) => {
    const supabase = createClient();
    if (!force) {
      // Check if used in task_entries
      const { count, error: countErr } = await supabase
        .from("task_entries")
        .select("id", { count: "exact", head: true })
        .eq("task_type_id", id);

      if (countErr) {
        console.error("Error checking task_entries:", countErr.message);
      }

      if ((count || 0) > 0) {
        return {
          success: false,
          hasHistory: true,
          error: "Jenis Task ini pernah digunakan dalam catatan pengerjaan sesi harian.",
        };
      }
    } else {
      // Force delete: clean up references in task_entries first
      await supabase.from("task_entries").delete().eq("task_type_id", id);
    }

    const { error: delErr } = await supabase.from("task_types").delete().eq("id", id);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    setTaskTypes((prev) => prev.filter((t) => t.id !== id));
    return { success: true };
  };

  const handleAddClientAccount = async (name: string, language?: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("client_accounts")
      .insert({ name, language: language || null, is_active: true })
      .select()
      .single();
    if (data) {
      setClientAccounts((prev) => [...prev, data]);
    }
  };

  const handleToggleClientAccountStatus = async (id: string, currentStatus: boolean) => {
    const supabase = createClient();
    await supabase.from("client_accounts").update({ is_active: !currentStatus }).eq("id", id);
    setClientAccounts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_active: !currentStatus } : item))
    );
  };

  const handleEditClientAccount = async (id: string, newName: string, newLanguage?: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("client_accounts")
      .update({ name: newName, language: newLanguage || null })
      .eq("id", id);
    if (error) throw error;
    setClientAccounts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName, language: newLanguage || null } : c))
    );
  };

  const handleDeleteClientAccount = async (id: string, force = false) => {
    const supabase = createClient();
    if (!force) {
      // Check if used in task_entries
      const { count, error: countErr } = await supabase
        .from("task_entries")
        .select("id", { count: "exact", head: true })
        .eq("client_account_id", id);

      if (countErr) {
        console.error("Error checking task_entries:", countErr.message);
      }

      if ((count || 0) > 0) {
        return {
          success: false,
          hasHistory: true,
          error: "Nama Akun Klien ini pernah digunakan dalam catatan pengerjaan sesi harian.",
        };
      }
    } else {
      // Force delete: clean up references in task_entries first
      await supabase.from("task_entries").delete().eq("client_account_id", id);
    }

    const { error: delErr } = await supabase.from("client_accounts").delete().eq("id", id);
    if (delErr) {
      return { success: false, error: delErr.message };
    }

    setClientAccounts((prev) => prev.filter((c) => c.id !== id));
    return { success: true };
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-12 transition-colors duration-200">
      {/* Top Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4 sticky top-0 z-10 transition-colors shadow-2xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Master Data AnnoTracker</h1>
            <p className="text-xs text-[var(--text-secondary)]">Kelola Master Data Jenis Task & Nama Akun Klien</p>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold overflow-x-auto border border-[var(--border)]">
              <Link href={ROUTES.OWNER_DASHBOARD} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
              <Link href={ROUTES.OWNER_PAYROLL} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Payroll</Link>
              <Link href={ROUTES.OWNER_MASTER_DATA} className="px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30">Master Data</Link>
              <Link href={ROUTES.OWNER_USERS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">User</Link>
              <Link href={ROUTES.OWNER_ASSESSMENT} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Assessment</Link>
              <Link href={ROUTES.OWNER_SETTINGS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Settings</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
        {/* Tab Selector */}
        <div className="flex border-b border-[var(--border)] gap-6">
          <button
            onClick={() => setActiveTab("task_types")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "task_types"
                ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Jenis Task ({taskTypes.length})
          </button>

          <button
            onClick={() => setActiveTab("client_accounts")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "client_accounts"
                ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Nama Akun / Klien ({clientAccounts.length})
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[var(--text-secondary)]">Memuat data...</div>
        ) : activeTab === "task_types" ? (
          <MasterDataTable
            title="Daftar Jenis Task"
            description="Jenis pekerjaan yang dapat dipilih oleh karyawan saat mencatat sesi harian."
            items={taskTypes}
            onAddItem={handleAddTaskType}
            onToggleStatus={handleToggleTaskTypeStatus}
            onEditItem={handleEditTaskType}
            onDeleteItem={handleDeleteTaskType}
          />
        ) : (
          <MasterDataTable
            title="Daftar Nama Akun Klien"
            description="Daftar nama akun klien yang sedang dikerjakan oleh tim anotasi."
            items={clientAccounts}
            hasLanguageColumn={true}
            onAddItem={handleAddClientAccount}
            onToggleStatus={handleToggleClientAccountStatus}
            onEditItem={handleEditClientAccount}
            onDeleteItem={handleDeleteClientAccount}
          />
        )}
      </main>
    </div>
  );
}
