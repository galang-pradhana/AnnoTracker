"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDecimalHours, formatRupiah } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import {
  DEFAULT_SALARY_TIERS,
  DEFAULT_BONUS_THRESHOLD_HOURS,
  DEFAULT_BONUS_AMOUNT,
  ROUTES,
} from "@/constants";
import { determineUserHourlyRate } from "@/lib/payroll/calculations";
import type { WorkSessionWithEntries, SalaryTier, BonusRule, UserSalaryRate } from "@/types";

interface TierLike {
  min_hours: number;
  max_hours: number | null;
  rate_per_hour: number;
}

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

interface DayDetail {
  session: WorkSessionWithEntries;
  totalSeconds: number;
}

interface WeekSummary {
  weekLabel: string;
  startDate: string;
  endDate: string;
  hours: number;
  bonusEarned: number;
  bonusThreshold: number;
  qualified: boolean;
}

export default function EmployeeHistoryPage() {
  const router = useRouter();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<WorkSessionWithEntries[]>([]);
  const [salaryTiers, setSalaryTiers] = useState<SalaryTier[]>([]);
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([]);
  const [userSalaryRates, setUserSalaryRates] = useState<UserSalaryRate[]>([]);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);

  // State untuk collapsible bonus breakdown
  const [isBonusExpanded, setIsBonusExpanded] = useState(false);

  const fetchHistory = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(ROUTES.LOGIN); return; }
      setUserId(user.id);

      const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = getDaysInMonth(year, month);
      const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const [sessionRes, tiersRes, bonusRes, userRatesRes] = await Promise.all([
        supabase
          .from("work_sessions")
          .select("*, task_entries(*, client_account:client_accounts(*), task_type:task_types(*))")
          .eq("user_id", user.id)
          .gte("session_date", periodStart)
          .lte("session_date", periodEnd)
          .order("session_date", { ascending: true }),
        supabase.from("salary_tiers").select("*").order("min_hours"),
        supabase.from("bonus_rules").select("*").order("effective_from", { ascending: false }),
        supabase.from("user_salary_rates").select("*").eq("user_id", user.id).lte("effective_from", periodEnd).order("effective_from", { ascending: false }),
      ]);

      if (sessionRes.data) setSessions(sessionRes.data as unknown as WorkSessionWithEntries[]);
      if (tiersRes.data && tiersRes.data.length > 0) setSalaryTiers(tiersRes.data);
      if (bonusRes.data && bonusRes.data.length > 0) setBonusRules(bonusRes.data);
      if (userRatesRes.data) setUserSalaryRates(userRatesRes.data as unknown as UserSalaryRate[]);
    } catch (err) {
      console.error("Employee history fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHistory(viewYear, viewMonth);
  }, [fetchHistory, viewYear, viewMonth]);

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

  const activeTiers: TierLike[] = salaryTiers.length > 0 ? salaryTiers : DEFAULT_SALARY_TIERS;

  // Active bonus rule
  const activeBonusRule = useMemo(() => {
    if (bonusRules.length > 0) return bonusRules[0];
    return null;
  }, [bonusRules]);

  const bonusThreshold = activeBonusRule?.min_weekly_hours ?? DEFAULT_BONUS_THRESHOLD_HOURS;
  const bonusAmount = activeBonusRule?.bonus_amount ?? DEFAULT_BONUS_AMOUNT;

  // Build a map of date -> session
  const sessionMap = new Map<string, WorkSessionWithEntries>();
  sessions.forEach(s => sessionMap.set(s.session_date, s));

  // Monthly summary calculation with dynamic tiers
  const totalMonthSeconds = sessions.reduce(
    (acc, s) => acc + (s.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0), 0
  );
  const totalMonthHours = totalMonthSeconds / 3600;

  const totalMonthBasePay = sessions.reduce((acc, s) => {
    const secs = (s.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
    const hrs = secs / 3600;
    const rate = determineUserHourlyRate(userId, hrs, s.session_date, salaryTiers, userSalaryRates);
    return acc + Math.round(hrs * rate);
  }, 0);

  // ── Weekly breakdown for bonus display ─────────────────────────────
  const weekSummaries: WeekSummary[] = useMemo(() => {
    if (sessions.length === 0) return [];

    // Group sessions by ISO week (Mon-Sun)
    const weekMap = new Map<string, WorkSessionWithEntries[]>();
    sessions.forEach(s => {
      const date = new Date(s.session_date + "T00:00:00");
      const dow = date.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(date);
      monday.setDate(date.getDate() + diff);
      const weekKey = monday.toISOString().split("T")[0];
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
      weekMap.get(weekKey)!.push(s);
    });

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mondayStr, weekSessions], idx) => {
        const monday = new Date(mondayStr + "T00:00:00");
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const totalSecs = weekSessions.reduce(
          (acc, s) => acc + (s.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0), 0
        );
        const hours = totalSecs / 3600;
        const qualified = hours >= bonusThreshold;
        const weekLabel = `Minggu ${idx + 1} (${monday.getDate()} ${MONTH_NAMES[monday.getMonth()].slice(0, 3)} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()].slice(0, 3)})`;

        return {
          weekLabel,
          startDate: mondayStr,
          endDate: sunday.toISOString().split("T")[0],
          hours,
          bonusEarned: qualified ? bonusAmount : 0,
          bonusThreshold,
          qualified,
        };
      });
  }, [sessions, bonusThreshold, bonusAmount]);

  const totalMonthBonus = weekSummaries.reduce((acc, w) => acc + w.bonusEarned, 0);
  const totalEstimated = totalMonthBasePay + totalMonthBonus;

  // Build calendar grid
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

  const getDayTierRate = (dayHours: number, dateStr: string) =>
    determineUserHourlyRate(userId, dayHours, dateStr, salaryTiers, userSalaryRates);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16 transition-colors duration-200">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AppLogo variant="icon" size="sm" />
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                Riwayat
              </h1>
              <p className="text-[11px] text-[var(--text-secondary)]">{MONTH_NAMES[viewMonth]} {viewYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={ROUTES.EMPLOYEE_WORK_SESSION} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              ✏️ Catat Kerja
            </Link>
            <Link href={ROUTES.EMPLOYEE_HISTORY} className="text-xs text-[var(--primary)] font-bold px-2.5 py-1 bg-[var(--primary-soft)] rounded-lg transition-colors">
              📅 Riwayat
            </Link>
            <Link href={ROUTES.EMPLOYEE_ASSESSMENT} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
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

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* 1. Ringkasan Pendapatan Bulanan */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] text-[var(--text-primary)] shadow-xs space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Ringkasan {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          <div className="flex items-end justify-between pt-1">
            <div>
              <p className="text-3xl font-black tracking-tight text-[var(--accent-teal)]">{formatDecimalHours(totalMonthHours)}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sessions.length} hari kerja dicatat</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-secondary)] font-medium">Est. Pendapatan</p>
              <p className="text-2xl font-black text-[var(--primary)] tracking-tight">{formatRupiah(totalEstimated)}</p>
              {totalMonthBonus > 0 && (
                <p className="text-[10px] text-[var(--primary)] font-semibold">
                  Pokok {formatRupiah(totalMonthBasePay)} + Bonus {formatRupiah(totalMonthBonus)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2. KALENDER KERJA */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
          {/* Header Kalender */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)] transition-colors text-sm font-bold cursor-pointer"
            >
              ←
            </button>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              📅 Kalender Kerja {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <button
              onClick={handleNextMonth}
              disabled={isFutureDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)] transition-colors text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              →
            </button>
          </div>

          {/* Header Nama Hari */}
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--bg-surface-alt)]/50">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-[var(--text-secondary)] uppercase py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Grid Tanggal Kalender */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Memuat data kalender...</div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-16 border-b border-r border-[var(--border)]/40" />;
                }

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const session = sessionMap.get(dateStr);
                const daySeconds = session
                  ? (session.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
                  : 0;
                const dayHours = daySeconds / 3600;
                const isToday = isCurrentMonth && day === today.getDate();
                const isFuture = isCurrentMonth && day > today.getDate();
                const hasData = !!session && daySeconds > 0;

                return (
                  <button
                    key={dateStr}
                    onClick={() => hasData && setSelectedDay({ session: session!, totalSeconds: daySeconds })}
                    disabled={!hasData}
                    className={`
                      h-16 flex flex-col items-center justify-between py-2 border-b border-r border-[var(--border)]/40 transition-all relative
                      ${hasData ? "cursor-pointer hover:bg-[var(--primary-soft)] active:scale-95" : "cursor-default"}
                      ${isToday ? "bg-[var(--primary-soft)]/50 font-bold" : ""}
                    `}
                  >
                    {/* Nomar Tanggal + Dot Status */}
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-semibold ${
                        isToday ? "w-5 h-5 bg-[var(--primary)] text-white rounded-full flex items-center justify-center text-[10px] shadow-xs" :
                        isFuture ? "text-[var(--text-secondary)]/50" :
                        hasData ? "text-[var(--text-primary)] font-bold" : "text-[var(--text-secondary)]"
                      }`}>
                        {day}
                      </span>
                      {hasData && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0" title="Ada catatan kerja" />
                      )}
                    </div>

                    {/* Badge Kontras Tinggi Angka Jam Kerja */}
                    {hasData ? (
                      <span className="text-[10px] font-extrabold text-[var(--primary)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded-md leading-none border border-[var(--primary)]/20">
                        {formatDecimalHours(dayHours)}
                      </span>
                    ) : (
                      <span className="h-4" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legenda Indikator Dot */}
          <div className="flex items-center gap-4 px-4 py-3 bg-[var(--bg-surface-alt)]/50 text-[10px] font-semibold text-[var(--text-secondary)] border-t border-[var(--border)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
              Ada catatan kerja
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--border)]" />
              Belum diisi
            </span>
          </div>
        </div>

        {/* 3. RINCIAN BONUS MINGGUAN */}
        {weekSummaries.length > 0 && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsBonusExpanded((v) => !v)}
              className="w-full px-5 py-3.5 flex items-center justify-between bg-[var(--bg-surface-alt)]/50 hover:bg-[var(--bg-surface-alt)] transition-colors text-left cursor-pointer"
            >
              <div>
                <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎯 Rincian Bonus Mingguan</span>
                  {totalMonthBonus > 0 && (
                    <span className="text-[10px] bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded-full font-bold">
                      +{formatRupiah(totalMonthBonus)}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Target ≥ {bonusThreshold}j/minggu → +{formatRupiah(bonusAmount)}
                </p>
              </div>
              <span className="text-xs font-bold text-[var(--primary)]">
                {isBonusExpanded ? "Tutup ▲" : "Lihat Detail ▼"}
              </span>
            </button>

            {isBonusExpanded && (
              <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {weekSummaries.map((week) => (
                  <div key={week.startDate} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{week.weekLabel}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[var(--text-secondary)]">{formatDecimalHours(week.hours)}</span>
                        <div className="h-1.5 w-20 bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${week.qualified ? "bg-[var(--success)]" : "bg-[var(--primary)]"}`}
                            style={{ width: `${Math.min(100, (week.hours / week.bonusThreshold) * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                          {((week.hours / week.bonusThreshold) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {week.qualified ? (
                        <span className="inline-flex items-center gap-1 bg-[var(--primary-soft)] text-[var(--primary)] text-[11px] font-bold px-2.5 py-1 rounded-lg">
                          🎉 +{formatRupiah(week.bonusEarned)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                          Sisa {formatDecimalHours(week.bonusThreshold - week.hours)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Detail Modal Saat Tanggal Ditekan */}
      {selectedDay && (() => {
        const dayHours = selectedDay.totalSeconds / 3600;
        const dayRate = getDayTierRate(dayHours, selectedDay.session.session_date);
        const dayPay = Math.round(dayHours * dayRate);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
            onClick={() => setSelectedDay(null)}
          >
            <div
              className="w-full max-w-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-t-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto border-t border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4" />

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {new Date(selectedDay.session.session_date + "T00:00:00").toLocaleDateString("id-ID", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric"
                    })}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Total: <span className="font-bold text-[var(--primary)]">{formatDecimalHours(dayHours)}</span>
                    {" · "}
                    {(selectedDay.session.task_entries || []).length} task dicatat
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-7 h-7 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Tarif per jam hari ini */}
              <div className="mb-4 p-3.5 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Tarif Per Jam Hari Ini</p>
                  <p className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{formatRupiah(dayRate)}<span className="text-xs font-normal text-[var(--text-secondary)]">/jam</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-secondary)]">Est. Pendapatan Hari Ini</p>
                  <p className="text-lg font-bold text-[var(--primary)]">{formatRupiah(dayPay)}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{formatDecimalHours(dayHours)} × {formatRupiah(dayRate)}</p>
                </div>
              </div>

              <div className="space-y-2">
                {(selectedDay.session.task_entries || []).map((entry, idx) => (
                  <div key={entry.id || idx} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]/60 rounded-xl border border-[var(--border)]">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {entry.client_account?.name || "—"}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">{entry.task_type?.name || "—"}</p>
                    </div>
                    <span className="text-sm font-bold text-[var(--primary)]">
                      {formatDecimalHours((entry.duration_seconds || 0) / 3600)}
                    </span>
                  </div>
                ))}
              </div>

              {selectedDay.session.proof_note && (
                <div className="mt-4 p-3 bg-[var(--primary-soft)] rounded-xl border border-[var(--primary)]/20">
                  <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider mb-1">Catatan Bukti</p>
                  <p className="text-xs text-[var(--text-primary)] italic">&ldquo;{selectedDay.session.proof_note}&rdquo;</p>
                </div>
              )}
              {selectedDay.session.proof_url && (
                <a
                  href={selectedDay.session.proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  📷 Lihat Foto Bukti
                </a>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
