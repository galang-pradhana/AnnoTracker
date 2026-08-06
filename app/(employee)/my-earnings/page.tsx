"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDecimalHours } from "@/lib/utils";
import { DEFAULT_SALARY_TIERS, DEFAULT_BONUS_THRESHOLD_HOURS, DEFAULT_BONUS_AMOUNT, ROUTES } from "@/constants";
import type { WorkSessionWithEntries } from "@/types";

export default function MyEarningsPage() {
  const [sessions, setSessions] = useState<WorkSessionWithEntries[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyEarnings = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "demo-employee-id";

      const { data } = await supabase
        .from("work_sessions")
        .select("*, task_entries(*, client_account:client_accounts(*), task_type:task_types(*))")
        .eq("user_id", userId)
        .order("session_date", { ascending: false });

      if (data) {
        setSessions(data as unknown as WorkSessionWithEntries[]);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyEarnings();
  }, [fetchMyEarnings]);

  const totalSeconds = sessions.reduce(
    (acc, session) =>
      acc + session.task_entries.reduce((sum, e) => sum + e.duration_seconds, 0),
    0
  );
  const totalHours = totalSeconds / 3600;

  // Simple current tier rate estimation
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Header Navigation */}
      <header className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link href={ROUTES.EMPLOYEE_WORK_SESSION} className="text-xs text-slate-500 hover:text-slate-900 font-semibold">
              &larr; Halaman Kerja
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-sm font-bold text-slate-900">Rincian Gaji Saya</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Total Earnings Card */}
        <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 text-white shadow-md space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-200">Estimasi Total Pendapatan Sesi Ini</p>
            <p className="text-3xl font-bold tracking-tight mt-1">{formatRupiah(totalEarnings)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-teal-500/30">
            <div>
              <p className="text-xs text-teal-200">Gaji Pokok ({formatDecimalHours(totalHours)})</p>
              <p className="text-lg font-bold">{formatRupiah(basePay)}</p>
            </div>
            <div>
              <p className="text-xs text-teal-200">Bonus Mingguan</p>
              <p className="text-lg font-bold">{bonusEarned > 0 ? `+${formatRupiah(bonusEarned)}` : "Rp 0"}</p>
            </div>
          </div>
        </div>

        {/* Bonus Progress Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-900 uppercase tracking-wider">Progress Bonus Mingguan</span>
            <span className="font-semibold text-teal-700">Target: {DEFAULT_BONUS_THRESHOLD_HOURS} Jam</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${bonusProgressPercent}%` }}
            />
          </div>

          <p className="text-xs text-slate-500">
            {totalHours >= DEFAULT_BONUS_THRESHOLD_HOURS ? (
              <span className="text-teal-700 font-semibold">🎉 Selamat! Target {DEFAULT_BONUS_THRESHOLD_HOURS} jam telah tercapai. Bonus {formatRupiah(DEFAULT_BONUS_AMOUNT)} didapatkan.</span>
            ) : (
              <span>Sudah mencapai <strong>{formatDecimalHours(totalHours)}</strong>. Butuh {(DEFAULT_BONUS_THRESHOLD_HOURS - totalHours).toFixed(1)} jam lagi untuk mendapatkan bonus {formatRupiah(DEFAULT_BONUS_AMOUNT)}.</span>
            )}
          </p>
        </div>

        {/* Daily Breakdown List */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Riwayat Sesi Kerja</h2>

          {isLoading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Memuat riwayat sesi...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Belum ada riwayat sesi pengerjaan.</p>
          ) : (
            <div className="space-y-3 divide-y divide-slate-100">
              {sessions.map((session) => {
                const daySeconds = session.task_entries.reduce((sum, e) => sum + e.duration_seconds, 0);
                const dayHours = daySeconds / 3600;
                const dayPay = Math.round(dayHours * currentTierRate);

                return (
                  <div key={session.id} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{session.session_date}</p>
                      <p className="text-slate-500">{session.task_entries.length} task dicatat</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{formatDecimalHours(dayHours)}</p>
                      <p className="text-teal-700 font-medium">{formatRupiah(dayPay)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
