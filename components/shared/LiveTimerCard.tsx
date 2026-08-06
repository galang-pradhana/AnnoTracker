"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { formatSecondsToTime, formatDecimalHours } from "@/lib/utils";

interface LiveTimerCardProps {
  paidSecondsTotal: number;
  onApplyTimerToForm: (seconds: number) => void;
}

const STORAGE_KEY = "annotracker_live_timer_v1";

interface StoredTimerState {
  todayDate: string;
  activeSeconds: number;
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedRealSecondsToday: number;
}

function formatClockHHMMSS(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export function LiveTimerCard({
  paidSecondsTotal,
  onApplyTimerToForm,
}: LiveTimerCardProps) {
  const todayStr = new Date().toISOString().split("T")[0];

  const [activeSeconds, setActiveSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [accumulatedRealSeconds, setAccumulatedRealSeconds] = useState<number>(0);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimestampRef = useRef<number | null>(null);

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: StoredTimerState = JSON.parse(saved);
        if (parsed.todayDate === todayStr) {
          let extraSeconds = 0;
          if (parsed.isRunning && parsed.startTimestamp) {
            const now = Date.now();
            extraSeconds = Math.floor((now - parsed.startTimestamp) / 1000);
          }
          const currentSecs = (parsed.activeSeconds || 0) + extraSeconds;
          setActiveSeconds(currentSecs);
          setIsRunning(parsed.isRunning);
          setAccumulatedRealSeconds(parsed.accumulatedRealSecondsToday || 0);
          if (parsed.isRunning) {
            lastTickTimestampRef.current = Date.now();
          }
        } else {
          // New day reset
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error("Failed to load live timer state:", e);
    }
  }, [todayStr]);

  // Persist state changes to localStorage
  const saveState = useCallback(
    (
      currentActive: number,
      running: boolean,
      accumulated: number,
      startTs: number | null
    ) => {
      try {
        const payload: StoredTimerState = {
          todayDate: todayStr,
          activeSeconds: currentActive,
          isRunning: running,
          startTimestamp: startTs,
          accumulatedRealSecondsToday: accumulated,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.error("Failed to save live timer state:", e);
      }
    },
    [todayStr]
  );

  // Timer interval effect
  useEffect(() => {
    if (isRunning) {
      const startTs = lastTickTimestampRef.current || Date.now();
      lastTickTimestampRef.current = startTs;

      timerRef.current = setInterval(() => {
        setActiveSeconds((prev) => {
          const next = prev + 1;
          saveState(next, true, accumulatedRealSeconds, startTs);
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      lastTickTimestampRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, accumulatedRealSeconds, saveState]);

  // Actions: Start, Pause, Reset
  const handleStart = () => {
    const now = Date.now();
    lastTickTimestampRef.current = now;
    setIsRunning(true);
    saveState(activeSeconds, true, accumulatedRealSeconds, now);
  };

  const handlePause = () => {
    setIsRunning(false);
    saveState(activeSeconds, false, accumulatedRealSeconds, null);
  };

  const handleResetStop = () => {
    const finalAccumulated = accumulatedRealSeconds + activeSeconds;
    setIsRunning(false);
    setActiveSeconds(0);
    setAccumulatedRealSeconds(finalAccumulated);
    saveState(0, false, finalAccumulated, null);
  };

  const handleUseThisTime = () => {
    if (activeSeconds > 0) {
      onApplyTimerToForm(activeSeconds);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  // Calculations for real vs paid comparison
  const totalRealSecondsToday = accumulatedRealSeconds + activeSeconds;
  const realVsPaidDiff = totalRealSecondsToday - paidSecondsTotal;
  const isLargeDiff = realVsPaidDiff > 1800; // > 30 minutes difference

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-teal)] opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isRunning ? "bg-[var(--accent-teal)]" : "bg-[var(--text-secondary)]"
              }`}
            ></span>
          </span>
          <h2 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider truncate">
            Live Timer
          </h2>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] shrink-0">
          {isRunning ? "Running" : activeSeconds > 0 ? "Paused" : "Idle"}
        </span>
      </div>

      {/* Clock Display (Font-size and tracking tuned to avoid overflow) */}
      <div className="text-center bg-[var(--bg-base)] rounded-xl p-3 sm:p-4 border border-[var(--border)] shadow-inner overflow-hidden">
        <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest mb-1">
          Stopwatch Sesi Aktif
        </p>
        <div className="font-mono text-3xl sm:text-4xl font-extrabold text-[var(--accent-teal)] tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
          {formatClockHHMMSS(activeSeconds)}
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          ≈ {Math.floor(activeSeconds / 60)}m {activeSeconds % 60}d
        </p>
      </div>

      {/* Control Buttons (Structured in 2 Rows for zero truncation) */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              className="py-2 px-3 bg-[var(--success)] hover:brightness-110 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>▶</span>
              <span>{activeSeconds > 0 ? "Lanjut" : "Mulai"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="py-2 px-3 bg-[var(--warning)] hover:brightness-105 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>⏸</span>
              <span>Pause</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetStop}
            disabled={activeSeconds === 0 && !isRunning}
            className="py-2 px-3 bg-[var(--bg-surface-alt)] hover:bg-[var(--primary-soft)] text-[var(--text-primary)] hover:text-[var(--danger)] disabled:opacity-40 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>⏹</span>
            <span>Reset</span>
          </button>
        </div>

        {/* Dedicated Full-Width Button for Use This Time */}
        <button
          type="button"
          onClick={handleUseThisTime}
          disabled={activeSeconds === 0}
          className="w-full py-2 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          title="Salin durasi timer ini ke form input di kolom tengah"
        >
          <span>📥</span>
          <span>Gunakan Waktu Ini ke Form</span>
        </button>
      </div>

      {copiedNotification && (
        <div className="p-2 bg-[var(--accent-teal-soft)] border border-[var(--accent-teal)]/40 rounded-lg text-center text-xs font-medium text-[var(--accent-teal)] animate-in fade-in duration-200">
          ✓ Durasi {formatClockHHMMSS(activeSeconds)} disalin ke form!
        </div>
      )}

      {/* Comparison Panel */}
      <div className="pt-3 border-t border-[var(--border)] space-y-2">
        <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          Perbandingan Jam Hari Ini
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-secondary)] block">
              Jam Nyata (timer):
            </span>
            <span className="font-bold text-[var(--text-primary)]">
              {formatDecimalHours(totalRealSecondsToday / 3600)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] block">
              ({formatSecondsToTime(totalRealSecondsToday)})
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--text-secondary)] block">
              Jam Terbayar (submit):
            </span>
            <span className="font-bold text-[var(--primary)]">
              {formatDecimalHours(paidSecondsTotal / 3600)}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] block">
              ({formatSecondsToTime(paidSecondsTotal)})
            </span>
          </div>
        </div>

        {/* Difference badge */}
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
            isLargeDiff
              ? "bg-[var(--primary-soft)] border-[var(--warning)]/50 text-[var(--warning)]"
              : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-secondary)]"
          }`}
        >
          <span className="text-[11px] font-medium">Selisih Real vs Submit:</span>
          <span className="font-bold">
            {realVsPaidDiff > 0 ? "+" : ""}
            {formatSecondsToTime(Math.abs(realVsPaidDiff))}
            {isLargeDiff && " ⚠️"}
          </span>
        </div>
      </div>
    </div>
  );
}
