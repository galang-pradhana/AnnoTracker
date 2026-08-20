"use client";

import React, { useState } from "react";
import { formatDecimalHours, formatSecondsToTime, formatRupiah } from "@/lib/utils";
import { DEFAULT_SALARY_TIERS } from "@/constants";
import type { SalaryTier, TaskEntryWithDetails } from "@/types";

interface AccountBreakdown {
  clientId: string;
  clientName: string;
  clientLanguage?: string | null;
  totalSeconds: number;
  taskCount: number;
}

interface SessionSummaryProps {
  totalSeconds: number;
  totalTaskCount?: number;
  salaryTiers?: SalaryTier[];
  overrideRate?: number;
  targetHours?: number; // default 8 hours
  entriesWithDetails?: TaskEntryWithDetails[];
}

export function SessionSummary({
  totalSeconds,
  totalTaskCount = 0,
  salaryTiers,
  overrideRate,
  targetHours = 8,
  entriesWithDetails = [],
}: SessionSummaryProps) {
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(true);

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

  // ── Breakdown per akun ─────────────────────────────────────────────────
  const accountBreakdowns: AccountBreakdown[] = (() => {
    const map = new Map<string, AccountBreakdown>();
    for (const entry of entriesWithDetails) {
      if (!entry.client_account) continue;
      const key = entry.client_account_id;
      const existing = map.get(key);
      if (existing) {
        existing.totalSeconds += entry.duration_seconds || 0;
        existing.taskCount += 1;
      } else {
        map.set(key, {
          clientId: key,
          clientName: entry.client_account.name,
          clientLanguage: entry.client_account.language,
          totalSeconds: entry.duration_seconds || 0,
          taskCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  })();

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
          <div className="text-xl font-black tracking-tight text-[var(--accent-teal)] mt-0.5">
            {formatDecimalHours(totalHours, { format: "decimal" })}
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-1">
            ⏱️ {formatSecondsToTime(totalSeconds)}
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

      {/* ── Breakdown per Akun ────────────────────────────────────────────── */}
      {accountBreakdowns.length > 0 && (
        <div className="pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => setIsBreakdownExpanded((v) => !v)}
            className="w-full flex items-center justify-between mb-2 cursor-pointer group"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                🏢 Breakdown per Akun
              </span>
              <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-1.5 py-0.5 rounded-full">
                {accountBreakdowns.length}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {isBreakdownExpanded ? "▲" : "▼"}
            </span>
          </button>

          {isBreakdownExpanded && (
            <div className="space-y-1.5">
              {accountBreakdowns.map((acc) => (
                <div
                  key={acc.clientId}
                  className="flex items-center justify-between py-1.5 px-2.5 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                      {acc.clientName}
                      {acc.clientLanguage && (
                        <span className="ml-1 text-[var(--text-secondary)] font-normal">
                          ({acc.clientLanguage})
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {acc.taskCount} task
                    </p>
                  </div>
                  <span className="text-[11px] font-extrabold text-[var(--accent-teal)] ml-2 shrink-0">
                    {formatDecimalHours(acc.totalSeconds / 3600)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
