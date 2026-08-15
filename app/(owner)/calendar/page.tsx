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
  const [calGroupMode, setCalGroupMode] = useState<"account" | "employee">("account");
  const [collapsedCalGroups, setCollapsedCalGroups] = useState<Set<string>>(new Set());

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
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
                    onClick={() => { if (hasData) { setCollapsedCalGroups(new Set()); setSelectedDayData({ date: dateStr, data: dayData! }); } }}
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

      {/* Day Detail Modal */}
      {selectedDayData && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedDayData(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
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

            {/* Toggle Mode */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
              {(["account", "employee"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setCalGroupMode(mode); setCollapsedCalGroups(new Set()); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    calGroupMode === mode
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "account" ? "🏢 Per Akun" : "👤 Per Karyawan"}
                </button>
              ))}
            </div>

            {/* Grouped Content */}
            <div className="space-y-2">
              {(() => {
                const allEntries = selectedDayData.data.sessions.flatMap(s =>
                  (s.task_entries || []).map(e => ({ ...e, session: s }))
                );

                if (calGroupMode === "account") {
                  // Group by client account
                  const groupMap = new Map<string, {
                    clientId: string;
                    clientName: string;
                    clientLanguage?: string | null;
                    totalSeconds: number;
                    taskCount: number;
                    employeeSubs: Map<string, { name: string; seconds: number; taskCount: number }>;
                  }>();

                  for (const entry of allEntries) {
                    const key = entry.client_account_id || "unknown";
                    const empName = entry.session.user?.full_name || "Karyawan";
                    const empId = entry.session.user_id;
                    const existing = groupMap.get(key);
                    if (existing) {
                      existing.totalSeconds += entry.duration_seconds || 0;
                      existing.taskCount += 1;
                      const empSub = existing.employeeSubs.get(empId);
                      if (empSub) { empSub.seconds += entry.duration_seconds || 0; empSub.taskCount += 1; }
                      else existing.employeeSubs.set(empId, { name: empName, seconds: entry.duration_seconds || 0, taskCount: 1 });
                    } else {
                      const empSubs = new Map<string, { name: string; seconds: number; taskCount: number }>();
                      empSubs.set(empId, { name: empName, seconds: entry.duration_seconds || 0, taskCount: 1 });
                      groupMap.set(key, {
                        clientId: key,
                        clientName: entry.client_account?.name || "—",
                        clientLanguage: entry.client_account?.language,
                        totalSeconds: entry.duration_seconds || 0,
                        taskCount: 1,
                        employeeSubs: empSubs,
                      });
                    }
                  }

                  return Array.from(groupMap.values())
                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                    .map((grp) => {
                      const isOpen = !collapsedCalGroups.has(grp.clientId);
                      return (
                        <div key={grp.clientId} className="border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setCollapsedCalGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(grp.clientId)) next.delete(grp.clientId); else next.add(grp.clientId);
                              return next;
                            })}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 text-left">
                              <span className="text-sm">{isOpen ? "▾" : "▸"}</span>
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {grp.clientName}
                                  {grp.clientLanguage && <span className="ml-1 font-normal text-slate-400">({grp.clientLanguage})</span>}
                                </p>
                                <p className="text-[10px] text-slate-400">{grp.taskCount} task · {grp.employeeSubs.size} karyawan</p>
                              </div>
                            </div>
                            <span className="text-sm font-extrabold text-teal-600 shrink-0 ml-2">
                              {formatDecimalHours(grp.totalSeconds / 3600)}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="divide-y divide-slate-100">
                              {Array.from(grp.employeeSubs.values())
                                .sort((a, b) => b.seconds - a.seconds)
                                .map((emp) => (
                                  <div key={emp.name} className="flex items-center justify-between px-5 py-2 bg-white">
                                    <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                                      <p className="text-xs text-slate-600 font-medium">{emp.name}</p>
                                      <span className="text-[10px] text-slate-400">{emp.taskCount} task</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">{formatDecimalHours(emp.seconds / 3600)}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                } else {
                  // Group by employee
                  const empMap = new Map<string, {
                    empId: string;
                    empName: string;
                    totalSeconds: number;
                    taskCount: number;
                    clientSubs: Map<string, { name: string; lang?: string | null; seconds: number; taskCount: number }>;
                  }>();

                  for (const entry of allEntries) {
                    const empId = entry.session.user_id;
                    const empName = entry.session.user?.full_name || "Karyawan";
                    const clientKey = entry.client_account_id || "unknown";
                    const existing = empMap.get(empId);
                    if (existing) {
                      existing.totalSeconds += entry.duration_seconds || 0;
                      existing.taskCount += 1;
                      const clientSub = existing.clientSubs.get(clientKey);
                      if (clientSub) { clientSub.seconds += entry.duration_seconds || 0; clientSub.taskCount += 1; }
                      else existing.clientSubs.set(clientKey, { name: entry.client_account?.name || "—", lang: entry.client_account?.language, seconds: entry.duration_seconds || 0, taskCount: 1 });
                    } else {
                      const clientSubs = new Map<string, { name: string; lang?: string | null; seconds: number; taskCount: number }>();
                      clientSubs.set(clientKey, { name: entry.client_account?.name || "—", lang: entry.client_account?.language, seconds: entry.duration_seconds || 0, taskCount: 1 });
                      empMap.set(empId, { empId, empName, totalSeconds: entry.duration_seconds || 0, taskCount: 1, clientSubs });
                    }
                  }

                  return Array.from(empMap.values())
                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                    .map((grp) => {
                      const isOpen = !collapsedCalGroups.has(grp.empId);
                      return (
                        <div key={grp.empId} className="border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setCollapsedCalGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(grp.empId)) next.delete(grp.empId); else next.add(grp.empId);
                              return next;
                            })}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 text-left">
                              <span className="text-sm">{isOpen ? "▾" : "▸"}</span>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{grp.empName}</p>
                                <p className="text-[10px] text-slate-400">{grp.taskCount} task</p>
                              </div>
                            </div>
                            <span className="text-sm font-extrabold text-teal-600 shrink-0 ml-2">
                              {formatDecimalHours(grp.totalSeconds / 3600)}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="divide-y divide-slate-100">
                              {Array.from(grp.clientSubs.values())
                                .sort((a, b) => b.seconds - a.seconds)
                                .map((cl) => (
                                  <div key={cl.name} className="flex items-center justify-between px-5 py-2 bg-white">
                                    <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                      <p className="text-xs text-slate-600 font-medium">
                                        {cl.name}{cl.lang && <span className="ml-1 text-slate-400">({cl.lang})</span>}
                                      </p>
                                      <span className="text-[10px] text-slate-400">{cl.taskCount} task</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">{formatDecimalHours(cl.seconds / 3600)}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
