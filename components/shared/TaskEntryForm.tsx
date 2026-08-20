"use client";

import React, { useState, useEffect } from "react";
import type { ClientAccount, TaskType, TaskNote } from "@/types";

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

const EMPTY_NOTE: TaskNote = {
  collection_id: "",
  task_id: "",
  work_id: "",
  user_id_note: "",
};

const REQUIRED_FIELDS: { key: keyof TaskNote; label: string }[] = [
  { key: "collection_id", label: "Collection ID" },
  { key: "task_id",       label: "Task ID"       },
  { key: "work_id",       label: "Work ID"       },
  { key: "user_id_note",  label: "User ID"       },
];

/**
 * Parse teks format "Key: Value" baris per baris dari halaman Scilliance task viewer
 */
function parseNoteText(text: string): TaskNote {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = line.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, "_");
    const value = line.substring(colonIdx + 1).trim();
    if (value) result[rawKey] = value;
  }
  return {
    collection_id: result["collection_id"] || "",
    task_id:       result["task_id"]       || "",
    work_id:       result["work_id"]       || "",
    user_id_note:  result["user_id"]       || "",
  };
}

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
  onTaskInfoPasted?: () => void;
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
  onTaskInfoPasted,
}: TaskEntryFormProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedTaskType, setSelectedTaskType] = useState<string>("");
  const [isEditingContext, setIsEditingContext] = useState<boolean>(true);

  // Note raw text & auto-parsed state
  const [rawNoteText, setRawNoteText] = useState<string>("");
  const [parsedNote, setParsedNote] = useState<TaskNote>(EMPTY_NOTE);

  // Duration in seconds as number
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [rawInputMode, setRawInputMode] = useState<boolean>(false);
  const [rawSecondsText, setRawSecondsText] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleNoteTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const isNewInput = rawNoteText.trim() === "" && val.trim() !== "";
    setRawNoteText(val);
    setParsedNote(parseNoteText(val));

    if (isNewInput && onTaskInfoPasted) {
      onTaskInfoPasted();
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

  const allNotesFilled = REQUIRED_FIELDS.every(({ key }) => parsedNote[key].trim() !== "");
  const filledCount = REQUIRED_FIELDS.filter(({ key }) => parsedNote[key].trim() !== "").length;
  const isFormValid = Boolean(selectedAccount && selectedTaskType && allNotesFilled && durationSeconds > 0);

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

    if (!allNotesFilled) {
      setErrorMsg("Info Task belum terdeteksi lengkap (wajib 4/4 terdeteksi).");
      return;
    }

    if (durationSeconds <= 0) {
      setErrorMsg("Durasi pekerjaan harus lebih besar dari 0 detik.");
      return;
    }

    onAddTask({
      client_account_id: selectedAccount,
      task_type_id: selectedTaskType,
      duration_seconds: durationSeconds,
      note: JSON.stringify(parsedNote),
    });

    // Reset task entry specific fields after saving
    setRawNoteText("");
    setParsedNote(EMPTY_NOTE);
    setDurationSeconds(0);
    setRawSecondsText("");
  };

  const { timeStr, subText } = formatStopwatchDisplay(durationSeconds);

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-5">
      {/* 1. Context Selector Header */}
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
              className="text-[11px] font-semibold text-[var(--primary)] hover:underline shrink-0 px-2 py-0.5 rounded-md hover:bg-[var(--primary-soft)] cursor-pointer"
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
                  className="text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 2. Paste Info Task dari Task Viewer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="note-raw-text" className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span>📋 Paste Info Task dari Task Viewer</span>
            </label>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              allNotesFilled
                ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30"
                : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border border-[var(--border)]"
            }`}>
              {filledCount}/{REQUIRED_FIELDS.length} terdeteksi
            </span>
          </div>

          <textarea
            id="note-raw-text"
            value={rawNoteText}
            onChange={handleNoteTextChange}
            placeholder={`Task Title: ADM Creation Model\nLink: https://task-viewer.scilliance.com/?taskId=...\nCollection ID: 3558dd71-...\nTask ID: d8081f10-...\nWork ID: ea2f871e-...\nUser ID: c22d9239-...\nAnnotation Tool: task-editor 2.24\nStarshot Version: 4.45.0.1`}
            rows={5}
            autoComplete="off"
            spellCheck={false}
            className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none leading-relaxed"
          />

          {/* Preview Hasil Parsing */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-surface-alt)]">
            <div className="divide-y divide-[var(--border)]">
              {REQUIRED_FIELDS.map(({ key, label }) => {
                const val = parsedNote[key];
                const isFilled = val.trim() !== "";
                return (
                  <div key={key} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        isFilled
                          ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]"
                          : "bg-[var(--border)] text-[var(--text-secondary)]"
                      }`}>
                        {isFilled ? (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="6" height="6" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] shrink-0">
                        {label}:
                      </span>
                    </div>
                    {isFilled ? (
                      <span className="text-xs font-mono text-[var(--text-primary)] truncate max-w-[220px] text-right font-medium">
                        {val}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-secondary)]/50 italic shrink-0">
                        — belum terdeteksi —
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Durasi Pekerjaan (Stopwatch & Presets) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--text-primary)]">
              ⏱️ Durasi Pekerjaan
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRawInputMode(!rawInputMode)}
                className="text-[11px] font-medium text-[var(--primary)] hover:underline cursor-pointer"
              >
                {rawInputMode ? "↔ Mode Stopwatch" : "↔ Mode Ketik Detik"}
              </button>
              {/* Ellipsis button for preset settings */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEllipsisMenu(!showEllipsisMenu)}
                  className="w-6 h-6 rounded-md hover:bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                  title="Opsi Preset"
                >
                  •••
                </button>
                {showEllipsisMenu && (
                  <div className="absolute right-0 top-7 z-20 w-44 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg p-1 animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPresetPanel(true);
                        setShowEllipsisMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] rounded-lg font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>⚙️ Atur Chip Preset</span>
                    </button>
                  </div>
                )}
              </div>
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
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] disabled:opacity-30 text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    title="-1 Menit"
                  >
                    -1m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(-10)}
                    disabled={durationSeconds < 10}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] disabled:opacity-30 text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                    title="+1 Menit"
                  >
                    +1m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(10)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--primary-soft)] text-[var(--text-primary)] font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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
                  className="px-3 py-1.5 bg-[var(--primary-soft)] hover:brightness-95 text-[var(--primary)] border border-[var(--primary)]/20 text-xs font-bold rounded-full transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  {label}
                </button>
              ))}
              {durationSeconds > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDurationSeconds(0);
                    setRawSecondsText("");
                  }}
                  className="px-3 py-1.5 bg-[var(--border)] hover:bg-[var(--border)]/80 text-[var(--text-secondary)] hover:text-[var(--danger)] text-xs font-bold rounded-full transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  Reset
                </button>
              )}
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
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
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
                    className="text-[var(--danger)] font-bold ml-1 cursor-pointer"
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
                className="px-3 py-1 bg-[var(--primary)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--primary-hover)] cursor-pointer"
              >
                + Tambah
              </button>
            </div>
          </div>
        )}

        {/* 4. Submit Button (Primary Terracotta Orange / Disabled when invalid) */}
        <div className="mt-6">
          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full py-3.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>✓ Simpan Entri Pekerjaan</span>
          </button>
          {!isFormValid && (
            <p className="text-center text-[10px] text-[var(--text-secondary)]/70 mt-1.5">
              {!allNotesFilled
                ? "💡 Paste info Task Viewer (wajib 4/4 metadata terdeteksi) dan atur durasi untuk mengaktifkan tombol simpan."
                : durationSeconds <= 0
                ? "💡 Atur durasi pekerjaan (> 0 detik) untuk mengaktifkan tombol simpan."
                : "💡 Pilih Akun Klien dan Jenis Task untuk mengaktifkan tombol simpan."}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
