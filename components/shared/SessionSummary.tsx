"use client";

import React from "react";
import { formatDecimalHours, formatSecondsToTime, formatRupiah } from "@/lib/utils";
import { DEFAULT_SALARY_TIERS } from "@/constants";
import type { SalaryTier } from "@/types";

interface SessionSummaryProps {
  totalSeconds: number;
  totalTaskCount?: number;
  salaryTiers?: SalaryTier[];
  overrideRate?: number;
  targetHours?: number; // default 8 hours
}

export function SessionSummary({
  totalSeconds,
  totalTaskCount = 0,
  salaryTiers,
  overrideRate,
  targetHours = 8,
}: SessionSummaryProps) {
  const totalHours = totalSeconds / 3600;
  const activeTiers = salaryTiers && salaryTiers.length > 0 ? salaryTiers : DEFAULT_SALARY_TIERS;

  // Simple tier estimation for employee display
  let currentTierRate = overrideRate ?? activeTiers[0].rate_per_hour;
  if (overrideRate === undefined) {
    for (const tier of activeTiers) {
      if (
        totalHours >= tier.min_hours &&
        (tier.max_hours === null || totalHours <= tier.max_hours)
      ) {
        currentTierRate = tier.rate_per_hour;
        break;
      }
    }
  }

  const estimatedPay = Math.round(totalHours * currentTierRate);

  // Target calculations
  const targetSeconds = targetHours * 3600;
  const progressPercent = Math.min(100, Math.round((totalSeconds / targetSeconds) * 100));
  const isTargetAchieved = progressPercent >= 100;

  // Average per task
  const avgSecondsPerTask = totalTaskCount > 0 ? Math.round(totalSeconds / totalTaskCount) : 0;

  return (
    <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
            Ringkasan Hari Ini
          </h2>
        </div>
        <span className="text-[11px] font-semibold bg-[var(--primary-soft)] px-2.5 py-0.5 rounded-full text-[var(--primary)] border border-[var(--primary)]/20">
          Tier: {formatRupiah(currentTierRate)}/jam
        </span>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* Total Tasks Completed */}
        <div className="bg-[var(--bg-surface-alt)] rounded-xl p-3 border border-[var(--border)]">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Task Selesai</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
              {totalTaskCount}
            </span>
            <span className="text-xs text-[var(--primary)] font-semibold">task</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            Rata-rata: {avgSecondsPerTask > 0 ? formatSecondsToTime(avgSecondsPerTask) : "-"}
          </p>
        </div>

        {/* Total Paid Duration */}
        <div className="bg-[var(--bg-surface-alt)] rounded-xl p-3 border border-[var(--border)]">
          <p className="text-[11px] font-medium text-[var(--text-secondary)]">Jam Terbayar</p>
          <div className="text-2xl font-black tracking-tight text-[var(--accent-teal)] mt-0.5">
            {formatDecimalHours(totalHours)}
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">
            ({formatSecondsToTime(totalSeconds)})
          </p>
        </div>
      </div>

      {/* Progress Bar to 8 Hour Target */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-[var(--text-secondary)] text-[11px]">
            Target Harian ({targetHours} Jam):
          </span>
          <span
            className={
              isTargetAchieved ? "text-[var(--success)] font-bold" : "text-[var(--primary)] font-bold"
            }
          >
            {progressPercent}% {isTargetAchieved && "🎉"}
          </span>
        </div>

        {/* Track = --border, Fill = --primary / --success */}
        <div className="w-full h-2.5 bg-[var(--border)] rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isTargetAchieved
                ? "bg-[var(--success)]"
                : "bg-[var(--primary)]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Estimated Earnings (Orange Primary for Financial Highlight) */}
      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
            Estimasi Gaji Hari Ini
          </p>
          <p className="text-xl font-black text-[var(--primary)] tracking-tight">
            {formatRupiah(estimatedPay)}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-[var(--text-secondary)] block">Akumulasi harian</span>
          <span className="text-xs text-[var(--text-primary)] font-medium">Flat per tier</span>
        </div>
      </div>
    </div>
  );
}
