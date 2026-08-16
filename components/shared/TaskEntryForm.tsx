"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ClientAccount, TaskType, TaskNote } from "@/types";
import { TaskNoteModal } from "@/components/shared/TaskNoteModal";

interface CustomPreset {
  label: string;
  seconds: number;
}

const DEFAULT_PRESETS: CustomPreset[] = [
  { label: "+580d", seconds: 580 },
  { label: "+15m", seconds: 900 },
  { label: "+30m", seconds: 1800 },
  { label: "+1j", seconds: 3600 },
];

interface TaskEntryFormProps {
  clientAccounts: ClientAccount[];
  taskTypes: TaskType[];
  onAddTask: (data: {
    client_account_id: string;
    task_type_id: string;
    duration_seconds: number;
    note: string; // JSON.stringify(TaskNote)
  }) => void;
  initialDurationSeconds?: number | null;
}

function formatStopwatchDisplay(totalSeconds: number): {
  timeStr: string;
  subText: string;
} {
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return { timeStr: "00:00", subText: "0 detik" };
  }

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  let timeStr = "";
  if (hrs > 0) {
    timeStr = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  } else {
    timeStr = `${pad(mins)}:${pad(secs)}`;
  }

  let subText = "";
  if (hrs > 0) {
    subText = `${hrs} jam ${mins} menit ${secs} detik (${totalSeconds.toLocaleString("id-ID")}s)`;
  } else if (mins > 0) {
    subText = `${mins} menit ${secs} detik (${totalSeconds.toLocaleString("id-ID")}s)`;
  } else {
    subText = `${secs} detik`;
  }

  return { timeStr, subText };
}

export function TaskEntryForm({
  clientAccounts,
  taskTypes,
  onAddTask,
  initialDurationSeconds,
}: TaskEntryFormProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedTaskType, setSelectedTaskType] = useState<string>("");
  const [isEditingContext, setIsEditingContext] = useState<boolean>(true);

  // Duration in seconds as number
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [rawInputMode, setRawInputMode] = useState<boolean>(false);
  const [rawSecondsText, setRawSecondsText] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal note state
  const [showNoteModal, setShowNoteModal] = useState<boolean>(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<{
    client_account_id: string;
    task_type_id: string;
    duration_seconds: number;
  } | null>(null);

  // Presets & Ellipsis menu state
  const [presets, setPresets] = useState<CustomPreset[]>(DEFAULT_PRESETS);
  const [showEllipsisMenu, setShowEllipsisMenu] = useState<boolean>(false);
  const [showPresetPanel, setShowPresetPanel] = useState<boolean>(false);
  const [newAmount, setNewAmount] = useState<string>("");
  const [newUnit, setNewUnit] = useState<"menit" | "jam" | "detik">("menit");

  // Sync initial external duration (from LiveTimer)
  useEffect(() => {
    if (
      initialDurationSeconds !== undefined &&
      initialDurationSeconds !== null &&
      initialDurationSeconds > 0
    ) {
      setDurationSeconds(initialDurationSeconds);
      setRawSecondsText(initialDurationSeconds.toString());
    }
  }, [initialDurationSeconds]);

  // Handle Account and Task selections
  const selectedAccountObj = clientAccounts.find((a) => a.id === selectedAccount);
  const selectedTaskTypeObj = taskTypes.find((t) => t.id === selectedTaskType);

  const handleAccountChange = (id: string) => {
    setSelectedAccount(id);
    if (id && selectedTaskType) {
      setIsEditingContext(false);
    }
  };

  const handleTaskTypeChange = (id: string) => {
    setSelectedTaskType(id);
    if (id && selectedAccount) {
      setIsEditingContext(false);
    }
  };

  // Adjust duration by delta
  const handleAdjustDuration = (deltaSeconds: number) => {
    setDurationSeconds((prev) => {
      const next = Math.max(0, prev + deltaSeconds);
      setRawSecondsText(next.toString());
      return next;
    });
  };

  const handleRawTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRawSecondsText(val);
    const parsed = parseInt(val, 10);
    setDurationSeconds(isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  // Preset Handlers
  const handleAddNewPreset = () => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) return;
    const multiplier = newUnit === "jam" ? 3600 : newUnit === "menit" ? 60 : 1;
    const seconds = Math.round(amount * multiplier);

    let label = "";
    if (newUnit === "jam") label = `+${amount}j`;
    else if (newUnit === "menit") label = `+${amount}m`;
    else label = `+${amount}d`;

    if (!presets.some((p) => p.seconds === seconds)) {
      setPresets((prev) =>
        [...prev, { label, seconds }].sort((a, b) => a.seconds - b.seconds)
      );
    }
    setNewAmount("");
    setShowPresetPanel(false);
    setShowEllipsisMenu(false);
  };

  const handleRemovePreset = (seconds: number) => {
    setPresets((prev) => prev.filter((p) => p.seconds !== seconds));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedAccount) {
      setErrorMsg("Pilih Nama Akun terlebih dahulu.");
      setIsEditingContext(true);
      return;
    }

    if (!selectedTaskType) {
      setErrorMsg("Pilih Jenis Task terlebih dahulu.");
      setIsEditingContext(true);
      return;
    }

    if (durationSeconds <= 0) {
      setErrorMsg("Durasi task harus lebih dari 0 detik.");
      return;
    }

    // Simpan data sementara, buka modal note dulu
    setPendingSubmitData({
      client_account_id: selectedAccount,
      task_type_id: selectedTaskType,
      duration_seconds: durationSeconds,
    });
    setShowNoteModal(true);
  };

  const handleNoteConfirm = (note: TaskNote) => {
    if (!pendingSubmitData) return;

    onAddTask({
      ...pendingSubmitData,
      note: JSON.stringify(note),
    });

    // Reset state
    setShowNoteModal(false);
    setPendingSubmitData(null);
    setDurationSeconds(0);
    setRawSecondsText("");
  };

  const handleNoteCancel = () => {
    setShowNoteModal(false);
    setPendingSubmitData(null);
  };

  const { timeStr, subText } = formatStopwatchDisplay(durationSeconds);

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-5">
      {/* 1. Context Selector Header (Ramping Breadcrumb Pill Style) */}
      <div className="bg-[var(--bg-surface-alt)] rounded-xl p-3 border border-[var(--border)]">
        {!isEditingContext && selectedAccountObj && selectedTaskTypeObj ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] truncate">
              <span className="font-semibold text-[var(--text-secondary)]">
                Konteks Aktif:
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/20 truncate">
                {selectedAccountObj.name}{selectedAccountObj.language ? ` (${selectedAccountObj.language})` : ""}
              </span>
              <span className="text-[var(--text-secondary)]">→</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/20 truncate">
                {selectedTaskTypeObj.name}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingContext(true)}
              className="text-[11px] font-semibold text-[var(--primary)] hover:underline shrink-0 px-2 py-0.5 rounded-md hover:bg-[var(--primary-soft)]"
            >
              ✎ Ganti
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Pengaturan Konteks Task
              </span>
              {selectedAccount && selectedTaskType && (
                <button
                  type="button"
                  onClick={() => setIsEditingContext(false)}
                  className="text-[11px] font-semibold text-[var(--primary)] hover:underline"
                >
                  Selesai
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedAccount}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-primary)] text-xs bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer font-medium"
              >
                <option value="">-- Pilih Akun / Klien --</option>
                {clientAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}{acc.language ? ` (${acc.language})` : ""}
                  </option>
                ))}
              </select>

              <select
                value={selectedTaskType}
                onChange={(e) => handleTaskTypeChange(e.target.value)}
                className="w-full px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-primary)] text-xs bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer font-medium"
              >
                <option value="">-- Pilih Jenis Task --</option>
                {taskTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-[var(--primary-soft)] border border-[var(--danger)]/30 rounded-xl text-xs text-[var(--danger)] font-medium">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 2. Digital Stopwatch Input Section */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[var(--bg-surface-alt)]/60 rounded-2xl p-4 sm:p-5 border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Input Durasi Kerja
            </span>

            {/* Ellipsis Gear Menu Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEllipsisMenu((v) => !v)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
                title="Pengaturan Durasi & Preset"
              >
                <span className="text-base leading-none">⚙️</span>
              </button>

              {showEllipsisMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-[var(--bg-surface)] rounded-xl shadow-lg border border-[var(--border)] z-20 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRawInputMode((v) => !v);
                      setShowEllipsisMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] flex items-center justify-between"
                  >
                    <span>{rawInputMode ? "Modus Stopwatch" : "Modus Ketik Detik"}</span>
                    <span className="text-[10px]">⌨️</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPresetPanel(true);
                      setShowEllipsisMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] flex items-center justify-between"
                  >
                    <span>Atur Preset Cepat</span>
                    <span className="text-[10px]">🛠️</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDurationSeconds(0);
                      setRawSecondsText("");
                      setShowEllipsisMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[var(--danger)] hover:bg-[var(--primary-soft)] flex items-center justify-between border-t border-[var(--border)]"
                  >
                    <span>Reset Durasi</span>
                    <span className="text-[10px]">✕</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stopwatch Big Display + Steppers */}
          {!rawInputMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 pt-1">
                {/* Stepper Kiri (-1m & -10s) */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(-60)}
                    disabled={durationSeconds < 60}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] disabled:opacity-30 text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center"
                    title="-1 Menit"
                  >
                    -1m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(-10)}
                    disabled={durationSeconds < 10}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] disabled:opacity-30 text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center"
                    title="-10 Detik"
                  >
                    -10d
                  </button>
                </div>

                {/* Big Stopwatch Display Center */}
                <div className="flex-1 text-center bg-[var(--bg-surface)] rounded-2xl py-4 sm:py-6 px-2 border border-[var(--border)] shadow-inner overflow-hidden">
                  <div className="font-mono text-3xl sm:text-5xl font-extrabold text-[var(--text-primary)] tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
                    {timeStr}
                  </div>
                  <p className="text-xs font-semibold text-[var(--primary)] mt-1">
                    {subText}
                  </p>
                </div>

                {/* Stepper Kanan (+10s & +1m) */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(60)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center"
                    title="+1 Menit"
                  >
                    +1m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(10)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center"
                    title="+10 Detik"
                  >
                    +10d
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-1">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Ketik Durasi Langsung dalam Detik:
              </label>
              <input
                type="number"
                min="0"
                placeholder="Contoh: 580"
                value={rawSecondsText}
                onChange={handleRawTextChange}
                className="w-full px-4 py-3 text-lg font-mono font-bold rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <p className="text-xs text-[var(--primary)] mt-1">
                {subText}
              </p>
            </div>
          )}

          {/* Quick-Add Chips below stopwatch */}
          <div className="pt-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {presets.map(({ label, seconds }) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => handleAdjustDuration(seconds)}
                  className="px-3 py-1.5 bg-[var(--primary-soft)] hover:brightness-95 text-[var(--primary)] border border-[var(--primary)]/20 text-xs font-bold rounded-full transition-all active:scale-95 shadow-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preset Management Sub-Panel */}
        {showPresetPanel && (
          <div className="p-3.5 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)] space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                ⚙️ Pengaturan Chip Preset
              </p>
              <button
                type="button"
                onClick={() => setShowPresetPanel(false)}
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Tutup ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {presets.map(({ label, seconds }) => (
                <div
                  key={seconds}
                  className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs"
                >
                  <span className="font-semibold text-[var(--text-primary)]">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePreset(seconds)}
                    className="text-[var(--danger)] font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min="1"
                placeholder="Jumlah"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="w-20 px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as any)}
                className="px-2 py-1 rounded-lg border border-[var(--border)] text-xs bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                <option value="menit">Menit</option>
                <option value="detik">Detik</option>
                <option value="jam">Jam</option>
              </select>
              <button
                type="button"
                onClick={handleAddNewPreset}
                className="px-3 py-1 bg-[var(--primary)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--primary-hover)]"
              >
                + Tambah
              </button>
            </div>
          </div>
        )}

        {/* 3. Submit Button */}
        <div className="mt-6 space-y-2">
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Simpan Entri Pekerjaan</span>
          </button>
          {/* Mandatory note reminder */}
          <p className="text-center text-[10px] text-[var(--text-secondary)] flex items-center justify-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Form note Task ID wajib diisi sebelum tersimpan
          </p>
        </div>
      </form>

      {/* Task Note Modal — muncul saat submit */}
      <TaskNoteModal
        isOpen={showNoteModal}
        onConfirm={handleNoteConfirm}
        onCancel={handleNoteCancel}
        durationLabel={pendingSubmitData ? (() => {
          const { timeStr } = formatStopwatchDisplay(pendingSubmitData.duration_seconds);
          return timeStr;
        })() : undefined}
      />
    </div>
  );
}
