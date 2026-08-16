"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TaskNote } from "@/types";

interface TaskNoteModalProps {
  isOpen: boolean;
  onConfirm: (data: { note: TaskNote; duration_seconds: number }) => void;
  onCancel: () => void;
  /** Nilai awal durasi dari stopwatch/timer, diteruskan ke input durasi modal */
  initialDurationSeconds?: number;
}

const EMPTY_NOTE: TaskNote = {
  collection_id: "",
  task_id: "",
  work_id: "",
  user_id_note: "",
};

const QUICK_PRESETS = [
  { label: "+580d", seconds: 580 },
  { label: "+15m",  seconds: 900 },
  { label: "+30m",  seconds: 1800 },
  { label: "+1j",   seconds: 3600 },
];

function formatSeconds(total: number): string {
  if (!total || total <= 0) return "0 detik";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Parse teks format "Key: Value" baris per baris —
 * langsung copy-paste dari halaman Scilliance task viewer
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

const REQUIRED_FIELDS: { key: keyof TaskNote; label: string }[] = [
  { key: "collection_id", label: "Collection ID" },
  { key: "task_id",       label: "Task ID"       },
  { key: "work_id",       label: "Work ID"       },
  { key: "user_id_note",  label: "User ID"       },
];

export function TaskNoteModal({
  isOpen,
  onConfirm,
  onCancel,
  initialDurationSeconds = 0,
}: TaskNoteModalProps) {
  const [rawText,       setRawText]       = useState("");
  const [parsed,        setParsed]        = useState<TaskNote>(EMPTY_NOTE);
  const [durSeconds,    setDurSeconds]    = useState(0);
  const [durRawText,    setDurRawText]    = useState("");
  const [isVisible,     setIsVisible]     = useState(false);
  const [submitted,     setSubmitted]     = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRawText("");
      setParsed(EMPTY_NOTE);
      setDurSeconds(initialDurationSeconds);
      setDurRawText(initialDurationSeconds > 0 ? String(initialDurationSeconds) : "");
      setSubmitted(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
      setTimeout(() => textareaRef.current?.focus(), 150);
    } else {
      setIsVisible(false);
    }
  }, [isOpen, initialDurationSeconds]);

  if (!isOpen) return null;

  /* ── handlers ── */
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    setParsed(parseNoteText(val));
  };

  const handleDurChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDurRawText(val);
    const n = parseInt(val, 10);
    setDurSeconds(isNaN(n) || n < 0 ? 0 : n);
  };

  const handleAdjust = (delta: number) => {
    setDurSeconds(prev => {
      const next = Math.max(0, prev + delta);
      setDurRawText(String(next));
      return next;
    });
  };

  const allNotesFilled = REQUIRED_FIELDS.every(({ key }) => parsed[key].trim() !== "");
  const filledCount    = REQUIRED_FIELDS.filter(({ key }) => parsed[key].trim() !== "").length;
  const canSave        = allNotesFilled && durSeconds > 0;

  const handleConfirm = () => {
    setSubmitted(true);
    if (canSave) onConfirm({ note: parsed, duration_seconds: durSeconds });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  /* ── render ── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-note-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: isVisible ? 1 : 0 }}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden transition-all duration-200"
        style={{
          opacity:   isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
        }}
      >
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="task-note-modal-title" className="text-sm font-bold text-[var(--text-primary)]">
                📋 Catat Task
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Paste info task → isi durasi → simpan
              </p>
            </div>
            <button
              type="button" onClick={onCancel}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors shrink-0 cursor-pointer"
              aria-label="Batal"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* STEP 1 — Paste info task */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
              <span className="text-xs font-bold text-[var(--text-primary)]">Paste info task dari task viewer</span>
            </div>

            <textarea
              ref={textareaRef}
              id="note-raw-text"
              value={rawText}
              onChange={handleTextChange}
              placeholder={`Task Title: ADM Creation Model\nLink: https://task-viewer.scilliance.com/?taskId=...\nCollection ID: 3558dd71-...\nTask ID: d8081f10-...\nWork ID: ea2f871e-...\nUser ID: c22d9239-...\nAnnotation Tool: task-editor 2.24\nStarshot Version: 4.45.0.1`}
              rows={6}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none leading-relaxed"
            />

            {/* Preview hasil parsing */}
            <div className="mt-2 rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="px-3 py-1.5 bg-[var(--bg-surface-alt)] border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Hasil Parsing</span>
                <span className={`text-[10px] font-bold ${allNotesFilled ? "text-[var(--accent-teal)]" : "text-[var(--text-secondary)]"}`}>
                  {filledCount}/{REQUIRED_FIELDS.length} terdeteksi
                </span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {REQUIRED_FIELDS.map(({ key, label }) => {
                  const val      = parsed[key];
                  const isFilled = val.trim() !== "";
                  const showErr  = submitted && !isFilled;
                  return (
                    <div key={key} className="px-3 py-2 flex items-start gap-2.5">
                      <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                        isFilled ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]"
                        : showErr  ? "bg-red-500/10 text-[var(--danger)]"
                                   : "bg-[var(--border)] text-[var(--text-secondary)]"
                      }`}>
                        {isFilled
                          ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/></svg>
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${showErr ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}`}>
                          {label}{showErr && <span className="ml-1 normal-case">— tidak terdeteksi</span>}
                        </p>
                        {isFilled
                          ? <p className="text-xs font-mono text-[var(--text-primary)] break-all leading-tight">{val}</p>
                          : <p className="text-xs text-[var(--text-secondary)]/50 italic">—</p>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 2 — Isi Durasi */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
              <span className="text-xs font-bold text-[var(--text-primary)]">Isi durasi kerja</span>
            </div>

            <div className="bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)] p-3 space-y-3">
              {/* Display besar */}
              <div className="text-center">
                <p className="font-mono text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                  {formatSeconds(durSeconds)}
                </p>
                {durSeconds > 0 && (
                  <p className="text-xs text-[var(--primary)] mt-0.5 font-semibold">
                    {durSeconds.toLocaleString("id-ID")} detik
                  </p>
                )}
              </div>

              {/* Input angka detik */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Ketik detik, cth: 580"
                  value={durRawText}
                  onChange={handleDurChange}
                  className={`flex-1 px-3 py-2 text-sm font-mono font-bold rounded-lg border bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                    submitted && durSeconds <= 0
                      ? "border-[var(--danger)] focus:ring-[var(--danger)]/40"
                      : "border-[var(--border)]"
                  }`}
                />
                {submitted && durSeconds <= 0 && (
                  <p className="text-[10px] text-[var(--danger)] font-medium">Wajib &gt; 0</p>
                )}
              </div>

              {/* Quick preset chips */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map(({ label, seconds }) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => handleAdjust(seconds)}
                    className="px-2.5 py-1 text-xs font-bold rounded-full bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/20 hover:brightness-95 active:scale-95 transition-all cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
                {durSeconds > 0 && (
                  <button
                    type="button"
                    onClick={() => { setDurSeconds(0); setDurRawText(""); }}
                    className="px-2.5 py-1 text-xs font-bold rounded-full bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--danger)] active:scale-95 transition-all cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 pt-3 border-t border-[var(--border)] flex items-center gap-3">
          <button
            type="button" onClick={onCancel}
            className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button" onClick={handleConfirm}
            disabled={rawText.trim() === "" && durSeconds <= 0}
            className="flex-[2] py-2.5 px-4 text-xs font-bold rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Simpan Entri Pekerjaan
          </button>
        </div>
      </div>
    </div>
  );
}
