"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ROUTES } from "@/constants";

interface AssessmentTask {
  id: string;
  title: string;
  task_type: string;
  description: string;
  status: "active" | "draft" | "closed";
  created_at: string;
  assessment_items: { id: string }[];
}

interface Submission {
  id: string;
  user_id: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  score: number | null;
  justification_id: string | null;
  justification_en: string | null;
  answers: Record<string, unknown>;
  users: { full_name: string; role: string };
}

const STATUS_BADGES = {
  active: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  draft: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  closed: "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700",
};

const MIGRATION_SQL = `-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.assessment_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'closed')),
  form_template JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.assessment_tasks(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  user_request TEXT NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.assessment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.assessment_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  justification_id TEXT,
  justification_en TEXT,
  score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
ALTER TABLE public.assessment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_tasks' AND policyname = 'Anyone auth can read tasks') THEN
    CREATE POLICY "Anyone auth can read tasks" ON public.assessment_tasks FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_tasks' AND policyname = 'Owners manage tasks') THEN
    CREATE POLICY "Owners manage tasks" ON public.assessment_tasks FOR ALL USING (public.is_owner());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_items' AND policyname = 'Anyone auth can read items') THEN
    CREATE POLICY "Anyone auth can read items" ON public.assessment_items FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_items' AND policyname = 'Owners manage items') THEN
    CREATE POLICY "Owners manage items" ON public.assessment_items FOR ALL USING (public.is_owner());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_submissions' AND policyname = 'Users manage own submissions') THEN
    CREATE POLICY "Users manage own submissions" ON public.assessment_submissions FOR ALL USING (auth.uid() = user_id OR public.is_owner());
  END IF;
END $$;`;

export default function OwnerAssessmentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState<AssessmentTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AssessmentTask | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesMissing, setTablesMissing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(ROUTES.LOGIN); return; }
      supabase.from("users").select("role").eq("id", data.user.id).single()
        .then(({ data: u }) => { if (u?.role !== "owner") router.replace(ROUTES.OWNER_DASHBOARD); });
    });
  }, [router, supabase]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_tasks" }),
    });
    const data = await res.json();
    if (data.tables_missing) { setTablesMissing(true); setLoading(false); return; }
    if (data.tasks) setTasks(data.tasks);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const loadDetail = async (task: AssessmentTask) => {
    setSelectedTask(task);
    const res = await fetch("/api/admin/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_task", taskId: task.id }),
    });
    const data = await res.json();
    if (data.submissions) setSubmissions(data.submissions);
  };

  const handleSeedPR = async () => {
    setSeeding(true);
    const res = await fetch("/api/admin/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_pr_task" }),
    });
    const data = await res.json();
    setSeeding(false);
    if (data.success) { await fetchTasks(); alert("✅ PR Assessment task berhasil dibuat!"); }
    else if (data.requiresManual) { setShowSql(true); }
    else { alert("❌ " + data.error); }
  };

  const handleSeedVCG = async () => {
    setSeeding(true);
    const res = await fetch("/api/admin/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_vcg_task" }),
    });
    const data = await res.json();
    setSeeding(false);
    if (data.success) { await fetchTasks(); alert("✅ VCG Assessment task berhasil dibuat!"); }
    else if (data.requiresManual) { setShowSql(true); }
    else { alert("❌ " + data.error); }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const jsonContent = JSON.parse(evt.target?.result as string);
        setSeeding(true);
        const res = await fetch("/api/admin/assessment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import_json_task", ...jsonContent }),
        });
        const data = await res.json();
        setSeeding(false);
        if (data.success) {
          await fetchTasks();
          alert("✅ Task baru berhasil di-import dari file JSON!");
        } else {
          alert("❌ Gagal import JSON: " + data.error);
        }
      } catch (err: unknown) {
        setSeeding(false);
        const msg = err instanceof Error ? err.message : "File JSON tidak valid";
        alert("❌ Error membaca file JSON: " + msg);
      }
    };
    reader.readAsText(file);
  };

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft_closed">("all");
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<AssessmentTask | null>(null);
  const [deleteTaskWarning, setDeleteTaskWarning] = useState<string | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const toggleStatus = async (task: AssessmentTask, newStatus: "active" | "draft" | "closed") => {
    await supabase.from("assessment_tasks").update({ status: newStatus }).eq("id", task.id);
    await fetchTasks();
    if (selectedTask?.id === task.id) setSelectedTask({ ...selectedTask, status: newStatus });
  };

  const handleDeleteTask = async (taskToDelete: AssessmentTask) => {
    setIsDeletingTask(true);
    setDeleteTaskWarning(null);
    try {
      // Check if task has submissions in assessment_submissions
      const { count, error: countErr } = await supabase
        .from("assessment_submissions")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskToDelete.id);

      if (countErr) {
        console.error("Error checking submissions:", countErr.message);
      }

      if ((count || 0) > 0) {
        setDeleteTaskWarning(`Task ini sudah dikerjakan oleh ${count} karyawan. Untuk menjaga riwayat penilaian, disarankan untuk mengubah status menjadi 'closed' saja.`);
        return;
      }

      // Hard delete task
      const { error: delErr } = await supabase
        .from("assessment_tasks")
        .delete()
        .eq("id", taskToDelete.id);

      if (delErr) {
        alert("Gagal menghapus task: " + delErr.message);
        return;
      }

      if (selectedTask?.id === taskToDelete.id) {
        setSelectedTask(null);
        setSubmissions([]);
      }

      setDeleteTaskConfirm(null);
      await fetchTasks();
      alert("✅ Task assessment berhasil dihapus permanen.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus task";
      alert("❌ Error: " + msg);
    } finally {
      setIsDeletingTask(false);
    }
  };

  const copySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Top title & actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Daftar Assessment Anotator</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Buat dan pantau hasil pengerjaan assessment kualifikasi tim anotasi
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center gap-1.5">
              <span>📤 Import Task (JSON)</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
            <button
              id="btn-seed-vcg"
              onClick={handleSeedVCG}
              disabled={seeding}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {seeding ? "⏳ Memuat..." : "⚡ Seed VCG Task"}
            </button>
            <button
              id="btn-seed-pr"
              onClick={handleSeedPR}
              disabled={seeding}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {seeding ? "⏳ Memuat..." : "⚡ Seed PR Task"}
            </button>
          </div>
        </div>

        {/* Database setup notice if needed */}
        {tablesMissing && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-6 space-y-3 text-xs">
            <div className="font-bold text-amber-700 dark:text-amber-400 text-sm">⚠️ Database Assessment Belum Siap</div>
            <p className="text-amber-800 dark:text-amber-300">
              Tabel assessment belum ada di Supabase. Silakan jalankan SQL Migration berikut di Supabase SQL Editor.
            </p>
            <div className="flex gap-2 pt-1">
              <a
                href="https://supabase.com/dashboard/project/gdqpfxbowtebkghfkpxn/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors"
              >
                🔗 Buka Supabase SQL Editor
              </a>
              <button
                onClick={() => setShowSql(!showSql)}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold rounded-xl"
              >
                {showSql ? "Sembunyikan SQL" : "Tampilkan SQL"}
              </button>
            </div>
            {showSql && (
              <div className="relative pt-2">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-auto max-h-60 leading-relaxed">
                  {MIGRATION_SQL}
                </pre>
                <button
                  onClick={copySql}
                  className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-slate-700 text-white text-[11px] font-bold"
                >
                  {copiedSql ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content list & detail grid */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <div className="text-2xl mb-2 animate-bounce">⏳</div>
            Memuat data assessment...
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${selectedTask ? "lg:grid-cols-12" : ""} gap-6 items-start`}>

            {/* Task Cards List */}
            <div className={selectedTask ? "lg:col-span-4 space-y-3" : "space-y-3"}>
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Assessment Available ({tasks.length})
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-[10px] font-semibold border border-[var(--border)]">
                  <button
                    onClick={() => setStatusFilter("active")}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      statusFilter === "active"
                        ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] font-bold border border-[var(--accent-teal)]/30"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Aktif ({tasks.filter(t => t.status === "active").length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("draft_closed")}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      statusFilter === "draft_closed"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Draft/Closed ({tasks.filter(t => t.status !== "active").length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      statusFilter === "all"
                        ? "bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Semua ({tasks.length})
                  </button>
                </div>
              </div>

              {tasks.length === 0 && (
                <div className="bg-[var(--bg-surface)] rounded-3xl p-10 border border-[var(--border)] text-center space-y-3">
                  <div className="text-4xl">🧪</div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Belum Ada Assessment</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Klik tombol <strong>⚡ Seed VCG Task</strong> di kanan atas untuk membuat tes VCG.
                  </p>
                </div>
              )}

              {tasks
                .filter((t) => {
                  if (statusFilter === "active") return t.status === "active";
                  if (statusFilter === "draft_closed") return t.status !== "active";
                  return true;
                })
                .map((task) => {
                  const badgeClass = STATUS_BADGES[task.status];
                  const isSelected = selectedTask?.id === task.id;
                  return (
                    <div
                      key={task.id}
                      onClick={() => loadDetail(task)}
                      className={`bg-[var(--bg-surface)] rounded-3xl p-5 border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? "border-[var(--accent-teal)] shadow-md ring-2 ring-[var(--accent-teal)]/20"
                          : "border-[var(--border)] shadow-xs hover:border-[var(--text-secondary)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30">
                              {task.task_type}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                              {task.status.toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                            {task.title}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                            {task.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[var(--text-secondary)] font-medium">📋 {task.assessment_items?.length || 0} Soal</span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-1">
                            {(["active", "draft", "closed"] as const).map((s) => (
                              <button
                                key={s}
                                onClick={() => toggleStatus(task, s)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                                  task.status === s
                                    ? STATUS_BADGES[s]
                                    : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              setDeleteTaskConfirm(task);
                              setDeleteTaskWarning(null);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-[var(--danger)] hover:bg-[var(--primary-soft)] border border-[var(--danger)]/30 transition-colors cursor-pointer"
                            title="Hapus permanen task ini"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Selected Task Detail */}
            {selectedTask && (
              <div className="lg:col-span-8 space-y-5">
                {/* Header detail */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700/60 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/50">
                        {selectedTask.task_type} Task
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {selectedTask.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => { setSelectedTask(null); setSubmissions([]); }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      ✕ Tutup Detail
                    </button>
                  </div>

                  {/* Summary KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-center">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{selectedTask.assessment_items?.length || 0}</div>
                      <div className="text-[11px] text-slate-400 font-semibold">Total Soal</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-center">
                      <div className="text-lg font-bold text-teal-600 dark:text-teal-400">{submissions.length}</div>
                      <div className="text-[11px] text-slate-400 font-semibold">Pengisian</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-center">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {submissions.filter((s) => s.status === "submitted").length}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold">Selesai</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 text-center">
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {submissions.filter((s) => s.status === "draft").length}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold">Draft</div>
                    </div>
                  </div>
                </div>

                {/* Submissions List */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Hasil Pengerjaan Karyawan
                    </h4>
                    <span className="text-[11px] text-slate-400">Klik nama untuk melihat jawaban</span>
                  </div>

                  {submissions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                      <div className="text-2xl">📭</div>
                      <p>Belum ada karyawan yang mengerjakan assessment ini.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {submissions.map((sub) => (
                        <div key={sub.id}>
                          <div
                            onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                            className={`p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              expandedSub === sub.id ? "bg-slate-50 dark:bg-slate-700/30" : "hover:bg-slate-50 dark:hover:bg-slate-700/20"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {(sub.users?.full_name || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white">
                                  {sub.users?.full_name || "Karyawan"}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {sub.submitted_at
                                    ? `Selesai: ${new Date(sub.submitted_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                                    : "Status: Masih Draft"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                                  sub.status === "submitted"
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {sub.status === "submitted" ? "✅ Completed" : "⏳ Draft"}
                              </span>
                              <span className="text-slate-400 text-xs">{expandedSub === sub.id ? "▲" : "▼"}</span>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {expandedSub === sub.id && (
                            <div className="p-5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-700/60 space-y-4">
                              {/* Justification */}
                              {(sub.justification_id || sub.justification_en) && (
                                <div className="space-y-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                    ✍️ Justifikasi Rangkuman
                                  </div>
                                  {sub.justification_id && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-400 font-semibold">🇮🇩 Bahasa Indonesia</span>
                                      <p className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                                        {sub.justification_id}
                                      </p>
                                    </div>
                                  )}
                                  {sub.justification_en && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-400 font-semibold">🇬🇧 English</span>
                                      <p className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                                        {sub.justification_en}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Answers */}
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                                  📊 Jawaban Per Question & Response
                                </div>
                                {sub.answers &&
                                  Object.entries(sub.answers).map(([itemId, itemAns]) => (
                                    <div
                                      key={itemId}
                                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                                    >
                                      <div className="font-bold text-slate-900 dark:text-white">
                                        Item ID: {itemId.slice(0, 8)}...
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                        {Object.entries(itemAns as Record<string, Record<string, unknown>>).map(
                                          ([respLabel, qAns]) => {
                                            const isCompare = respLabel === "comparison";
                                            return (
                                              <div
                                                key={respLabel}
                                                className={`p-2.5 rounded-xl border space-y-1 ${
                                                  isCompare
                                                    ? "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60"
                                                    : "bg-slate-50 dark:bg-slate-700/40 border-slate-100 dark:border-slate-700"
                                                }`}
                                              >
                                                <span className={`font-bold text-[11px] ${isCompare ? "text-purple-700 dark:text-purple-300" : "text-teal-600 dark:text-teal-400"}`}>
                                                  {isCompare ? "⚡ Pairwise Comparison" : `Response ${respLabel}`}
                                                </span>
                                                {Object.entries(qAns).map(([qId, ans]) => (
                                                  <div key={qId} className="text-[11px] text-slate-600 dark:text-slate-300">
                                                    <span className="font-semibold text-slate-400">{qId}:</span>{" "}
                                                    <span className="font-medium text-slate-800 dark:text-slate-100">
                                                      {typeof ans === "object" ? JSON.stringify(ans) : String(ans)}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      {deleteTaskConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeleteTaskConfirm(null)}>
          <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--primary)] px-6 py-5 text-white">
              <h3 className="text-base font-bold">🗑️ Konfirmasi Hapus Task Assessment</h3>
              <p className="text-xs text-white/90 mt-0.5">{deleteTaskConfirm.title}</p>
            </div>

            <div className="p-6 space-y-4">
              {deleteTaskWarning ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️ Proteksi Riwayat Assessment:</span>
                  </p>
                  <p>{deleteTaskWarning}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        toggleStatus(deleteTaskConfirm, "closed");
                        setDeleteTaskConfirm(null);
                      }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      🔒 Ubah Status ke Closed / Arsip (Aman)
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  Apakah Anda yakin ingin menghapus task assessment <span className="font-bold">&quot;{deleteTaskConfirm.title}&quot;</span> secara permanen? Task yang belum memiliki pengerjaan akan dihapus bersih beserta item pertanyaannya.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTaskConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                {!deleteTaskWarning && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(deleteTaskConfirm)}
                    disabled={isDeletingTask}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isDeletingTask ? "Hapus..." : "🗑️ Ya, Hapus Permanen"}
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
