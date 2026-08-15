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
import type { User, WorkSessionWithEntries, ClientAccount, TaskType } from "@/types";

// ─── Helper Functions ────────────────────────────────────────────────────────

function getTierRate(hours: number): number {
  for (const tier of DEFAULT_SALARY_TIERS) {
    if (hours >= tier.min_hours && (tier.max_hours === null || hours <= tier.max_hours)) {
      return tier.rate_per_hour;
    }
  }
  return DEFAULT_SALARY_TIERS[0].rate_per_hour;
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, lastDay };
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

// ─── Mini Bar Component ──────────────────────────────────────────────────────
function MiniBar({ value, max, color = "bg-teal-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-700/80 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Empty State Component ───────────────────────────────────────────────────
function EmptyState({
  icon = "📋",
  title = "Belum Ada Data",
  description = "Belum ada catatan aktivitas yang tersedia untuk tampilan ini.",
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-xl mb-3 shadow-xs">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface EmployeeStats {
  user: User;
  totalSeconds: number;
  totalHours: number;
  workDays: number;
  avgHoursPerDay: number;
  estimatedPay: number;
  bonusEligible: boolean;
  loggedToday: boolean;
  taskCount: number;
}

interface AccountStats {
  account: ClientAccount;
  totalSeconds: number;
  totalHours: number;
  employeeSet: Set<string>;
}

interface TaskTypeStats {
  taskType: TaskType;
  totalSeconds: number;
  totalHours: number;
}

interface CalendarDayData {
  totalSeconds: number;
  employeeCount: number;
  sessions: WorkSessionWithEntries[];
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function OwnerDashboardPage() {
  const router = useRouter();

  // Stable date string for today
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonth = useMemo(() => new Date().getMonth(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [monthSessions, setMonthSessions] = useState<WorkSessionWithEntries[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dateSessions, setDateSessions] = useState<WorkSessionWithEntries[]>([]);
  const [dateLoading, setDateLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "calendar" | "employee" | "account" | "tasktype" | "daily">("overview");
  const [payrollStatusMap, setPayrollStatusMap] = useState<Record<string, "paid" | "unpaid">>({});

  // Calendar State inside Dashboard
  const [calYear, setCalYear] = useState(currentYear);
  const [calMonth, setCalMonth] = useState(currentMonth);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{ date: string; data: CalendarDayData } | null>(null);

  // Account tab state — filter periode & side panel drill-down
  const [accountPeriod, setAccountPeriod] = useState<"today" | "week" | "month">("month");
  const [selectedAccountDrill, setSelectedAccountDrill] = useState<AccountStats | null>(null);

  // Dashboard calendar modal grouping state
  const [calDashGroupMode, setCalDashGroupMode] = useState<"account" | "employee">("account");
  const [collapsedDashCalGroups, setCollapsedDashCalGroups] = useState<Set<string>>(new Set());

  // ── Get current payroll period (15th→14th) ─────────────────────────────────
  const currentPayrollPeriod = useMemo(() => {
    const today = new Date();
    const day = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();
    if (day >= 15) {
      return {
        start: `${year}-${String(month + 1).padStart(2, "0")}-15`,
        end: `${year + (month === 11 ? 1 : 0)}-${String(month === 11 ? 1 : month + 2).padStart(2, "0")}-14`,
      };
    } else {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      return {
        start: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-15`,
        end: `${year}-${String(month + 1).padStart(2, "0")}-14`,
      };
    }
  }, []);

  // ── Fetch bulan berjalan ───────────────────────────────────────────────────
  const fetchMonthlyData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(ROUTES.LOGIN); return; }

      const now = new Date();
      const { start, end } = getMonthRange(now.getFullYear(), now.getMonth());

      const [empRes, sessionRes, payrollRes] = await Promise.all([
        supabase.from("users").select("*").eq("role", "employee").order("full_name"),
        supabase
          .from("work_sessions")
          .select("*, user:users(*), task_entries(*, client_account:client_accounts(*), task_type:task_types(*))")
          .gte("session_date", start)
          .lte("session_date", end)
          .order("session_date", { ascending: false }),
        supabase.from("payroll_records").select("user_id, payment_status")
          .gte("period_start", currentPayrollPeriod.start)
          .lte("period_end", currentPayrollPeriod.end),
      ]);

      if (empRes.data) setEmployees(empRes.data);
      if (sessionRes.data) setMonthSessions(sessionRes.data as unknown as WorkSessionWithEntries[]);
      if (payrollRes.data) {
        const statusMap: Record<string, "paid" | "unpaid"> = {};
        payrollRes.data.forEach((r) => { statusMap[r.user_id] = r.payment_status; });
        setPayrollStatusMap(statusMap);
      }
    } catch (err) {
      console.error("Dashboard monthly fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router, currentPayrollPeriod]);

  // ── Fetch by date ─────────────────────────────────────────────────────────
  const fetchDateSessions = useCallback(async (date: string) => {
    setDateLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("work_sessions")
        .select("*, user:users(*), task_entries(*, client_account:client_accounts(*), task_type:task_types(*))")
        .eq("session_date", date);
      if (data) setDateSessions(data as unknown as WorkSessionWithEntries[]);
    } catch (err) {
      console.error("Dashboard date fetch error:", err);
    } finally {
      setDateLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  useEffect(() => {
    fetchDateSessions(selectedDate);
  }, [fetchDateSessions, selectedDate]);

  // ── Derived: Employee Stats ───────────────────────────────────────────────
  const employeeStats: EmployeeStats[] = useMemo(() => {
    return employees.map((emp) => {
      const empSessions = monthSessions.filter((s) => s.user_id === emp.id);
      const totalSeconds = empSessions.reduce(
        (acc, s) => acc + (s.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0), 0
      );
      const totalHours = totalSeconds / 3600;
      const workDays = empSessions.length;
      const avgHoursPerDay = workDays > 0 ? totalHours / workDays : 0;
      const rate = getTierRate(totalHours);
      const basePay = Math.round(totalHours * rate);
      const bonus = totalHours >= DEFAULT_BONUS_THRESHOLD_HOURS ? DEFAULT_BONUS_AMOUNT : 0;
      const loggedToday = empSessions.some((s) => s.session_date === todayStr);
      const taskCount = empSessions.reduce((acc, s) => acc + (s.task_entries || []).length, 0);
      return {
        user: emp,
        totalSeconds,
        totalHours,
        workDays,
        avgHoursPerDay,
        estimatedPay: basePay + bonus,
        bonusEligible: totalHours >= DEFAULT_BONUS_THRESHOLD_HOURS,
        loggedToday,
        taskCount,
      };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [employees, monthSessions, todayStr]);

  // ── Derived: Client Account Stats ─────────────────────────────────────────
  const accountStats: AccountStats[] = useMemo(() => {
    const accountMap = new Map<string, AccountStats>();
    monthSessions.forEach((s) => {
      (s.task_entries || []).forEach((e) => {
        if (!e.client_account) return;
        const key = e.client_account_id;
        const existing = accountMap.get(key);
        if (existing) {
          existing.totalSeconds += (e.duration_seconds || 0);
          existing.employeeSet.add(s.user_id);
        } else {
          accountMap.set(key, {
            account: e.client_account,
            totalSeconds: (e.duration_seconds || 0),
            totalHours: 0,
            employeeSet: new Set([s.user_id]),
          });
        }
      });
    });
    return Array.from(accountMap.values())
      .map((a) => ({ ...a, totalHours: a.totalSeconds / 3600 }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [monthSessions]);

  // ── Derived: Filtered Account Stats (berdasarkan accountPeriod) ───────────
  const filteredAccountStats: (AccountStats & { taskCount: number })[] = useMemo(() => {
    const now = new Date();
    const todayISO = now.toISOString().split("T")[0];

    // Hitung start of week (Monday)
    const dowToday = now.getDay();
    const diffToMon = dowToday === 0 ? -6 : 1 - dowToday;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMon);
    const weekStartISO = weekStart.toISOString().split("T")[0];

    const filtered = monthSessions.filter(s => {
      if (accountPeriod === "today") return s.session_date === todayISO;
      if (accountPeriod === "week") return s.session_date >= weekStartISO && s.session_date <= todayISO;
      return true; // "month"
    });

    const accountMap = new Map<string, AccountStats & { taskCount: number }>();
    filtered.forEach((s) => {
      (s.task_entries || []).forEach((e) => {
        if (!e.client_account) return;
        const key = e.client_account_id;
        const existing = accountMap.get(key);
        if (existing) {
          existing.totalSeconds += (e.duration_seconds || 0);
          existing.employeeSet.add(s.user_id);
          existing.taskCount += 1;
        } else {
          accountMap.set(key, {
            account: e.client_account,
            totalSeconds: (e.duration_seconds || 0),
            totalHours: 0,
            employeeSet: new Set([s.user_id]),
            taskCount: 1,
          });
        }
      });
    });
    return Array.from(accountMap.values())
      .map((a) => ({ ...a, totalHours: a.totalSeconds / 3600 }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [monthSessions, accountPeriod]);

  // ── Helper: employee breakdown untuk akun tertentu, per filter aktif ────────
  const getAccountEmployeeBreakdown = (acc: AccountStats) => {
    const now = new Date();
    const todayISO = now.toISOString().split("T")[0];
    const dowToday = now.getDay();
    const diffToMon = dowToday === 0 ? -6 : 1 - dowToday;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMon);
    const weekStartISO = weekStart.toISOString().split("T")[0];

    const filtered = monthSessions.filter(s => {
      if (accountPeriod === "today") return s.session_date === todayISO;
      if (accountPeriod === "week") return s.session_date >= weekStartISO && s.session_date <= todayISO;
      return true;
    });

    const empMap = new Map<string, { name: string; seconds: number; taskCount: number }>();
    filtered.forEach(s => {
      (s.task_entries || []).forEach(e => {
        if (e.client_account_id !== acc.account.id) return;
        const existing = empMap.get(s.user_id);
        if (existing) {
          existing.seconds += e.duration_seconds || 0;
          existing.taskCount += 1;
        } else {
          empMap.set(s.user_id, {
            name: s.user?.full_name || "Karyawan",
            seconds: e.duration_seconds || 0,
            taskCount: 1,
          });
        }
      });
    });
    return Array.from(empMap.values()).sort((a, b) => b.seconds - a.seconds);
  };



  // ── Derived: Task Type Stats ───────────────────────────────────────────────
  const taskTypeStats: TaskTypeStats[] = useMemo(() => {
    const taskTypeMap = new Map<string, TaskTypeStats>();
    monthSessions.forEach((s) => {
      (s.task_entries || []).forEach((e) => {
        if (!e.task_type) return;
        const key = e.task_type_id;
        const existing = taskTypeMap.get(key);
        if (existing) {
          existing.totalSeconds += (e.duration_seconds || 0);
          existing.totalHours = existing.totalSeconds / 3600;
        } else {
          taskTypeMap.set(key, {
            taskType: e.task_type,
            totalSeconds: (e.duration_seconds || 0),
            totalHours: (e.duration_seconds || 0) / 3600,
          });
        }
      });
    });
    return Array.from(taskTypeMap.values())
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [monthSessions]);

  // ── Derived: Calendar Map ────────────────────────────────────────────────
  const calendarDayMap = useMemo(() => {
    const map = new Map<string, CalendarDayData>();
    monthSessions.forEach(s => {
      const secs = (s.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
      const existing = map.get(s.session_date);
      if (existing) {
        existing.totalSeconds += secs;
        existing.employeeCount += 1;
        existing.sessions.push(s);
      } else {
        map.set(s.session_date, { totalSeconds: secs, employeeCount: 1, sessions: [s] });
      }
    });
    return map;
  }, [monthSessions]);

  // Calendar cells setup
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOffset = getFirstDayOfMonth(calYear, calMonth);
  const calendarCells: (number | null)[] = useMemo(() => {
    const cells: (number | null)[] = [
      ...Array(firstDayOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDayOffset, daysInMonth]);

  const isCurrentMonth = calYear === currentYear && calMonth === currentMonth;

  // ── Derived: Monthly Totals ───────────────────────────────────────────────
  const totalTeamHours = useMemo(() => employeeStats.reduce((acc, e) => acc + e.totalHours, 0), [employeeStats]);
  const totalEstimatedPayroll = useMemo(() => employeeStats.reduce((acc, e) => acc + e.estimatedPay, 0), [employeeStats]);
  const activeEmployeesThisMonth = useMemo(() => employeeStats.filter((e) => e.workDays > 0).length, [employeeStats]);
  const todayLoggedCount = useMemo(() => employeeStats.filter((e) => e.loggedToday).length, [employeeStats]);
  const daysPassedThisMonth = new Date().getDate();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysRemaining = totalDaysInMonth - daysPassedThisMonth;
  const maxAccountHours = accountStats[0]?.totalHours ?? 1;
  const maxEmpHours = employeeStats[0]?.totalHours ?? 1;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  function getDayColor(hours: number): string {
    if (hours === 0) return "";
    if (hours < 4) return "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300";
    if (hours < 8) return "bg-teal-200 dark:bg-teal-800/60 text-teal-900 dark:text-teal-200";
    if (hours < 16) return "bg-teal-400 dark:bg-teal-600 text-white";
    return "bg-teal-600 dark:bg-teal-500 text-white";
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">

        {/* ── Sub-tab Navigation (Underline Tab Style) ────────────────────────── */}
        <div className="border-b border-[var(--border)] mb-6">
          <nav className="flex gap-6 overflow-x-auto no-scrollbar">
            {([
              ["overview", "Ringkasan"],
              ["calendar", "Kalender Tim"],
              ["employee", "Per Karyawan"],
              ["account", "Per Akun Klien"],
              ["tasktype", "Per Jenis Task"],
              ["daily", "Rekap Harian"],
            ] as const).map(([key, label]) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-3 text-sm whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)] font-medium"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Top KPI Cards (Visual Hierarchy: Critical Hero Card + Secondary Cards) ──── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* HERO / CRITICAL CARD: Status Input Hari Ini */}
            <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/90 bg-black/20 px-2.5 py-0.5 rounded-full border border-white/20">
                  📌 Actionable · Hari Ini
                </span>
                <span className="text-xs text-white/80 font-medium">{todayStr}</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">{todayLoggedCount}</span>
                  <span className="text-sm text-white/80 font-medium">/ {employees.length} Karyawan</span>
                </div>
                <div className="mt-1.5">
                  {employees.length - todayLoggedCount > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-100 bg-black/25 px-2.5 py-1 rounded-lg text-[11px] border border-amber-300/30">
                      ⚠️ {employees.length - todayLoggedCount} orang belum menginput sesi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-white bg-black/25 px-2.5 py-1 rounded-lg text-[11px] border border-white/30">
                      ✓ Semua karyawan sudah menginput hari ini
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SECONDARY CARD 1: Total Jam Tim */}
            <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Total Jam Tim Bulan Ini</span>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">{formatDecimalHours(totalTeamHours)}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">{monthSessions.length} sesi kerja tercatat</p>
              </div>
            </div>

            {/* SECONDARY CARD 2: Estimasi Payroll */}
            <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Estimasi Payroll</span>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-[var(--primary)]">{formatRupiah(totalEstimatedPayroll)}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">Estimasi berjalan (belum final)</p>
              </div>
            </div>

            {/* SECONDARY CARD 3: Hari Tersisa */}
            <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Hari Tersisa Bulan Ini</span>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">{daysRemaining} Hari</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">Hari ke-{daysPassedThisMonth} dari {totalDaysInMonth}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Banner Status Pembayaran Periode Ini (Informative Neutral) ──────── */}
        {!isLoading && employees.length > 0 && (() => {
          const paidCount = employees.filter(e => payrollStatusMap[e.id] === "paid").length;
          const allPaid = paidCount === employees.length;

          return (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
                  allPaid
                    ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]"
                }`}>
                  {allPaid ? "✓" : "💳"}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">Status Pembayaran Periode Ini</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {paidCount} dari {employees.length} karyawan telah dikonfirmasi dibayar
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {employees.map(emp => (
                  <span key={emp.id} className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                    payrollStatusMap[emp.id] === "paid"
                      ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30"
                      : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border border-[var(--border)]"
                  }`}>
                    <span>{payrollStatusMap[emp.id] === "paid" ? "✓" : "⏳"}</span>
                    <span>{emp.full_name.split(" ")[0]}</span>
                  </span>
                ))}
                <Link
                  href={ROUTES.OWNER_PAYROLL}
                  className="text-[11px] font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] hover:underline ml-1"
                >
                  Lihat Payroll →
                </Link>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">

            {/* Status Karyawan Hari Ini */}
            <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Status Karyawan Hari Ini</h2>
                <span className="text-[11px] text-[var(--text-secondary)]">{todayStr}</span>
              </div>
              {isLoading ? (
                <div className="text-xs text-[var(--text-secondary)] py-6 text-center">Memuat...</div>
              ) : employees.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="Belum Ada Karyawan"
                  description="Belum ada karyawan terdaftar dalam sistem."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {employees.map((emp) => {
                    const stat = employeeStats.find(e => e.user.id === emp.id);
                    const todaySession = monthSessions.find(
                      s => s.user_id === emp.id && s.session_date === todayStr
                    );
                    const todaySecs = todaySession
                      ? (todaySession.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
                      : 0;

                    return (
                      <div
                        key={emp.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                          stat?.loggedToday
                            ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30"
                            : "bg-[var(--bg-surface-alt)] border-[var(--border)]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${stat?.loggedToday ? "bg-[var(--accent-teal)]" : "bg-amber-400"}`} />
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{emp.full_name}</p>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                              {stat?.loggedToday ? `${stat.workDays} hari kerja bulan ini` : "Belum input hari ini"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {stat?.loggedToday && todaySecs > 0 ? (
                            <p className="text-sm font-bold text-[var(--accent-teal)]">{formatDecimalHours(todaySecs / 3600)}</p>
                          ) : (
                            <p className="text-xs text-amber-500 font-medium">—</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top 5 Employee & Top Akun Klien */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">🏆 Top Karyawan Bulan Ini</h2>
                {isLoading ? (
                  <div className="text-xs text-[var(--text-secondary)] py-6 text-center">Memuat...</div>
                ) : employeeStats.length === 0 ? (
                  <EmptyState
                    icon="🏆"
                    title="Belum Ada Data"
                    description="Belum ada pencatatan jam kerja karyawan bulan ini."
                  />
                ) : (
                  <div className="space-y-3.5">
                    {employeeStats.slice(0, 5).map((stat, idx) => (
                      <div key={stat.user.id} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          idx === 0 ? "bg-[var(--primary-soft)] text-[var(--primary)]" :
                          idx === 1 ? "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]" :
                          idx === 2 ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]" :
                          "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]"
                        }`}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{stat.user.full_name}</p>
                            <p className="text-xs font-bold text-[var(--primary)] ml-2 shrink-0">{formatDecimalHours(stat.totalHours)}</p>
                          </div>
                          <MiniBar value={stat.totalHours} max={maxEmpHours} color="bg-[var(--primary)]" />
                        </div>
                        {stat.bonusEligible && (
                          <span className="text-[10px] bg-[var(--primary-soft)] text-[var(--primary)] px-1.5 py-0.5 rounded font-bold shrink-0">BONUS</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Akun Klien */}
              <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">🏢 Akun Klien Terbanyak Dikerjakan</h2>
                {isLoading ? (
                  <div className="text-xs text-[var(--text-secondary)] py-6 text-center">Memuat...</div>
                ) : accountStats.length === 0 ? (
                  <EmptyState
                    icon="🏢"
                    title="Belum Ada Data"
                    description="Belum ada task akun klien yang dikerjakan bulan ini."
                  />
                ) : (
                  <div className="space-y-3.5">
                    {accountStats.slice(0, 5).map((acc) => {
                      const pct = totalTeamHours > 0 ? ((acc.totalHours / totalTeamHours) * 100).toFixed(0) : 0;
                      return (
                        <div key={acc.account.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-[var(--text-primary)]">{acc.account.name}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-[var(--text-secondary)]">{pct}%</span>
                              <span className="text-xs font-bold text-[var(--text-primary)]">{formatDecimalHours(acc.totalHours)}</span>
                            </div>
                          </div>
                          <MiniBar value={acc.totalHours} max={maxAccountHours} color="bg-[var(--accent-teal)]" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Insight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Karyawan Aktif Bulan Ini</p>
                <p className="text-3xl font-extrabold text-[var(--text-primary)] mt-1">{activeEmployeesThisMonth}</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">dari {employees.length} total karyawan terdaftar</p>
              </div>
              <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Rata-rata Jam/Hari (Tim)</p>
                <p className="text-3xl font-extrabold text-[var(--text-primary)] mt-1">
                  {daysPassedThisMonth > 0 ? formatDecimalHours(totalTeamHours / daysPassedThisMonth) : "0j"}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">rata-rata per hari kalender</p>
              </div>
              <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Karyawan Dapat Bonus</p>
                <p className="text-3xl font-extrabold text-[var(--primary)] mt-1">
                  {employeeStats.filter((e) => e.bonusEligible).length}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">≥ {DEFAULT_BONUS_THRESHOLD_HOURS}j → +{formatRupiah(DEFAULT_BONUS_AMOUNT)}</p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: KALENDER TIM
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "calendar" && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <button
                onClick={() => setCalMonth(m => (m === 0 ? 11 : m - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)] font-bold transition-colors cursor-pointer"
              >
                ←
              </button>
              <div className="text-center">
                <h2 className="text-base font-bold text-[var(--text-primary)]">{MONTH_NAMES[calMonth]} {calYear}</h2>
              </div>
              <button
                onClick={() => setCalMonth(m => (m === 11 ? 0 : m + 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)] font-bold transition-colors cursor-pointer"
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-[var(--border)]">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-[var(--text-secondary)] uppercase py-2.5">
                  {d}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-xs text-[var(--text-secondary)]">Memuat kalender...</div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarCells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-20 border-b border-r border-[var(--border)] opacity-30" />;
                  }

                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayData = calendarDayMap.get(dateStr);
                  const dayHours = dayData ? dayData.totalSeconds / 3600 : 0;
                  const isToday = isCurrentMonth && day === new Date().getDate();
                  const hasData = !!dayData && dayData.totalSeconds > 0;
                  const colorClass = getDayColor(dayHours);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => hasData && setSelectedCalendarDay({ date: dateStr, data: dayData! })}
                      disabled={!hasData}
                      className={`
                        h-20 flex flex-col items-center justify-center border-b border-r border-[var(--border)] transition-all relative gap-1
                        ${hasData ? "cursor-pointer hover:scale-95 hover:rounded-xl hover:z-10" : "cursor-default"}
                        ${hasData ? colorClass : ""}
                        ${isToday && !hasData ? "bg-[var(--bg-surface-alt)]" : ""}
                      `}
                    >
                      <span className={`text-xs font-bold ${
                        isToday ? "w-6 h-6 bg-[var(--primary)] text-white rounded-full flex items-center justify-center text-[11px] mx-auto shadow-2xs" :
                        hasData ? "opacity-90" : "text-[var(--text-secondary)]"
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
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PER KARYAWAN
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "employee" && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Rekap Bulanan Per Karyawan</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">{MONTH_NAMES[currentMonth]} {currentYear} · diurutkan terbanyak</p>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Memuat data...</div>
            ) : employeeStats.length === 0 ? (
              <EmptyState
                icon="👥"
                title="Belum Ada Data Karyawan"
                description="Belum ada catatan jam kerja karyawan bulan ini."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                    <tr className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      <th className="px-6 py-3">Karyawan</th>
                      <th className="px-4 py-3">Total Jam</th>
                      <th className="px-4 py-3">Hari Kerja</th>
                      <th className="px-4 py-3">Rata-rata/Hari</th>
                      <th className="px-4 py-3">Jumlah Task</th>
                      <th className="px-4 py-3">Est. Gaji</th>
                      <th className="px-4 py-3">Bonus</th>
                      <th className="px-4 py-3">Status Hari Ini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {employeeStats.map((stat, idx) => (
                      <tr key={stat.user.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                              idx === 0 ? "bg-[var(--primary-soft)] text-[var(--primary)]" :
                              idx === 1 ? "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]" :
                              idx === 2 ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]" :
                              "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]"
                            }`}>{idx + 1}</span>
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">{stat.user.full_name}</p>
                              <div className="mt-1 w-24">
                                <MiniBar value={stat.totalHours} max={maxEmpHours} color="bg-[var(--primary)]" />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[var(--primary)] text-base">{formatDecimalHours(stat.totalHours)}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">{stat.totalSeconds.toLocaleString("id")} dtk</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[var(--text-primary)]">{stat.workDays}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">hari</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[var(--text-primary)]">{formatDecimalHours(stat.avgHoursPerDay)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[var(--text-primary)]">{stat.taskCount}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">entri</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-[var(--text-primary)]">{formatRupiah(stat.estimatedPay)}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">estimasi</p>
                        </td>
                        <td className="px-4 py-4">
                          {stat.bonusEligible ? (
                            <span className="inline-flex items-center gap-1 bg-[var(--primary-soft)] text-[var(--primary)] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[var(--primary)]/30">
                              🎉 Bonus Met
                            </span>
                          ) : (
                            <div>
                              <span className="text-[11px] text-[var(--text-secondary)]">
                                Sisa {(DEFAULT_BONUS_THRESHOLD_HOURS - stat.totalHours).toFixed(1)}j
                              </span>
                              <div className="mt-1 w-20">
                                <MiniBar
                                  value={stat.totalHours}
                                  max={DEFAULT_BONUS_THRESHOLD_HOURS}
                                  color="bg-amber-300"
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {stat.loggedToday ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-teal)] font-semibold bg-[var(--accent-teal-soft)] px-2.5 py-1 rounded-full border border-[var(--accent-teal)]/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)]" />
                              Sudah Input
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-300/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Belum Input
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PER AKUN KLIEN
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "account" && (
          <div className="relative">
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
              {/* Header + Filter Periode */}
              <div className="px-6 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">Total Jam per Akun Klien</h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Klik baris untuk lihat detail per karyawan
                  </p>
                </div>
                {/* Periode toggle */}
                <div className="flex gap-1 p-1 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)]">
                  {(["today", "week", "month"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAccountPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountPeriod === p
                          ? "bg-[var(--primary)] text-white shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {p === "today" ? "Hari Ini" : p === "week" ? "Minggu Ini" : "Bulan Ini"}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Memuat data...</div>
              ) : filteredAccountStats.length === 0 ? (
                <EmptyState
                  icon="🏢"
                  title="Belum Ada Akun Klien"
                  description={`Belum ada pengerjaan task untuk akun klien ${accountPeriod === "today" ? "hari ini" : accountPeriod === "week" ? "minggu ini" : "bulan ini"}.`}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                      <tr className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-3">Akun / Klien</th>
                        <th className="px-4 py-3">Total Jam</th>
                        <th className="px-4 py-3">Total Task</th>
                        <th className="px-4 py-3">Employee Terlibat</th>
                        <th className="px-4 py-3">% dari Total Tim</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredAccountStats.map((acc) => {
                        const totalFiltered = filteredAccountStats.reduce((s, a) => s + a.totalHours, 0);
                        const pct = totalFiltered > 0 ? (acc.totalHours / totalFiltered) * 100 : 0;
                        const isSelected = selectedAccountDrill?.account.id === acc.account.id;
                        return (
                          <tr
                            key={acc.account.id}
                            onClick={() => setSelectedAccountDrill(isSelected ? null : acc)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-[var(--primary-soft)] border-l-2 border-[var(--primary)]"
                                : "hover:bg-[var(--bg-surface-alt)]/50"
                            }`}
                          >
                            <td className="px-6 py-4">
                              <p className="font-bold text-[var(--text-primary)]">{acc.account.name}</p>
                              {acc.account.language && (
                                <p className="text-[11px] text-[var(--text-secondary)]">{acc.account.language}</p>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-[var(--accent-teal)] text-base">{formatDecimalHours(acc.totalHours)}</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[var(--text-primary)]">{acc.taskCount}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">entri</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[var(--text-primary)]">{acc.employeeSet.size}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">karyawan</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-[var(--text-primary)]">{pct.toFixed(1)}%</p>
                                <MiniBar value={acc.totalHours} max={filteredAccountStats[0]?.totalHours ?? 1} color="bg-[var(--accent-teal)]" />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-xs font-bold text-[var(--primary)]">
                                {isSelected ? "✕ Tutup" : "Detail →"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Side Panel Drill-down ─────────────────────────────────────── */}
            {selectedAccountDrill && (() => {
              const empBreakdown = getAccountEmployeeBreakdown(selectedAccountDrill);
              const totalAccSecs = empBreakdown.reduce((s, e) => s + e.seconds, 0);
              return (
                <div className="mt-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--primary)]/30 shadow-md overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                  {/* Panel Header */}
                  <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--primary-soft)] flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--primary)]">
                        🏢 {selectedAccountDrill.account.name}
                        {selectedAccountDrill.account.language && (
                          <span className="ml-1.5 font-normal text-[var(--text-secondary)] text-xs">
                            ({selectedAccountDrill.account.language})
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Breakdown per karyawan ·{" "}
                        {accountPeriod === "today" ? "Hari Ini" : accountPeriod === "week" ? "Minggu Ini" : "Bulan Ini"}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedAccountDrill(null)}
                      className="w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Panel Body */}
                  {empBreakdown.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--text-secondary)]">Belum ada data pada periode ini.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                          <tr className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            <th className="px-6 py-3">Karyawan</th>
                            <th className="px-4 py-3">Total Jam</th>
                            <th className="px-4 py-3">Total Task</th>
                            <th className="px-4 py-3">% dari Akun</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {empBreakdown.map((emp, idx) => {
                            const pct = totalAccSecs > 0 ? (emp.seconds / totalAccSecs) * 100 : 0;
                            return (
                              <tr key={emp.name + idx} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                      idx === 0 ? "bg-[var(--primary-soft)] text-[var(--primary)]" :
                                      idx === 1 ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]" :
                                      "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]"
                                    }`}>{idx + 1}</span>
                                    <p className="font-semibold text-[var(--text-primary)]">{emp.name}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-bold text-[var(--primary)]">{formatDecimalHours(emp.seconds / 3600)}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-[var(--text-primary)]">{emp.taskCount}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-bold">{pct.toFixed(1)}%</p>
                                    <MiniBar value={emp.seconds} max={empBreakdown[0]?.seconds ?? 1} color="bg-[var(--primary)]" />
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
              );
            })()}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PER JENIS TASK
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tasktype" && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Total Jam per Jenis Task</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Bulan ini · semua karyawan · diurutkan terbanyak</p>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Memuat data...</div>
            ) : taskTypeStats.length === 0 ? (
              <EmptyState
                icon="📋"
                title="Belum Ada Jenis Task"
                description="Belum ada catatan jenis task bulan ini."
              />
            ) : (
              <div className="p-6 space-y-4">
                {taskTypeStats.map((tt) => {
                  const pct = totalTeamHours > 0 ? (tt.totalHours / totalTeamHours) * 100 : 0;
                  const COLORS = ["bg-[var(--primary)]", "bg-[var(--accent-teal)]", "bg-amber-500", "bg-blue-500", "bg-purple-500"];
                  const colorIdx = taskTypeStats.indexOf(tt) % COLORS.length;
                  return (
                    <div key={tt.taskType.id} className="space-y-2.5 p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${COLORS[colorIdx]}`} />
                          <p className="font-bold text-[var(--text-primary)]">{tt.taskType.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-[var(--text-primary)]">{formatDecimalHours(tt.totalHours)}</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">{pct.toFixed(1)}% dari total</p>
                        </div>
                      </div>
                      <MiniBar value={tt.totalHours} max={totalTeamHours} color={COLORS[colorIdx]} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: HARIAN (Unified Date Picker & Rekap Card)
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "daily" && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
            {/* Combined Header with Date Selector */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface-alt)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Rekap Pekerjaan Harian</h2>
                <p className="text-[11px] text-[var(--text-secondary)]">Pilih tanggal untuk melihat rincian aktivitas tim</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-2xs"
                />
                <button
                  onClick={() => fetchDateSessions(selectedDate)}
                  className="text-xs text-[var(--text-primary)] font-semibold px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-surface-alt)] rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🔄</span> Refresh
                </button>
              </div>
            </div>

            {/* Table / Empty State */}
            {dateLoading ? (
              <div className="py-16 text-center text-xs text-[var(--text-secondary)]">Memuat data harian...</div>
            ) : dateSessions.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Belum Ada Sesi Kerja"
                description={`Belum ada karyawan yang menginput sesi kerja pada tanggal ${selectedDate}.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
                    <tr className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      <th className="px-6 py-3">Karyawan</th>
                      <th className="px-4 py-3">Total Jam</th>
                      <th className="px-4 py-3">Task</th>
                      <th className="px-4 py-3">Rincian</th>
                      <th className="px-4 py-3">Bukti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {dateSessions.map((session) => {
                      const secs = (session.task_entries || []).reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
                      return (
                        <tr key={session.id} className="hover:bg-[var(--bg-surface-alt)]/50">
                          <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                            {session.user?.full_name || "Karyawan"}
                          </td>
                          <td className="px-4 py-4 font-bold text-[var(--primary)]">
                            {formatDecimalHours(secs / 3600)}
                          </td>
                          <td className="px-4 py-4 text-xs text-[var(--text-secondary)]">
                            {(session.task_entries || []).length}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {(session.task_entries || []).map((e, idx) => (
                                <span key={e.id || idx} className="inline-block bg-[var(--bg-surface-alt)] px-2 py-0.5 rounded text-[11px] font-medium text-[var(--text-primary)] border border-[var(--border)]">
                                  {e.client_account?.name} · {e.task_type?.name} ({formatDecimalHours((e.duration_seconds || 0) / 3600)})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs">
                            {session.proof_type === "photo" && session.proof_url ? (
                              <a href={session.proof_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--bg-surface-alt)] text-[var(--text-primary)] hover:bg-[var(--primary-soft)] rounded-lg font-medium border border-[var(--border)] transition-colors text-[11px]">
                                📷 Lihat Bukti
                              </a>
                            ) : session.proof_note ? (
                              <div className="p-2 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border)] text-[var(--text-secondary)] italic max-w-xs text-[11px]">
                                &ldquo;{session.proof_note}&rdquo;
                              </div>
                            ) : (
                              <span className="text-[var(--text-secondary)] font-medium text-[11px]">Belum upload</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


      {/* Day Detail Modal for Calendar Tab */}
      {selectedCalendarDay && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedCalendarDay(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {new Date(selectedCalendarDay.date + "T00:00:00").toLocaleDateString("id-ID", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  <span className="font-bold text-[var(--accent-teal)]">{formatDecimalHours(selectedCalendarDay.data.totalSeconds / 3600)}</span>
                  {" total · "}
                  {selectedCalendarDay.data.employeeCount} karyawan aktif
                </p>
              </div>
              <button
                onClick={() => setSelectedCalendarDay(null)}
                className="w-7 h-7 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Toggle Mode */}
            <div className="flex gap-1 p-1 bg-[var(--bg-surface-alt)] rounded-xl mb-4 border border-[var(--border)]">
              {(["account", "employee"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setCalDashGroupMode(mode); setCollapsedDashCalGroups(new Set()); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    calDashGroupMode === mode
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {mode === "account" ? "🏢 Per Akun" : "👤 Per Karyawan"}
                </button>
              ))}
            </div>

            {/* Grouped Content */}
            <div className="space-y-2">
              {(() => {
                const allEntries = selectedCalendarDay.data.sessions.flatMap(s =>
                  (s.task_entries || []).map(e => ({ ...e, session: s }))
                );

                if (calDashGroupMode === "account") {
                  const groupMap = new Map<string, {
                    clientId: string; clientName: string; clientLanguage?: string | null;
                    totalSeconds: number; taskCount: number;
                    employeeSubs: Map<string, { name: string; seconds: number; taskCount: number }>;
                  }>();
                  for (const entry of allEntries) {
                    const key = entry.client_account_id || "unknown";
                    const empId = entry.session.user_id;
                    const empName = entry.session.user?.full_name || "Karyawan";
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
                      groupMap.set(key, { clientId: key, clientName: entry.client_account?.name || "—", clientLanguage: entry.client_account?.language, totalSeconds: entry.duration_seconds || 0, taskCount: 1, employeeSubs: empSubs });
                    }
                  }
                  return Array.from(groupMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds).map((grp) => {
                    const isOpen = !collapsedDashCalGroups.has(grp.clientId);
                    return (
                      <div key={grp.clientId} className="border border-[var(--border)] rounded-xl overflow-hidden">
                        <button type="button" onClick={() => setCollapsedDashCalGroups(prev => { const n = new Set(prev); if (n.has(grp.clientId)) n.delete(grp.clientId); else n.add(grp.clientId); return n; })}
                          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface-alt)]/80 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-left">
                            <span className="text-sm">{isOpen ? "▾" : "▸"}</span>
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)]">
                                {grp.clientName}{grp.clientLanguage && <span className="ml-1 font-normal text-[var(--text-secondary)]">({grp.clientLanguage})</span>}
                              </p>
                              <p className="text-[10px] text-[var(--text-secondary)]">{grp.taskCount} task · {grp.employeeSubs.size} karyawan</p>
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-[var(--primary)] shrink-0 ml-2">{formatDecimalHours(grp.totalSeconds / 3600)}</span>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-[var(--border)]">
                            {Array.from(grp.employeeSubs.values()).sort((a, b) => b.seconds - a.seconds).map((emp) => (
                              <div key={emp.name} className="flex items-center justify-between px-5 py-2 bg-[var(--bg-surface)]/60">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] shrink-0" />
                                  <p className="text-xs text-[var(--text-secondary)] font-medium">{emp.name}</p>
                                  <span className="text-[10px] text-[var(--text-secondary)]">{emp.taskCount} task</span>
                                </div>
                                <span className="text-xs font-bold text-[var(--text-primary)]">{formatDecimalHours(emp.seconds / 3600)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                } else {
                  const empMap = new Map<string, {
                    empId: string; empName: string; totalSeconds: number; taskCount: number;
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
                      const cs = existing.clientSubs.get(clientKey);
                      if (cs) { cs.seconds += entry.duration_seconds || 0; cs.taskCount += 1; }
                      else existing.clientSubs.set(clientKey, { name: entry.client_account?.name || "—", lang: entry.client_account?.language, seconds: entry.duration_seconds || 0, taskCount: 1 });
                    } else {
                      const clientSubs = new Map<string, { name: string; lang?: string | null; seconds: number; taskCount: number }>();
                      clientSubs.set(clientKey, { name: entry.client_account?.name || "—", lang: entry.client_account?.language, seconds: entry.duration_seconds || 0, taskCount: 1 });
                      empMap.set(empId, { empId, empName, totalSeconds: entry.duration_seconds || 0, taskCount: 1, clientSubs });
                    }
                  }
                  return Array.from(empMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds).map((grp) => {
                    const isOpen = !collapsedDashCalGroups.has(grp.empId);
                    return (
                      <div key={grp.empId} className="border border-[var(--border)] rounded-xl overflow-hidden">
                        <button type="button" onClick={() => setCollapsedDashCalGroups(prev => { const n = new Set(prev); if (n.has(grp.empId)) n.delete(grp.empId); else n.add(grp.empId); return n; })}
                          className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface-alt)]/80 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-left">
                            <span className="text-sm">{isOpen ? "▾" : "▸"}</span>
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)]">{grp.empName}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">{grp.taskCount} task</p>
                            </div>
                          </div>
                          <span className="text-sm font-extrabold text-[var(--primary)] shrink-0 ml-2">{formatDecimalHours(grp.totalSeconds / 3600)}</span>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-[var(--border)]">
                            {Array.from(grp.clientSubs.values()).sort((a, b) => b.seconds - a.seconds).map((cl) => (
                              <div key={cl.name} className="flex items-center justify-between px-5 py-2 bg-[var(--bg-surface)]/60">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border)] shrink-0" />
                                  <p className="text-xs text-[var(--text-secondary)] font-medium">{cl.name}{cl.lang && <span className="ml-1 text-[var(--text-secondary)]">({cl.lang})</span>}</p>
                                  <span className="text-[10px] text-[var(--text-secondary)]">{cl.taskCount} task</span>
                                </div>
                                <span className="text-xs font-bold text-[var(--text-primary)]">{formatDecimalHours(cl.seconds / 3600)}</span>
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
