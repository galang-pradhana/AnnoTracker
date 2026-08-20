"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDecimalHours, getPayrollPeriod, getPayrollPeriodLabel } from "@/lib/utils";
import { DEFAULT_SALARY_TIERS, DEFAULT_BONUS_THRESHOLD_HOURS, DEFAULT_BONUS_AMOUNT } from "@/constants";
import type { WorkSessionWithEntries } from "@/types";

export default function MyEarningsPage() {
  const initialPeriod = useMemo(() => getPayrollPeriod(), []);
  const [startDate, setStartDate] = useState(initialPeriod.start);
  const [endDate, setEndDate] = useState(initialPeriod.end);
  const [sessions, setSessions] = useState<WorkSessionWithEntries[]>([]);
  const [paymentRecord, setPaymentRecord] = useState<{ payment_status: string; proof_url?: string; proof_note?: string; paid_at?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyEarnings = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return;

      const [sessionsRes, payrollRes] = await Promise.all([
        supabase
          .from("work_sessions")
          .select("*, task_entries(*, client_account:client_accounts(*), task_type:task_types(*))")
          .eq("user_id", userId)
          .gte("session_date", startDate)
          .lte("session_date", endDate)
          .order("session_date", { ascending: false }),

        supabase
          .from("payroll_records")
          .select("*")
          .eq("user_id", userId)
          .gte("period_start", startDate)
          .lte("period_end", endDate)
          .maybeSingle(),
      ]);

      if (sessionsRes.data) {
        setSessions(sessionsRes.data as unknown as WorkSessionWithEntries[]);
      } else {
        setSessions([]);
      }

      if (payrollRes.data) {
        setPaymentRecord(payrollRes.data);
      } else {
        setPaymentRecord(null);
      }
    } catch (err) {
      console.error("Error fetching employee earnings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchMyEarnings();
  }, [fetchMyEarnings]);

  const jumpToPeriod = (direction: "prev" | "next") => {
    const [sy, sm] = startDate.split("-").map(Number);
    const newMonth = direction === "prev" ? sm - 2 : sm;
    const refYear = newMonth < 0 ? sy - 1 : newMonth > 11 ? sy + 1 : sy;
    const refMonth = ((newMonth % 12) + 12) % 12;
    const refDate = new Date(refYear, refMonth, 20);
    if (direction === "prev") refDate.setDate(1);
    const period = getPayrollPeriod(refDate);
    setStartDate(period.start);
    setEndDate(period.end);
  };

  const totalSeconds = sessions.reduce(
    (acc, session) =>
      acc + session.task_entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0),
    0
  );
  const totalHours = totalSeconds / 3600;

  // Simple tier rate estimation
  let currentTierRate = DEFAULT_SALARY_TIERS[0].rate_per_hour;
  for (const tier of DEFAULT_SALARY_TIERS) {
    if (
      totalHours >= tier.min_hours &&
      (tier.max_hours === null || totalHours <= tier.max_hours)
    ) {
      currentTierRate = tier.rate_per_hour;
      break;
    }
  }

  const basePay = Math.round(totalHours * currentTierRate);
  const bonusEarned = totalHours >= DEFAULT_BONUS_THRESHOLD_HOURS ? DEFAULT_BONUS_AMOUNT : 0;
  const totalEarnings = basePay + bonusEarned;

  const bonusProgressPercent = Math.min(
    100,
    Math.round((totalHours / DEFAULT_BONUS_THRESHOLD_HOURS) * 100)
  );

  const periodLabel = getPayrollPeriodLabel(startDate, endDate);
  const isPaid = paymentRecord?.payment_status === "paid";

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
      {/* Pay Cutoff Period Selector */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Periode Penggajian Cutoff (15 - 14)
            </p>
            <p className="text-base font-extrabold text-[var(--text-primary)] mt-0.5">
              📅 {periodLabel}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              💸 Gaji dibayarkan mulai <strong>tgl 15</strong> (maksimal tgl 30 akhir bulan)
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => jumpToPeriod("prev")}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border)]"
            >
              ← Periode Lalu
            </button>
            <button
              type="button"
              onClick={() => {
                const p = getPayrollPeriod();
                setStartDate(p.start);
                setEndDate(p.end);
              }}
              className="px-2.5 py-1.5 bg-[var(--primary-soft)] text-[var(--primary)] hover:brightness-95 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-[var(--primary)]/30"
            >
              Periode Ini
            </button>
            <button
              type="button"
              onClick={() => jumpToPeriod("next")}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-alt)] hover:bg-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border)]"
            >
              Periode Depan →
            </button>
          </div>
        </div>

        {/* Status Pembayaran Badge */}
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Status Gaji Periode Ini:
          </span>
          {isPaid ? (
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-extrabold">
              ✓ SUDAH CAIR (PAID)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-1 rounded-xl text-xs font-extrabold">
              ⏳ Belum Cair (Proses Pencairan 15-30)
            </span>
          )}
        </div>

        {/* Proof Info if Paid */}
        {isPaid && (paymentRecord?.proof_url || paymentRecord?.proof_note) && (
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 space-y-1">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              📋 Bukti Transfer dari Owner
            </p>
            {paymentRecord.proof_note && (
              <p className="text-xs text-[var(--text-primary)] italic">&quot;{paymentRecord.proof_note}&quot;</p>
            )}
            {paymentRecord.proof_url && (
              <a
                href={paymentRecord.proof_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
              >
                🖼 Lihat Lampiran Bukti Transfer
              </a>
            )}
          </div>
        )}
      </div>

      {/* Total Earnings Card */}
      <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] rounded-2xl p-6 text-white shadow-md space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
            Estimasi Total Pendapatan Periode Ini
          </p>
          <p className="text-3xl font-black tracking-tight mt-1">{formatRupiah(totalEarnings)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/20">
          <div>
            <p className="text-xs text-white/80">Gaji Pokok ({formatDecimalHours(totalHours)})</p>
            <p className="text-lg font-bold">{formatRupiah(basePay)}</p>
          </div>
          <div>
            <p className="text-xs text-white/80">Bonus Mingguan</p>
            <p className="text-lg font-bold">
              {bonusEarned > 0 ? `+${formatRupiah(bonusEarned)}` : "Rp 0"}
            </p>
          </div>
        </div>
      </div>

      {/* Bonus Progress Card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Progress Bonus Mingguan
          </span>
          <span className="font-bold text-[var(--primary)]">Target: {DEFAULT_BONUS_THRESHOLD_HOURS} Jam</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--border)] rounded-full h-3 overflow-hidden">
          <div
            className="bg-[var(--primary)] h-full rounded-full transition-all duration-500"
            style={{ width: `${bonusProgressPercent}%` }}
          />
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          {totalHours >= DEFAULT_BONUS_THRESHOLD_HOURS ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              🎉 Selamat! Target {DEFAULT_BONUS_THRESHOLD_HOURS} jam telah tercapai. Bonus {formatRupiah(DEFAULT_BONUS_AMOUNT)} didapatkan.
            </span>
          ) : (
            <span>
              Sudah mencapai <strong>{formatDecimalHours(totalHours)}</strong>. Butuh{" "}
              {(DEFAULT_BONUS_THRESHOLD_HOURS - totalHours).toFixed(1)} jam lagi untuk mendapatkan bonus{" "}
              {formatRupiah(DEFAULT_BONUS_AMOUNT)}.
            </span>
          )}
        </p>
      </div>

      {/* Daily Breakdown List */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
          Riwayat Sesi Kerja dalam Periode Ini
        </h2>

        {isLoading ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">Memuat riwayat sesi...</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
            Belum ada riwayat sesi pengerjaan pada periode ini ({periodLabel}).
          </p>
        ) : (
          <div className="space-y-3 divide-y divide-[var(--border)]">
            {sessions.map((session) => {
              const daySeconds = session.task_entries.reduce(
                (sum, e) => sum + (e.duration_seconds || 0),
                0
              );
              const dayHours = daySeconds / 3600;
              const dayPay = Math.round(dayHours * currentTierRate);

              return (
                <div key={session.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[var(--text-primary)]">{session.session_date}</p>
                    <p className="text-[var(--text-secondary)]">{session.task_entries.length} task dicatat</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[var(--text-primary)]">{formatDecimalHours(dayHours)}</p>
                    <p className="text-[var(--primary)] font-semibold">{formatRupiah(dayPay)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
