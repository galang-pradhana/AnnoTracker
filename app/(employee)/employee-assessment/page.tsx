"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";

interface AssessmentTask {
  id: string;
  title: string;
  task_type: string;
  description: string;
  status: "active" | "draft" | "closed";
  created_at: string;
  assessment_items: { id: string }[];
  mySubmission?: { status: "draft" | "submitted"; submitted_at: string | null; score: number | null };
}

export default function EmployeeAssessmentListPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState<AssessmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(ROUTES.LOGIN); return; }
      supabase.from("users").select("role, id").eq("id", data.user.id).single()
        .then(({ data: u }) => {
          if (!u) { router.replace(ROUTES.LOGIN); return; }
          setUserId(data.user.id);
        });
    });
  }, [router, supabase]);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: taskData, error } = await supabase
        .from("assessment_tasks")
        .select("*, assessment_items(id)")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error?.code === "PGRST205" || error) { setTasks([]); setLoading(false); return; }

      // Fetch submissions for this user
      const { data: subs } = await supabase
        .from("assessment_submissions")
        .select("task_id, status, submitted_at, score")
        .eq("user_id", userId);

      const subMap = new Map((subs || []).map(s => [s.task_id, s]));
      const mapped = (taskData || []).map(t => ({
        ...t,
        mySubmission: subMap.get(t.id) || undefined,
      }));
      setTasks(mapped);
    } catch {
      setTasks([]);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => { if (userId) fetchTasks(); }, [userId, fetchTasks]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16 transition-colors duration-200">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AppLogo variant="icon" size="sm" />
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)] leading-tight">Assessment</h1>
              <p className="text-[11px] text-[var(--text-secondary)]">Tes kualifikasi anotator</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={ROUTES.EMPLOYEE_WORK_SESSION} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              ✏️ Catat Kerja
            </Link>
            <Link href={ROUTES.EMPLOYEE_HISTORY} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              📅 Riwayat
            </Link>
            <Link href={ROUTES.EMPLOYEE_ASSESSMENT} className="text-xs text-[var(--primary)] bg-[var(--primary-soft)] font-bold px-2.5 py-1 rounded-lg transition-colors">
              🧪 Assessment
            </Link>
            <Link href={ROUTES.EMPLOYEE_SOURCE} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              📂 Source
            </Link>
            <Link href={ROUTES.EMPLOYEE_PROFILE} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              👤 Profil
            </Link>
            <ThemeToggle />
            <button onClick={handleLogout} className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] font-medium px-1.5 py-1 transition-colors cursor-pointer">
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        {/* Banner Card */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-6 text-[var(--text-primary)] shadow-xs flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] px-2.5 py-0.5 rounded-md border border-[var(--primary)]/20">
              🧪 Kualifikasi Anotator
            </span>
            <h2 className="text-xl font-bold mt-2 leading-tight">Daftar Assessment Anotasi</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
              Selesaikan tes kualifikasi awal berikut sebelum memulai pengerjaan task anotasi data.
            </p>
          </div>
          <div className="text-4xl hidden sm:block shrink-0 opacity-90">📋</div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
            <div className="text-2xl mb-2 animate-bounce">⏳</div>
            Memuat daftar assessment...
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-10 text-center space-y-3 shadow-xs">
            <div className="text-4xl">📭</div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Belum Ada Assessment</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Saat ini belum ada assessment aktif yang perlu dikerjakan. Owner akan menambahkan assessment baru segera.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const sub = task.mySubmission;
              const done = sub?.status === "submitted";
              const inProgress = sub?.status === "draft";
              return (
                <div
                  key={task.id}
                  className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs hover:border-[var(--primary)]/50 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20">
                          Task {task.task_type}
                        </span>
                        {done && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30">
                            ✅ Selesai
                          </span>
                        )}
                        {inProgress && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--warning)] border border-[var(--warning)]/30">
                            ⏳ Lanjutkan Draft
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug">
                        {task.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                      <div className="pt-1 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                        <span>📋 <strong>{task.assessment_items?.length || 0}</strong> Soal Evaluasi</span>
                        {done && sub?.submitted_at && (
                          <span>🗓 Selesai: {new Date(sub.submitted_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 pt-2 sm:pt-0">
                      {done ? (
                        <Link
                          href={`/employee-assessment/${task.id}`}
                          className="inline-block px-5 py-2.5 rounded-xl border border-[var(--accent-teal)]/40 bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] text-xs font-bold hover:brightness-95 transition-colors"
                        >
                          Lihat Jawaban
                        </Link>
                      ) : (
                        <Link
                          href={`/employee-assessment/${task.id}`}
                          className="inline-block px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          {inProgress ? "▶ Lanjutkan Assessment" : "Mulai Assessment"}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
