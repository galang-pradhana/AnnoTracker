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

  const handleOpenModal = () => {
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

    // Durasi akan diisi di dalam modal
    setPendingSubmitData({
      client_account_id: selectedAccount,
      task_type_id: selectedTaskType,
    });
    setShowNoteModal(true);
  };

  const handleNoteConfirm = ({ note, duration_seconds }: { note: TaskNote; duration_seconds: number }) => {
    if (!pendingSubmitData) return;

    onAddTask({
      ...pendingSubmitData,
      duration_seconds,
      note: JSON.stringify(note),
    });

    setShowNoteModal(false);
    setPendingSubmitData(null);
    // Reset durasi referensi di form utama juga
    setDurationSeconds(0);
    setRawSecondsText("");
  };

  const handleNoteCancel = () => {
    setShowNoteModal(false);
    setPendingSubmitData(null);
  };

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

      {/* 2. Tombol utama — membuka modal Catat Task */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleOpenModal}
          className="w-full py-4 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h4M12 16h4M8 12h.01M8 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>📋 Catat Task</span>
        </button>
        <p className="text-center text-[10px] text-[var(--text-secondary)] flex items-center justify-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Paste info task → isi durasi → simpan
        </p>
      </div>

      {/* Task Note Modal */}
      <TaskNoteModal
        isOpen={showNoteModal}
        onConfirm={handleNoteConfirm}
        onCancel={handleNoteCancel}
        initialDurationSeconds={durationSeconds > 0 ? durationSeconds : undefined}
      />
    </div>
  );
}
