"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDecimalHours } from "@/lib/utils";
import { exportPayrollToExcel, exportPayrollToPDF } from "@/lib/utils/export";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import {
  DEFAULT_SALARY_TIERS,
  DEFAULT_BONUS_THRESHOLD_HOURS,
  DEFAULT_BONUS_AMOUNT,
  ROUTES,
} from "@/constants";
import type { User, SalaryTier, BonusRule, PayrollResult } from "@/types";

// ─── Date helpers (timezone-safe: no toISOString()) ─────────────────────────
function padZ(n: number) { return String(n).padStart(2, "0"); }

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${padZ(date.getMonth() + 1)}-${padZ(date.getDate())}`;
}

function getPayrollPeriod(referenceDate: Date = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  if (day >= 15) {
    // 15th this month → 14th next month
    const endMonth = month === 11 ? 0 : month + 1;
    const endYear  = month === 11 ? year + 1 : year;
    return {
      start: `${year}-${padZ(month + 1)}-15`,
      end:   `${endYear}-${padZ(endMonth + 1)}-14`,
    };
  } else {
    // 15th last month → 14th this month
    const startMonth = month === 0 ? 11 : month - 1;
    const startYear  = month === 0 ? year - 1 : year;
    return {
      start: `${startYear}-${padZ(startMonth + 1)}-15`,
      end:   `${year}-${padZ(month + 1)}-14`,
    };
  }
}

function getPayrollPeriodLabel(start: string, end: string): string {
  const MONTH = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return `${sd} ${MONTH[sm - 1]} ${sy} — ${ed} ${MONTH[em - 1]} ${ey}`;
}

// ─── Payroll computation ─────────────────────────────────────────────────────
interface TierLike { min_hours: number; max_hours: number | null; rate_per_hour: number; }

function getRate(hours: number, tiers: TierLike[]): number {
  const sorted = [...tiers].sort((a, b) => a.min_hours - b.min_hours);
  let rate = sorted[0]?.rate_per_hour ?? DEFAULT_SALARY_TIERS[0].rate_per_hour;
  for (const t of sorted) {
    if (hours >= t.min_hours && (t.max_hours === null || hours <= t.max_hours)) {
      rate = t.rate_per_hour; break;
    }
  }
  return rate;
}

interface DaySession { date: string; taskEntries: { duration_seconds: number }[]; }

function computePayroll(
  sessions: DaySession[], tiers: TierLike[], bonusThreshold: number, bonusAmount: number
) {
  let basePay = 0, totalHours = 0, bonusPay = 0;
  const weeklyDetails: { weekLabel: string; hours: number; bonus: number }[] = [];
  const MONTH = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

  const weekMap = new Map<string, DaySession[]>();
  for (const s of sessions) {
    const date = new Date(s.date + "T00:00:00");
    const dow = date.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    const weekKey = localDateStr(monday);
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
    weekMap.get(weekKey)!.push(s);
  }

  for (const [monStr, ws] of Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    let weekHours = 0;
    for (const s of ws) {
      const secs = s.taskEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
      const hrs = secs / 3600;
      weekHours += hrs; totalHours += hrs;
      basePay += Math.round(hrs * getRate(hrs, tiers));
    }
    const weekBonus = weekHours >= bonusThreshold ? bonusAmount : 0;
    bonusPay += weekBonus;
    const mon = new Date(monStr + "T00:00:00");
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const weekLabel = `${mon.getDate()} ${MONTH[mon.getMonth()]} – ${sun.getDate()} ${MONTH[sun.getMonth()]}`;
    weeklyDetails.push({ weekLabel, hours: weekHours, bonus: weekBonus });
  }

  return { basePay, bonusPay, totalHours, weeklyDetails };
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExtendedPayrollResult extends PayrollResult {
  weeklyDetails: { weekLabel: string; hours: number; bonus: number }[];
  dbRecordId?: string;
  proofUrl?: string | null;
  proofNote?: string | null;
}

interface PaymentProofModal {
  empId: string;
  empName: string;
  totalPay: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PayrollPage() {
  const router = useRouter();
  const initialPeriod = getPayrollPeriod();
  const [startDate, setStartDate] = useState(initialPeriod.start);
  const [endDate, setEndDate] = useState(initialPeriod.end);
  const [payrollResults, setPayrollResults] = useState<ExtendedPayrollResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Payment proof modal state
  const [proofModal, setProofModal] = useState<PaymentProofModal | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculatePayroll = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(ROUTES.LOGIN); return; }

      const [empRes, sessionsRes, tiersRes, bonusRes, payrollRecordsRes] = await Promise.all([
        supabase.from("users").select("*").eq("role", "employee").order("full_name"),
        supabase.from("work_sessions").select("*, task_entries(*)")
          .gte("session_date", startDate).lte("session_date", endDate),
        supabase.from("salary_tiers").select("*").order("min_hours").order("effective_from", { ascending: false }),
        supabase.from("bonus_rules").select("*").order("effective_from", { ascending: false }),
        supabase.from("payroll_records").select("*")
          .gte("period_start", startDate).lte("period_end", endDate),
      ]);

      const employees: User[] = empRes.data || [];
      const sessions = sessionsRes.data || [];

      const allTiers: SalaryTier[] = tiersRes.data || [];
      let activeTiers: TierLike[] = DEFAULT_SALARY_TIERS;
      if (allTiers.length > 0) {
        const latestDate = allTiers.reduce((max, t) => t.effective_from > max ? t.effective_from : max, allTiers[0].effective_from);
        const filtered = allTiers.filter(t => t.effective_from === latestDate);
        if (filtered.length > 0) activeTiers = filtered;
      }

      const bonusRules: BonusRule[] = bonusRes.data?.length
        ? bonusRes.data
        : [{ id: "b-default", min_weekly_hours: DEFAULT_BONUS_THRESHOLD_HOURS, bonus_amount: DEFAULT_BONUS_AMOUNT, effective_from: "2026-01-01" }];

      const { min_weekly_hours: bonusThreshold, bonus_amount: bonusAmount } = bonusRules[0];

      const existingRecords: Record<string, { id: string; payment_status: string; proof_url?: string; proof_note?: string }> = {};
      (payrollRecordsRes.data || []).forEach((r) => {
        existingRecords[r.user_id] = { id: r.id, payment_status: r.payment_status, proof_url: r.proof_url, proof_note: r.proof_note };
      });

      const results: ExtendedPayrollResult[] = employees.map((emp) => {
        const empSessions = sessions.filter(s => s.user_id === emp.id);
        const daySessions: DaySession[] = empSessions.map(s => ({ date: s.session_date, taskEntries: s.task_entries || [] }));
        const { basePay, bonusPay, totalHours, weeklyDetails } = computePayroll(daySessions, activeTiers, bonusThreshold, bonusAmount);
        const rec = existingRecords[emp.id];
        return {
          user: emp,
          period_start: startDate,
          period_end: endDate,
          total_hours: Math.round(totalHours * 100) / 100,
          applied_tier: null,
          base_pay: basePay,
          bonus_pay: bonusPay,
          total_pay: basePay + bonusPay,
          payment_status: (rec?.payment_status ?? "unpaid") as "paid" | "unpaid",
          weeklyDetails,
          dbRecordId: rec?.id,
          proofUrl: rec?.proof_url,
          proofNote: rec?.proof_note,
        };
      });

      setPayrollResults(results);
    } catch (err) {
      console.error("Payroll calc error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, router]);

  useEffect(() => { calculatePayroll(); }, [calculatePayroll]);

  // Open proof modal (only for unpaid → paid transition)
  const openProofModal = (empId: string) => {
    const item = payrollResults.find(r => r.user.id === empId);
    if (!item) return;
    if (item.payment_status === "paid") {
      // Already paid → allow toggle back to unpaid directly
      handleMarkUnpaid(empId);
      return;
    }
    setProofModal({ empId, empName: item.user.full_name, totalPay: item.total_pay });
    setProofFile(null);
    setProofNote("");
    setUploadError("");
  };

  const handleMarkUnpaid = async (empId: string) => {
    const item = payrollResults.find(r => r.user.id === empId);
    if (!item?.dbRecordId) return;
    setIsSaving(empId);
    try {
      const supabase = createClient();
      await supabase.from("payroll_records")
        .update({ payment_status: "unpaid", paid_at: null })
        .eq("id", item.dbRecordId);
      setPayrollResults(prev => prev.map(r => r.user.id === empId ? { ...r, payment_status: "unpaid" } : r));
    } finally { setIsSaving(null); }
  };

  const handleConfirmPayment = async () => {
    if (!proofModal) return;
    const { empId } = proofModal;
    const item = payrollResults.find(r => r.user.id === empId);
    if (!item) return;

    if (!proofFile && !proofNote.trim()) {
      setUploadError("Upload bukti transfer atau isi catatan pembayaran terlebih dahulu.");
      return;
    }

    setIsSaving(empId);
    setUploadError("");
    try {
      const supabase = createClient();
      let uploadedUrl: string | null = null;

      if (proofFile) {
        const ext = proofFile.name.split(".").pop();
        const filePath = `payroll/${empId}/${startDate}_to_${endDate}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(filePath, proofFile, { upsert: true });
        if (uploadError) {
          // If storage bucket not configured, store note only
          console.warn("Storage upload failed, storing note only:", uploadError.message);
        } else {
          const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(filePath);
          uploadedUrl = urlData.publicUrl;
        }
      }

      const paidAt = new Date().toISOString();
      const noteToSave = proofNote.trim() || null;

      if (item.dbRecordId) {
        let updatePayload: Record<string, unknown> = {
          payment_status: "paid",
          paid_at: paidAt,
          proof_url: uploadedUrl,
          proof_note: noteToSave,
        };

        let { error: saveErr } = await supabase.from("payroll_records")
          .update(updatePayload)
          .eq("id", item.dbRecordId);

        // Fallback without proof columns if column doesn't exist in DB schema yet
        if (saveErr && (saveErr.code === "PGRST204" || saveErr.message?.includes("proof_"))) {
          console.warn("Falling back to basic payment status update without proof columns");
          const { error: fbErr } = await supabase.from("payroll_records")
            .update({ payment_status: "paid", paid_at: paidAt })
            .eq("id", item.dbRecordId);
          saveErr = fbErr;
        }

        if (saveErr) {
          console.error("Save payroll record error:", saveErr);
          setUploadError("Gagal menyimpan ke database: " + saveErr.message);
          return;
        }
      } else {
        let upsertPayload: Record<string, unknown> = {
          user_id: empId,
          period_start: item.period_start,
          period_end: item.period_end,
          total_hours: item.total_hours,
          base_pay: item.base_pay,
          bonus_pay: item.bonus_pay,
          total_pay: item.total_pay,
          payment_status: "paid",
          paid_at: paidAt,
          proof_url: uploadedUrl,
          proof_note: noteToSave,
        };

        let { data, error: saveErr } = await supabase.from("payroll_records")
          .upsert(upsertPayload, { onConflict: "user_id,period_start,period_end" })
          .select().single();

        // Fallback without proof columns if column doesn't exist in DB schema yet
        if (saveErr && (saveErr.code === "PGRST204" || saveErr.message?.includes("proof_"))) {
          console.warn("Falling back to basic payment status upsert without proof columns");
          delete upsertPayload.proof_url;
          delete upsertPayload.proof_note;
          const { data: fbData, error: fbErr } = await supabase.from("payroll_records")
            .upsert(upsertPayload, { onConflict: "user_id,period_start,period_end" })
            .select().single();
          data = fbData;
          saveErr = fbErr;
        }

        if (saveErr) {
          console.error("Upsert payroll record error:", saveErr);
          setUploadError("Gagal menyimpan ke database: " + saveErr.message);
          return;
        }

        if (data) {
          setPayrollResults(prev => prev.map(r => r.user.id === empId ? { ...r, dbRecordId: data.id } : r));
        }
      }

      setPayrollResults(prev => prev.map(r =>
        r.user.id === empId ? { ...r, payment_status: "paid", proofUrl: uploadedUrl, proofNote: noteToSave } : r
      ));
      setProofModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.";
      console.error("Payment confirm error:", err);
      setUploadError(msg);
    } finally { setIsSaving(null); }
  };

  const totalPeriodPayout = payrollResults.reduce((acc, curr) => acc + curr.total_pay, 0);
  const totalUnpaid = payrollResults.filter(r => r.payment_status === "unpaid").reduce((acc, r) => acc + r.total_pay, 0);
  const periodLabel = useMemo(() => getPayrollPeriodLabel(startDate, endDate), [startDate, endDate]);

  const jumpToPeriod = (direction: "prev" | "next") => {
    const [sy, sm] = startDate.split("-").map(Number);
    const newMonth = direction === "prev" ? sm - 2 : sm; // sm is 1-based, so sm-2 goes back 1 month
    const refYear = newMonth < 0 ? sy - 1 : newMonth > 11 ? sy + 1 : sy;
    const refMonth = ((newMonth % 12) + 12) % 12;
    const refDate = new Date(refYear, refMonth, 20); // Day 20 → safely in second half
    if (direction === "prev") refDate.setDate(1); // Day 1 → first half of that month → period starts 15th prev month
    const period = getPayrollPeriod(refDate);
    setStartDate(period.start);
    setEndDate(period.end);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-12 transition-colors duration-200">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4 sticky top-0 z-10 transition-colors shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo variant="icon" size="md" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Laporan Payroll</h1>
              <p className="text-xs text-[var(--text-secondary)]">Gaji Pokok & Bonus Mingguan · Dibayar setiap tanggal 15</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold overflow-x-auto border border-[var(--border)]">
              <Link href={ROUTES.OWNER_DASHBOARD} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
              <Link href={ROUTES.OWNER_PAYROLL} className="px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30">Payroll</Link>
              <Link href={ROUTES.OWNER_MASTER_DATA} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Master Data</Link>
              <Link href={ROUTES.OWNER_USERS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">User</Link>
              <Link href={ROUTES.OWNER_ASSESSMENT} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Assessment</Link>
              <Link href={ROUTES.OWNER_SETTINGS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Settings</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {/* Period Selector */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Periode Pembayaran</p>
                <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">📅 {periodLabel}</p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Gaji dibayarkan setiap tanggal 15</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => jumpToPeriod("prev")} className="px-3 py-1.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer">← Periode Lalu</button>
                <button onClick={() => { const p = getPayrollPeriod(); setStartDate(p.start); setEndDate(p.end); }} className="px-3 py-1.5 bg-[var(--primary-soft)] text-[var(--primary)] hover:brightness-95 rounded-lg text-xs font-bold transition-colors cursor-pointer">Periode Ini</button>
                <button onClick={() => jumpToPeriod("next")} className="px-3 py-1.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer">Periode Depan →</button>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Dari:</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase">Sampai:</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => exportPayrollToExcel(payrollResults, startDate, endDate)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer">📊 Excel</button>
              <button onClick={() => exportPayrollToPDF(payrollResults, startDate, endDate)} className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer">📄 PDF</button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] rounded-2xl p-5 text-white shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Total Payout</p>
            <p className="text-2xl font-bold mt-1">{formatRupiah(totalPeriodPayout)}</p>
            <p className="text-[11px] text-white/80 mt-0.5">{payrollResults.length} karyawan</p>
          </div>
          <div className={`rounded-2xl p-5 shadow-xs border ${totalUnpaid > 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" : "bg-[var(--bg-surface)] border-[var(--border)]"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Belum Dibayar</p>
            <p className={`text-2xl font-bold mt-1 ${totalUnpaid > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-primary)]"}`}>{formatRupiah(totalUnpaid)}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{payrollResults.filter(r => r.payment_status === "unpaid").length} tanggungan</p>
          </div>
          <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Sudah Dibayar</p>
            <p className="text-2xl font-bold text-[var(--accent-teal)] mt-1">{formatRupiah(totalPeriodPayout - totalUnpaid)}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{payrollResults.filter(r => r.payment_status === "paid").length} karyawan</p>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Rincian per Karyawan</h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Klik baris untuk detail bonus mingguan · Klik &quot;Belum Bayar&quot; untuk upload bukti pembayaran</p>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Menghitung payroll...</div>
          ) : payrollResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Tidak ada data untuk periode ini.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {payrollResults.map((item) => (
                <div key={item.user.id}>
                  <div
                    className={`px-6 py-4 cursor-pointer transition-colors ${expandedRow === item.user.id ? "bg-[var(--bg-surface-alt)]" : "hover:bg-[var(--bg-surface-alt)]/50"}`}
                    onClick={() => setExpandedRow(expandedRow === item.user.id ? null : item.user.id)}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 min-w-[160px]">
                        <span className="text-[10px] text-[var(--text-secondary)]">{expandedRow === item.user.id ? "▲" : "▼"}</span>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{item.user.full_name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">{item.total_hours} jam kerja</p>
                          {item.user.bank_account_number ? (
                            <span className="inline-block mt-1 text-[11px] font-medium text-[var(--accent-teal)] bg-[var(--accent-teal-soft)] px-2 py-0.5 rounded-md border border-[var(--accent-teal)]/30">
                              💳 {item.user.bank_name || "Bank"}: <span className="font-mono font-bold">{item.user.bank_account_number}</span> ({item.user.bank_account_holder || item.user.full_name})
                            </span>
                          ) : (
                            <span className="inline-block mt-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              ⚠️ Belum isi no. rekening
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-6 ml-4 flex-1">
                        <div>
                          <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">Gaji Pokok</p>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{formatRupiah(item.base_pay)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">Bonus</p>
                          <p className={`text-sm font-semibold ${item.bonus_pay > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-secondary)]"}`}>
                            {item.bonus_pay > 0 ? `+${formatRupiah(item.bonus_pay)}` : "Rp 0"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">Total</p>
                          <p className="text-base font-bold text-[var(--primary)]">{formatRupiah(item.total_pay)}</p>
                        </div>
                      </div>

                      {/* Payment status button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openProofModal(item.user.id); }}
                        disabled={isSaving === item.user.id}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                          item.payment_status === "paid"
                            ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30 hover:brightness-95"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                        } disabled:opacity-50`}
                      >
                        {isSaving === item.user.id ? "⏳ Menyimpan..." : item.payment_status === "paid" ? "✓ PAID" : "⏳ Belum Bayar"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedRow === item.user.id && (
                    <div className="px-6 pb-5 bg-[var(--bg-surface-alt)] border-t border-[var(--border)]">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-3 mb-2">🗓️ Rincian Bonus per Minggu</p>
                      <div className="space-y-2 mb-3">
                        {item.weeklyDetails.map((week, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
                            <div>
                              <p className="text-xs font-semibold text-[var(--text-primary)]">{week.weekLabel}</p>
                              <p className="text-[11px] text-[var(--text-secondary)]">{formatDecimalHours(week.hours)}</p>
                            </div>
                            {week.bonus > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                                🎉 +{formatRupiah(week.bonus)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[var(--text-secondary)] opacity-60">Tidak ada bonus</span>
                            )}
                          </div>
                        ))}
                        {item.weeklyDetails.length === 0 && <p className="text-xs text-[var(--text-secondary)] py-2">Tidak ada catatan kerja.</p>}
                      </div>

                      {/* Proof info (if paid) */}
                      {item.payment_status === "paid" && (item.proofUrl || item.proofNote) && (
                        <div className="p-3 bg-[var(--accent-teal-soft)] rounded-xl border border-[var(--accent-teal)]/30">
                          <p className="text-[10px] font-bold text-[var(--accent-teal)] uppercase tracking-wider mb-1">📋 Bukti Pembayaran</p>
                          {item.proofNote && <p className="text-xs text-[var(--text-primary)] italic">"{item.proofNote}"</p>}
                          {item.proofUrl && (
                            <a href={item.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent-teal)] font-semibold hover:underline mt-1 inline-flex items-center gap-1">
                              🖼 Lihat Bukti Transfer
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Payment Proof Modal ───────────────────────────────────────────── */}
      {proofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setProofModal(null)}>
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-200">Konfirmasi Pembayaran</p>
              <h3 className="text-lg font-bold mt-0.5">{proofModal.empName}</h3>
              <p className="text-2xl font-bold text-teal-100 mt-1">{formatRupiah(proofModal.totalPay)}</p>
              <p className="text-[11px] text-teal-300 mt-0.5">Periode: {getPayrollPeriodLabel(startDate, endDate)}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Bank Account Info Card */}
              {(() => {
                const targetEmp = payrollResults.find(r => r.user.id === proofModal.empId)?.user;
                return targetEmp?.bank_account_number ? (
                  <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 space-y-1">
                    <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">💳 Rekening Tujuan Transfer</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {targetEmp.bank_name || "Bank"} — <span className="font-mono text-sm">{targetEmp.bank_account_number}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">a.n. {targetEmp.bank_account_holder || targetEmp.full_name}</p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    ⚠️ Karyawan ini belum mengisi nomor rekening bank di menu Profil.
                  </div>
                );
              })()}

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Upload bukti transfer atau isi catatan pembayaran untuk menandai gaji ini sebagai PAID.
              </p>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">📎 Bukti Transfer (Foto/PDF)</label>
                <div
                  className="relative border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-teal-400 dark:hover:border-teal-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {proofFile ? (
                    <div className="flex items-center gap-2 justify-center">
                      <span className="text-2xl">{proofFile.type.startsWith("image") ? "🖼" : "📄"}</span>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{proofFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(proofFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setProofFile(null); }}
                        className="ml-auto text-slate-300 hover:text-red-500 text-xs"
                      >✕</button>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl mb-1">📂</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Klik untuk pilih foto atau PDF bukti transfer</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => setProofFile(e.target.files?.[0] || null)}
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">📝 Catatan Pembayaran</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Transfer BCA 29 Jul 2026, ref #123456"
                  value={proofNote}
                  onChange={e => setProofNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{uploadError}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setProofModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={isSaving === proofModal.empId}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50"
                >
                  {isSaving === proofModal.empId ? "Menyimpan..." : "✓ Tandai PAID"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
