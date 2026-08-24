"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface TaskAlarmCardProps {
  autoStartTriggerCount?: number;
  onApplyTimeToForm?: (seconds: number) => void;
}

const STORAGE_KEY = "annotracker_task_alarm_v2";
const DEFAULT_ALARM_SECONDS = 510; // 8.5 minutes = 8m 30s

export type AlarmSoundTone = "tone1" | "tone2" | "tone3";

interface StoredAlarmState {
  todayDate: string;
  targetSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  endTimestamp: number | null;
  isMuted: boolean;
  alarmMode?: "auto" | "manual";
  soundTone?: AlarmSoundTone;
}

const PRESETS = [
  { label: "5m", seconds: 300 },
  { label: "8.5m ⭐", seconds: 510 },
  { label: "10m", seconds: 600 },
  { label: "12m", seconds: 720 },
];

function formatTimeMMSS(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(mins)}:${pad(secs)}`;
}

// ── Web Audio API Synthesizer Sound Player (3 Distinct Tones) ────────────────

function playAlarmChimeSequence(tone: AlarmSoundTone = "tone1"): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return () => {};

    const ctx = new AudioCtx();
    let isStopped = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const playPulse = () => {
      if (isStopped) return;

      if (tone === "tone2") {
        // TONE 2: Digital Beep (Double-beep pulse 1000Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "square";
        osc1.frequency.setValueAtTime(1000, ctx.currentTime);
        gain1.gain.setValueAtTime(0.15, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.1);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "square";
        osc2.frequency.setValueAtTime(1000, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.25);

        timeoutId = setTimeout(() => { if (!isStopped) playPulse(); }, 750);
      } else if (tone === "tone3") {
        // TONE 3: Bell Lembut (Warm 3-tone arpeggio C5 -> E5 -> G5)
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.5);
        });

        timeoutId = setTimeout(() => { if (!isStopped) playPulse(); }, 1100);
      } else {
        // TONE 1: Chime Melodis (Default - A5 -> C6)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);

        timeoutId = setTimeout(() => { if (!isStopped) playPulse(); }, 900);
      }
    };

    playPulse();

    return () => {
      isStopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

export function TaskAlarmCard({
  autoStartTriggerCount = 0,
}: TaskAlarmCardProps) {
  const [targetSeconds, setTargetSeconds] = useState<number>(DEFAULT_ALARM_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(DEFAULT_ALARM_SECONDS);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isAlarmActive, setIsAlarmActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [alarmMode, setAlarmMode] = useState<"auto" | "manual">("auto");
  const [soundTone, setSoundTone] = useState<AlarmSoundTone>("tone1");
  const [customInput, setCustomInput] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  const stopSoundRef = useRef<(() => void) | null>(null);
  const prevTriggerRef = useRef<number>(autoStartTriggerCount);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Sumber kebenaran waktu — disimpan di ref agar tidak trigger re-render
  const endTimestampRef = useRef<number | null>(null);

  // Stop active sound safely
  const stopAlarmSound = useCallback(() => {
    if (stopSoundRef.current) {
      stopSoundRef.current();
      stopSoundRef.current = null;
    }
  }, []);

  // Trigger sound when alarm rings
  const triggerAlarmRing = useCallback(() => {
    setIsAlarmActive(true);
    setIsRunning(false);
    setRemainingSeconds(0);
    if (!isMuted) {
      stopAlarmSound();
      stopSoundRef.current = playAlarmChimeSequence(soundTone);
    }
  }, [isMuted, soundTone, stopAlarmSound]);

  // Restore state from localStorage
  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: StoredAlarmState = JSON.parse(saved);
        if (parsed.todayDate === todayStr) {
          setTargetSeconds(parsed.targetSeconds || DEFAULT_ALARM_SECONDS);
          setIsMuted(Boolean(parsed.isMuted));
          if (parsed.alarmMode) setAlarmMode(parsed.alarmMode);
          if (parsed.soundTone) setSoundTone(parsed.soundTone);

          if (parsed.isRunning && parsed.endTimestamp) {
            const now = Date.now();
            const left = Math.round((parsed.endTimestamp - now) / 1000);
            if (left <= 0) {
              triggerAlarmRing();
            } else {
              // Restore endTimestampRef agar timer langsung akurat saat resume
              endTimestampRef.current = parsed.endTimestamp;
              setRemainingSeconds(left);
              setIsRunning(true);
            }
          } else {
            setRemainingSeconds(parsed.remainingSeconds ?? (parsed.targetSeconds || DEFAULT_ALARM_SECONDS));
            setIsRunning(false);
          }
        }
      }
    } catch (e) {
      console.error("Error restoring task alarm state:", e);
    }
  }, [triggerAlarmRing]);

  // Save state to localStorage
  const saveState = useCallback(
    (
      target: number,
      remaining: number,
      running: boolean,
      endTs: number | null,
      muted: boolean,
      mode: "auto" | "manual" = alarmMode,
      tone: AlarmSoundTone = soundTone
    ) => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const payload: StoredAlarmState = {
          todayDate: todayStr,
          targetSeconds: target,
          remainingSeconds: remaining,
          isRunning: running,
          endTimestamp: endTs,
          isMuted: muted,
          alarmMode: mode,
          soundTone: tone,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.error("Error saving task alarm state:", e);
      }
    },
    [alarmMode, soundTone]
  );

  // Timer Countdown Logic — TIMESTAMP-BASED (akurat, tidak drift)
  useEffect(() => {
    if (isRunning) {
      // Jika endTimestampRef belum di-set (misal start baru), set sekarang
      if (!endTimestampRef.current) {
        endTimestampRef.current = Date.now() + remainingSeconds * 1000;
      }

      timerIntervalRef.current = setInterval(() => {
        const endTs = endTimestampRef.current;
        if (!endTs) return;

        // Hitung sisa waktu dari endTimestamp — BUKAN dari prev - 1
        const left = Math.round((endTs - Date.now()) / 1000);

        if (left <= 0) {
          triggerAlarmRing();
          endTimestampRef.current = null;
          setRemainingSeconds(0);
        } else {
          setRemainingSeconds(left);
          saveState(targetSeconds, left, true, endTs, isMuted, alarmMode);
        }
      }, 500); // Tick setiap 500ms agar display lebih responsif dan lebih akurat
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
      // Jangan reset endTimestampRef di sini — dibutuhkan saat resume dari pause
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // Auto-Start Handler on Paste Task Info
  const handleAutoStartAlarm = useCallback(() => {
    if (alarmMode !== "auto") return; // Ignore if in manual mode
    stopAlarmSound();
    setIsAlarmActive(false);
    // Set endTimestampRef sebagai sumber kebenaran waktu
    const endTs = Date.now() + targetSeconds * 1000;
    endTimestampRef.current = endTs;
    setRemainingSeconds(targetSeconds);
    setIsRunning(true);
    saveState(targetSeconds, targetSeconds, true, endTs, isMuted, alarmMode);
  }, [targetSeconds, isMuted, alarmMode, saveState, stopAlarmSound]);

  // React to autoStartTriggerCount changes from parent paste event
  useEffect(() => {
    if (autoStartTriggerCount > 0 && autoStartTriggerCount !== prevTriggerRef.current) {
      prevTriggerRef.current = autoStartTriggerCount;
      if (alarmMode === "auto") {
        handleAutoStartAlarm();
      }
    }
  }, [autoStartTriggerCount, alarmMode, handleAutoStartAlarm]);

  const handleSetMode = (mode: "auto" | "manual") => {
    setAlarmMode(mode);
    saveState(targetSeconds, remainingSeconds, isRunning, isRunning ? Date.now() + remainingSeconds * 1000 : null, isMuted, mode);
  };

  // Controls: Start, Pause, Reset, Silence Alarm
  const handleStartManual = () => {
    stopAlarmSound();
    setIsAlarmActive(false);
    const startingSecs = remainingSeconds > 0 ? remainingSeconds : targetSeconds;
    // Set endTimestampRef sebagai sumber kebenaran waktu
    const endTs = Date.now() + startingSecs * 1000;
    endTimestampRef.current = endTs;
    setRemainingSeconds(startingSecs);
    setIsRunning(true);
    saveState(targetSeconds, startingSecs, true, endTs, isMuted);
  };

  const handlePause = () => {
    setIsRunning(false);
    // Simpan remainingSeconds saat pause, reset endTimestampRef
    endTimestampRef.current = null;
    saveState(targetSeconds, remainingSeconds, false, null, isMuted);
  };

  const handleReset = () => {
    stopAlarmSound();
    setIsAlarmActive(false);
    setIsRunning(false);
    endTimestampRef.current = null;
    setRemainingSeconds(targetSeconds);
    saveState(targetSeconds, targetSeconds, false, null, isMuted);
  };

  const handleStopAlarm = () => {
    stopAlarmSound();
    setIsAlarmActive(false);
    setIsRunning(false);
    endTimestampRef.current = null;
    setRemainingSeconds(targetSeconds);
    saveState(targetSeconds, targetSeconds, false, null, isMuted);
  };

  // Change Duration Preset
  const handleSelectPreset = (secs: number) => {
    stopAlarmSound();
    setIsAlarmActive(false);
    setTargetSeconds(secs);
    setRemainingSeconds(secs);
    setIsRunning(false);
    endTimestampRef.current = null;
    saveState(secs, secs, false, null, isMuted);
  };

  const handleApplyCustomInput = () => {
    const mins = parseFloat(customInput);
    if (!isNaN(mins) && mins > 0) {
      const secs = Math.round(mins * 60);
      handleSelectPreset(secs);
      setShowCustomInput(false);
      setCustomInput("");
    }
  };

  const handleTestSound = () => {
    stopAlarmSound();
    const stopFn = playAlarmChimeSequence(soundTone);
    setTimeout(() => {
      stopFn();
    }, 2000);
  };

  // Calculate elapsed progress percentage
  const pctRemaining = targetSeconds > 0 ? Math.max(0, Math.min(100, (remainingSeconds / targetSeconds) * 100)) : 100;
  const pctElapsed = 100 - pctRemaining;

  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-2xl p-5 border transition-all duration-300 shadow-xs space-y-4 ${
        isAlarmActive
          ? "border-amber-500 ring-2 ring-amber-500/50 animate-pulse bg-amber-950/10"
          : "border-[var(--border)]"
      }`}
    >
      {/* Mode Switcher Toggle (Auto vs Manual) */}
      <div className="flex gap-1 p-1 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)]">
        <button
          type="button"
          onClick={() => handleSetMode("auto")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            alarmMode === "auto"
              ? "bg-[var(--primary)] text-white shadow-xs"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title="Alarm otomatis menyala 8.5m saat paste data task"
        >
          <span>⚡</span>
          <span>Auto (Paste)</span>
        </button>
        <button
          type="button"
          onClick={() => handleSetMode("manual")}
          className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            alarmMode === "manual"
              ? "bg-[var(--primary)] text-white shadow-xs"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title="Alarm hanya menyala jika tombol Mulai ditekan manual"
        >
          <span>✋</span>
          <span>Manual</span>
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isAlarmActive
                  ? "bg-amber-500"
                  : isRunning
                  ? "bg-[var(--primary)]"
                  : "bg-[var(--text-secondary)]"
              }`}
            ></span>
          </span>
          <h2 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider truncate">
            🔔 Alarm Pengingat Task
          </h2>
        </div>

        {/* Sound tone selector & sound toggle */}
        <div className="flex items-center gap-1">
          <select
            value={soundTone}
            onChange={(e) => {
              const tone = e.target.value as AlarmSoundTone;
              setSoundTone(tone);
              saveState(targetSeconds, remainingSeconds, isRunning, isRunning ? Date.now() + remainingSeconds * 1000 : null, isMuted, alarmMode, tone);
            }}
            className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none cursor-pointer"
            title="Pilih Nada Suara Alarm"
          >
            <option value="tone1">Suara 1 (Chime ⭐)</option>
            <option value="tone2">Suara 2 (Digital Beep)</option>
            <option value="tone3">Suara 3 (Bell Lembut)</option>
          </select>
          <button
            type="button"
            onClick={handleTestSound}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--bg-surface-alt)] hover:bg-[var(--primary-soft)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors cursor-pointer border border-[var(--border)]"
            title="Tes Suara Alarm"
          >
            🔊 Tes
          </button>
          <button
            type="button"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              if (nextMuted) stopAlarmSound();
              saveState(targetSeconds, remainingSeconds, isRunning, isRunning ? Date.now() + remainingSeconds * 1000 : null, nextMuted, alarmMode, soundTone);
            }}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors cursor-pointer border ${
              isMuted
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border)]"
            }`}
            title={isMuted ? "Suara Alarm Di-Mute" : "Suara Alarm Aktif"}
          >
            {isMuted ? "🔇 Mute" : "🔊 On"}
          </button>
        </div>
      </div>

      {/* Alarm Ringing Banner */}
      {isAlarmActive && (
        <div className="p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl text-center space-y-2 animate-bounce">
          <p className="text-xs font-black text-amber-600 dark:text-amber-300">
            ⏰ WAKTU TASK HABIS! ({targetSeconds / 60} Menit)
          </p>
          <p className="text-[11px] text-[var(--text-primary)] font-medium leading-tight">
            Segera selesaikan dan <strong>submit entri waktu</strong> Anda.
          </p>
          <button
            type="button"
            onClick={handleStopAlarm}
            className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
          >
            🔕 Matikan Alarm
          </button>
        </div>
      )}

      {/* Main Countdown Display */}
      <div className="text-center bg-[var(--bg-base)] rounded-xl p-4 border border-[var(--border)] shadow-inner relative overflow-hidden space-y-1">
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          Sisa Waktu Pengerjaan
        </p>

        <div className="font-mono text-4xl sm:text-5xl font-black text-[var(--primary)] tracking-tight">
          {formatTimeMMSS(remainingSeconds)}
        </div>

        <p className="text-[11px] text-[var(--text-secondary)] font-medium">
          Target: <strong className="text-[var(--text-primary)]">{targetSeconds / 60} menit</strong>
          <span className="ml-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            ({alarmMode === "auto" ? "⚡ Auto Paste" : "✋ Manual"})
          </span>
        </p>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden mt-3">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              pctElapsed > 85 ? "bg-amber-500" : "bg-[var(--primary)]"
            }`}
            style={{ width: `${pctElapsed}%` }}
          />
        </div>
      </div>

      {/* Preset Duration Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Durasi Alarm:
          </span>
          <button
            type="button"
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
          >
            {showCustomInput ? "Tutup" : "+ Kustom Menit"}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => {
            const isSelected = targetSeconds === p.seconds;
            return (
              <button
                key={p.seconds}
                type="button"
                onClick={() => handleSelectPreset(p.seconds)}
                className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/40 shadow-xs"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Duration Input */}
        {showCustomInput && (
          <div className="flex items-center gap-2 pt-2 animate-in fade-in duration-150">
            <input
              type="number"
              step="0.5"
              min="1"
              max="60"
              placeholder="Contoh: 7.5"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-medium"
            />
            <span className="text-xs text-[var(--text-secondary)] font-medium">menit</span>
            <button
              type="button"
              onClick={handleApplyCustomInput}
              className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-hover)] cursor-pointer"
            >
              Set
            </button>
          </div>
        )}
      </div>

      {/* Controls: Mulai / Pause / Reset */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {!isRunning ? (
          <button
            type="button"
            onClick={handleStartManual}
            className="py-2.5 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>▶</span>
            <span>{remainingSeconds < targetSeconds && remainingSeconds > 0 ? "Lanjutkan" : "Mulai Alarm"}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>⏸</span>
            <span>Pause</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="py-2.5 px-3 bg-[var(--bg-surface-alt)] hover:bg-[var(--border)] text-[var(--text-primary)] font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-[var(--border)]"
        >
          <span>🔄</span>
          <span>Reset ({targetSeconds / 60}m)</span>
        </button>
      </div>
    </div>
  );
}
