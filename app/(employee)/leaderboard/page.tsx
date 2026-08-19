"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWorkDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  user_id: string;
  first_name: string;
  total_seconds: number;
  rank: number;
  is_me: boolean;
}

type Period = "week" | "month";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(period: Period): { start: string; end: string } {
  // Use getWorkDate() as anchor for "today"
  const todayStr = getWorkDate();
  const today = new Date(todayStr + "T12:00:00+07:00");

  if (period === "week") {
    // Monday–Sunday week
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon,...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
    };
  } else {
    // Full calendar month
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
    return { start: firstDay, end: lastDay };
  }
}

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

function getPeriodLabel(period: Period): string {
  const { start, end } = getDateRange(period);
  const fmt = (d: string) =>
    new Date(d + "T12:00:00+07:00").toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Medal Component ──────────────────────────────────────────────────────────

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] font-bold text-xs border border-[var(--border)]">
      {rank}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "#FBE4DA", text: "#E8623D" }, // terracotta
  { bg: "#DCF0EC", text: "#1F8A7A" }, // teal
  { bg: "#FFF3CD", text: "#C68A00" }, // gold
  { bg: "#E8E4FB", text: "#6B5DD3" }, // purple
  { bg: "#E4F0FB", text: "#1D6FA4" }, // blue
  { bg: "#FBE4EF", text: "#C63D7E" }, // pink
];

function Avatar({ name, index, size = "md" }: { name: string; index: number; size?: "sm" | "md" | "lg" }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const sizeClass = size === "lg" ? "w-14 h-14 text-xl" : size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-black border-2 shrink-0`}
      style={{ backgroundColor: color.bg, color: color.text, borderColor: color.text + "40" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Top 3 Podium ─────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  index,
  maxSeconds,
}: {
  entry: LeaderboardEntry;
  index: number;
  maxSeconds: number;
}) {
  const heights = ["h-28", "h-20", "h-16"]; // 1st, 2nd, 3rd podium heights
  const podiumOrder = [1, 0, 2]; // visual order: silver, gold, bronze
  const visualIndex = podiumOrder[index]; // convert display position to actual array index

  const podiumColors = [
    { bar: "from-yellow-400 to-amber-500", glow: "shadow-amber-200/60 dark:shadow-amber-900/60" },
    { bar: "from-slate-300 to-slate-400", glow: "shadow-slate-200/60 dark:shadow-slate-700/60" },
    { bar: "from-orange-400 to-amber-600", glow: "shadow-orange-200/60 dark:shadow-orange-900/60" },
  ];

  const pct = maxSeconds > 0 ? Math.round((entry.total_seconds / maxSeconds) * 100) : 0;

  return (
    <div
      className={`flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4`}
      style={{ animationDelay: `${visualIndex * 120}ms`, animationFillMode: "both" }}
    >
      {/* Avatar + name */}
      <div className={`flex flex-col items-center gap-1.5 ${entry.is_me ? "relative" : ""}`}>
        {entry.is_me && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-full border border-[var(--primary)]/30 whitespace-nowrap">
            Kamu
          </span>
        )}
        <div className={`${entry.is_me ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg-base)]" : ""} rounded-full`}>
          <Avatar name={entry.first_name} index={entry.rank - 1} size="lg" />
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)] max-w-[72px] text-center leading-tight truncate">
          {entry.first_name}
        </p>
        <p className="text-xs font-semibold text-[var(--primary)]">{formatSeconds(entry.total_seconds)}</p>
      </div>

      {/* Podium bar */}
      <div
        className={`w-20 ${heights[visualIndex]} rounded-t-xl bg-gradient-to-b ${podiumColors[visualIndex].bar} shadow-lg ${podiumColors[visualIndex].glow} flex items-start justify-center pt-2 relative overflow-hidden`}
      >
        <MedalIcon rank={entry.rank} />
        {/* Shine effect */}
        <div className="absolute inset-0 bg-white/20 bg-gradient-to-br from-white/30 via-transparent to-transparent" />
        {/* Percentage label */}
        <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold text-white/80">
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ─── Row Card ─────────────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  maxSeconds,
  animDelay,
}: {
  entry: LeaderboardEntry;
  maxSeconds: number;
  animDelay: number;
}) {
  const pct = maxSeconds > 0 ? (entry.total_seconds / maxSeconds) * 100 : 0;

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
        animate-in fade-in slide-in-from-left-4
        ${
          entry.is_me
            ? "bg-[var(--primary-soft)] border-[var(--primary)]/50 shadow-sm"
            : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--primary)]/20 hover:bg-[var(--bg-surface-alt)]"
        }
      `}
      style={{ animationDelay: `${animDelay}ms`, animationFillMode: "both" }}
    >
      {/* Rank */}
      <div className="w-7 flex justify-center shrink-0">
        <MedalIcon rank={entry.rank} />
      </div>

      {/* Avatar */}
      <Avatar name={entry.first_name} index={entry.rank - 1} size="sm" />

      {/* Name + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-bold truncate ${entry.is_me ? "text-[var(--primary)]" : "text-[var(--text-primary)]"}`}>
            {entry.first_name}
          </span>
          {entry.is_me && (
            <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded-full border border-[var(--primary)]/30 shrink-0">
              Kamu
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${entry.is_me ? "bg-[var(--primary)]" : "bg-[var(--accent-teal)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Hours */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-black ${entry.is_me ? "text-[var(--primary)]" : "text-[var(--text-primary)]"}`}>
          {formatSeconds(entry.total_seconds)}
        </p>
        <p className="text-[10px] text-[var(--text-secondary)]">{Math.round(pct)}% dari #1</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [periodLabel, setPeriodLabel] = useState("");

  const fetchLeaderboard = useCallback(async (p: Period, userId: string) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { start, end } = getDateRange(p);
      setPeriodLabel(getPeriodLabel(p));

      // Single RPC call — runs with SECURITY DEFINER on Supabase,
      // bypassing RLS safely so employees can see aggregated data of all peers.
      const { data, error } = await supabase.rpc("get_leaderboard", {
        start_date: start,
        end_date: end,
      });

      if (error) {
        console.error("Leaderboard RPC error:", error.message);
        setEntries([]);
        return;
      }

      const ranked: LeaderboardEntry[] = (data || []).map(
        (row: { user_id: string; first_name: string; total_seconds: number; rank: number }) => ({
          user_id: row.user_id,
          first_name: row.first_name,
          total_seconds: Number(row.total_seconds),
          rank: Number(row.rank),
          is_me: row.user_id === userId,
        })
      );

      setEntries(ranked);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Init: get current user
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || "";
      setCurrentUserId(uid);
      fetchLeaderboard(period, uid);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    fetchLeaderboard(p, currentUserId);
  };

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const maxSeconds = entries[0]?.total_seconds || 1;

  // Find user's rank for sticky footer
  const myEntry = entries.find((e) => e.is_me);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Header ── */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl">🏆</span>
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Leaderboard</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Klasemen jam kerja tim — saling semangat!</p>
      </div>

      {/* ── Period Toggle ── */}
      <div className="flex justify-center">
        <div className="inline-flex bg-[var(--bg-surface-alt)] rounded-2xl p-1 border border-[var(--border)]">
          {(["week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              id={`leaderboard-period-${p}`}
              onClick={() => handlePeriodChange(p)}
              className={`
                px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer
                ${period === p
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }
              `}
            >
              {p === "week" ? "Minggu Ini" : "Bulan Ini"}
            </button>
          ))}
        </div>
      </div>

      {/* Period range label */}
      {periodLabel && (
        <p className="text-center text-xs text-[var(--text-secondary)] -mt-3 font-medium">
          {periodLabel}
        </p>
      )}

      {/* ── Banner Reward Juara Bulanan ── */}
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0 font-bold border border-amber-500/30">
            🎁
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm text-[var(--text-primary)]">
                Bonus Juara Bulanan: <span className="text-amber-600 dark:text-amber-400">Rp 350.000</span>
              </span>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                Khusus Rank #1 Bulanan
              </span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Dapatkan bonus puncak <strong>Rp 350.000</strong> bagi <strong>1 orang teratas</strong> di klasemen bulan ini!
            </p>
            <div className="pt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
              <span>📌 Syarat:</span>
              <span className="text-[var(--primary)] font-bold">Minimal 160 Jam Kerja / Bulan</span>
              <span className="text-[var(--text-secondary)] font-normal">(setara 4x Tembus Bonus Mingguan)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading ? (
        <div className="space-y-3">
          {/* Podium skeleton */}
          <div className="flex items-end justify-center gap-4 py-6">
            {[56, 72, 48].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                <div className="w-14 h-14 rounded-full bg-[var(--border)]" />
                <div className="w-16 h-3 rounded bg-[var(--border)]" />
                <div className={`w-20 rounded-t-xl bg-[var(--border)]`} style={{ height: h }} />
              </div>
            ))}
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[var(--border)]" />
              <div className="w-8 h-8 rounded-full bg-[var(--border)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-[var(--border)]" />
                <div className="h-1.5 rounded-full bg-[var(--border)]" />
              </div>
              <div className="w-12 h-4 rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <span className="text-5xl block">😴</span>
          <p className="text-[var(--text-primary)] font-bold">Belum ada data</p>
          <p className="text-sm text-[var(--text-secondary)]">Tidak ada jam kerja tercatat pada periode ini</p>
        </div>
      ) : (
        <>
          {/* ── Top 3 Podium ── */}
          {top3.length > 0 && (
            <div className="bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-surface-alt)] rounded-3xl border border-[var(--border)] p-6 shadow-sm">
              <div className="flex items-end justify-center gap-3">
                {/* Visual order: #2 left, #1 center, #3 right */}
                {[
                  top3[1], // rank 2 (left)
                  top3[0], // rank 1 (center)
                  top3[2], // rank 3 (right)
                ]
                  .filter(Boolean)
                  .map((entry, visualIdx) => (
                    <PodiumCard
                      key={entry.user_id}
                      entry={entry}
                      index={visualIdx}
                      maxSeconds={maxSeconds}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* ── Rest of Rankings ── */}
          {rest.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1">
                Ranking Lainnya
              </p>
              <div className="space-y-2">
                {rest.map((entry, idx) => (
                  <LeaderboardRow
                    key={entry.user_id}
                    entry={entry}
                    maxSeconds={maxSeconds}
                    animDelay={idx * 60}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── My Rank Sticky Footer (if not in top visible area) ── */}
          {myEntry && myEntry.rank > 3 && rest.findIndex((e) => e.is_me) >= 0 && (
            <div className="sticky bottom-4">
              <div className="bg-[var(--primary)] text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg shadow-[var(--primary)]/30">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black">#{myEntry.rank}</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                    {myEntry.first_name.charAt(0)}
                  </div>
                  <span className="font-bold text-sm">{myEntry.first_name}</span>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm">{formatSeconds(myEntry.total_seconds)}</p>
                  <p className="text-[10px] text-white/70">{Math.round((myEntry.total_seconds / maxSeconds) * 100)}% dari #1</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
