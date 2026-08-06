"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDecimalHours } from "@/lib/utils";
import { ROUTES } from "@/constants";
import type { WorkSessionWithEntries } from "@/types";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

interface DayData {
  totalSeconds: number;
  employeeCount: number;
  sessions: WorkSessionWithEntries[];
}

export default function OwnerCalendarPage() {
  const router = useRouter();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<WorkSessionWithEntries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDayData, setSelectedDayData] = useState<{ date: string; data: DayData } | null>(null);

  const fetchData = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(ROUTES.LOGIN); return; }

      const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = getDaysInMonth(year, month);
      const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data } = await supabase
        .from("work_sessions")
        .select("*, user:users(*), task_entries(*, client_account:client_accounts(*), task_type:task_types(*))")
        .gte("session_date", periodStart)
        .lte("session_date", periodEnd)
        .order("session_date", { ascending: true });

      if (data) setSessions(data as unknown as WorkSessionWithEntries[]);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData(viewYear, viewMonth);
  }, [fetchData, viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    if (nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMonth > today.getMonth())) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build per-day aggregation map
  const dayMap = new Map<string, DayData>();
  sessions.forEach(s => {
    const secs = s.task_entries.reduce((sum, e) => sum + e.duration_seconds, 0);
    const existing = dayMap.get(s.session_date);
    if (existing) {
      existing.totalSeconds += secs;
      existing.employeeCount += 1;
      existing.sessions.push(s);
    } else {
      dayMap.set(s.session_date, { totalSeconds: secs, employeeCount: 1, sessions: [s] });
    }
  });

  // Monthly summary
  let totalMonthSeconds = 0;
  dayMap.forEach(d => { totalMonthSeconds += d.totalSeconds; });
  const totalMonthHours = totalMonthSeconds / 3600;
  const activeDays = dayMap.size;

  // Build calendar
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOffset = getFirstDayOfMonth(viewYear, viewMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const isFutureDisabled = viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth >= today.getMonth());

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  // Determine intensity color based on total hours that day
  function getDayColor(hours: number): string {
    if (hours === 0) return "";
    if (hours < 4) return "bg-teal-100 text-teal-800";
    if (hours < 8) return "bg-teal-200 text-teal-900";
    if (hours < 16) return "bg-teal-400 text-white";
    return "bg-teal-600 text-white";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">📅 Kalender Tim</h1>
            <p className="text-xs text-slate-500">Rekap jam kerja seluruh karyawan per hari</p>
          </div>
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <span className="px-3 py-1.5 rounded-lg bg-white text-slate-900 shadow-sm">Kalender</span>
            <Link href={ROUTES.OWNER_DASHBOARD} className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
            <Link href={ROUTES.OWNER_PAYROLL} className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900">
              Payroll
            </Link>
            <Link href={ROUTES.OWNER_MASTER_DATA} className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900">
              Master Data
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-red-500 hover:text-red-700"
            >
              Keluar
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-6 space-y-5">
        {/* Monthly Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Jam Tim</p>
            <p className="text-3xl font-bold text-teal-700 mt-1">{formatDecimalHours(totalMonthHours)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{MONTH_NAMES[viewMonth]} {viewYear}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hari Aktif</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{activeDays}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">hari ada yang input</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rata-rata/Hari Aktif</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {activeDays > 0 ? formatDecimalHours(totalMonthHours / activeDays) : "0j"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">per hari kerja</p>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <button
              onClick={handlePrevMonth}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600 transition-colors font-bold"
            >
              ←
            </button>
            <div className="text-center">
              <h2 className="text-base font-bold text-slate-900">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
            </div>
            <button
              onClick={handleNextMonth}
              disabled={isFutureDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600 transition-colors font-bold disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2.5">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">Memuat data kalender...</div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-20 border-b border-r border-slate-50" />;
                }

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayData = dayMap.get(dateStr);
                const dayHours = dayData ? dayData.totalSeconds / 3600 : 0;
                const isToday = isCurrentMonth && day === today.getDate();
                const isFuture = isCurrentMonth && day > today.getDate();
                const hasData = !!dayData && dayData.totalSeconds > 0;
                const colorClass = getDayColor(dayHours);

                return (
                  <button
                    key={dateStr}
                    onClick={() => hasData && setSelectedDayData({ date: dateStr, data: dayData! })}
                    disabled={!hasData}
                    className={`
                      h-20 flex flex-col items-center justify-center border-b border-r border-slate-50 transition-all relative gap-1
                      ${hasData ? "cursor-pointer hover:scale-95 hover:rounded-xl hover:z-10" : "cursor-default"}
                      ${hasData ? colorClass : ""}
                      ${isToday && !hasData ? "bg-slate-50" : ""}
                    `}
                  >
                    <span className={`text-xs font-bold ${
                      isToday ? "w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-[11px] mx-auto" :
                      isFuture ? "text-slate-300" :
                      hasData ? "opacity-90" : "text-slate-400"
                    }`}>
                      {day}
                    </span>
                    {hasData && (
                      <>
                        <span className="text-[11px] font-bold leading-none">
                          {formatDecimalHours(dayHours)}
                        </span>
                        <span className="text-[10px] opacity-75 leading-none">
                          {dayData!.employeeCount} orang
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Intensity Legend */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
          <span>Intensitas jam:</span>
          {["bg-teal-100", "bg-teal-200", "bg-teal-400", "bg-teal-600"].map((cls, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className={`w-3.5 h-3.5 rounded ${cls} inline-block`} />
              {["< 4j", "4–8j", "8–16j", "16j+"][i]}
            </span>
          ))}
        </div>
      </main>

      {/* Day Detail Modal */}
      {selectedDayData && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedDayData(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {new Date(selectedDayData.date + "T00:00:00").toLocaleDateString("id-ID", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-bold text-teal-600">{formatDecimalHours(selectedDayData.data.totalSeconds / 3600)}</span>
                  {" total · "}
                  {selectedDayData.data.employeeCount} karyawan aktif
                </p>
              </div>
              <button
                onClick={() => setSelectedDayData(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-xs shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Per-employee breakdown */}
            <div className="space-y-3">
              {selectedDayData.data.sessions.map((session, idx) => {
                const sessSecs = session.task_entries.reduce((sum, e) => sum + e.duration_seconds, 0);
                return (
                  <div key={session.id || idx} className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-slate-900">
                        {session.user?.full_name || "Karyawan"}
                      </p>
                      <span className="text-sm font-bold text-teal-700">
                        {formatDecimalHours(sessSecs / 3600)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {session.task_entries.map((entry, eIdx) => (
                        <div key={entry.id || eIdx} className="flex items-center justify-between text-xs text-slate-500">
                          <span>{entry.client_account?.name || "—"} · {entry.task_type?.name || "—"}</span>
                          <span className="font-medium text-slate-700">{formatDecimalHours(entry.duration_seconds / 3600)}</span>
                        </div>
                      ))}
                    </div>
                    {session.proof_note && (
                      <p className="mt-2 text-[11px] italic text-slate-400 border-t border-slate-200 pt-1.5">
                        &ldquo;{session.proof_note}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
