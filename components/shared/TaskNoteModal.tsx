"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TaskNote } from "@/types";

interface TaskNoteModalProps {
  isOpen: boolean;
  onConfirm: (note: TaskNote) => void;
  onCancel: () => void;
  durationLabel?: string;
}

const EMPTY_NOTE: TaskNote = {
  collection_id: "",
  task_id: "",
  work_id: "",
  user_id_note: "",
};

/**
 * Parse teks format "Key: Value" baris per baris
 * Mendukung format langsung copy-paste dari Scilliance task viewer
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
    task_id: result["task_id"] || "",
    work_id: result["work_id"] || "",
    user_id_note: result["user_id"] || "",
  };
}

const REQUIRED_FIELDS: { key: keyof TaskNote; label: string }[] = [
  { key: "collection_id", label: "Collection ID" },
  { key: "task_id",       label: "Task ID" },
  { key: "work_id",       label: "Work ID" },
  { key: "user_id_note",  label: "User ID" },
];

export function TaskNoteModal({
  isOpen,
  onConfirm,
  onCancel,
  durationLabel,
}: TaskNoteModalProps) {
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<TaskNote>(EMPTY_NOTE);
  const [isVisible, setIsVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRawText("");
      setParsed(EMPTY_NOTE);
      setSubmitted(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      setTimeout(() => textareaRef.current?.focus(), 150);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    setParsed(parseNoteText(val));
  };

  const allFilled = REQUIRED_FIELDS.every(({ key }) => parsed[key].trim() !== "");
  const filledCount = REQUIRED_FIELDS.filter(({ key }) => parsed[key].trim() !== "").length;

  const handleConfirm = () => {
    setSubmitted(true);
    if (allFilled) {
      onConfirm(parsed);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

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

      {/* Modal Panel */}
      <div
        className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden transition-all duration-200"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="task-note-modal-title"
                className="text-sm font-bold text-[var(--text-primary)]"
              >
                📋 Note Task ID — Wajib
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Paste teks dari halaman task, sistem akan otomatis membaca ID-nya
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors shrink-0 cursor-pointer"
              aria-label="Batal"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Durasi badge */}
          {durationLabel && (
            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)]/20">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-[var(--primary)] shrink-0">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className="text-xs font-semibold text-[var(--primary)]">
                Durasi: {durationLabel}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Textarea paste area */}
          <div>
            <label
              htmlFor="note-raw-text"
              className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5"
            >
              Paste teks dari task viewer di sini
            </label>
            <textarea
              ref={textareaRef}
              id="note-raw-text"
              value={rawText}
              onChange={handleTextChange}
              placeholder={`Contoh:\nTask Title: ADM Creation Model\nLink: https://task-viewer.scilliance.com/?taskId=...\nCollection ID: 3558dd71-...\nTask ID: d8081f10-...\nWork ID: ea2f871e-...\nUser ID: c22d9239-...\nAnnotation Tool: task-editor 2.24\nStarshot Version: 4.45.0.1`}
              rows={8}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none leading-relaxed"
            />
          </div>

          {/* Preview hasil parsing */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-3 py-2 bg-[var(--bg-surface-alt)] border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Hasil Parsing Otomatis
              </span>
              <span className={`text-[10px] font-bold ${allFilled ? "text-[var(--accent-teal)]" : "text-[var(--text-secondary)]"}`}>
                {filledCount}/{REQUIRED_FIELDS.length} terdeteksi
              </span>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {REQUIRED_FIELDS.map(({ key, label }) => {
                const val = parsed[key];
                const isFilled = val.trim() !== "";
                const showError = submitted && !isFilled;

                return (
                  <div key={key} className="px-3 py-2 flex items-start gap-2.5">
                    {/* Status icon */}
                    <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                      isFilled
                        ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]"
                        : showError
                        ? "bg-red-500/10 text-[var(--danger)]"
                        : "bg-[var(--border)] text-[var(--text-secondary)]"
                    }`}>
                      {isFilled ? (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                        showError ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"
                      }`}>
                        {label}
                        {showError && <span className="ml-1 normal-case">— tidak terdeteksi</span>}
                      </p>
                      {isFilled ? (
                        <p className="text-xs font-mono text-[var(--text-primary)] break-all leading-tight">
                          {val}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--text-secondary)]/50 italic">
                          —
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-[var(--border)] flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={rawText.trim() === ""}
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
