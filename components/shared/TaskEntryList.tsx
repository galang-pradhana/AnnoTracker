"use client";

import React from "react";
import type { TaskEntryWithDetails } from "@/types";
import { formatSecondsToTime } from "@/lib/utils";

interface TaskEntryListProps {
  entries: TaskEntryWithDetails[];
  onRemoveTask: (entryId: string) => void;
  maxDisplay?: number;
}

function formatSubmitTime(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TaskEntryList({
  entries,
  onRemoveTask,
  maxDisplay = 10,
}: TaskEntryListProps) {
  // Sort by created_at descending (latest entries on top)
  const sortedEntries = [...entries].reverse();
  const recentEntries = sortedEntries.slice(0, maxDisplay);

  if (entries.length === 0) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs text-center">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] flex items-center justify-center mx-auto mb-2 text-base">
          📋
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)]">
          Belum Ada Task Dicatat
        </p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          Task yang Anda submit hari ini akan muncul di sini sebagai bukti tersimpan.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📑</span>
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Log Task Terakhir ({entries.length})
          </h3>
        </div>
        <span className="text-[10px] text-[var(--accent-teal)] font-bold bg-[var(--accent-teal-soft)] px-2 py-0.5 rounded-full border border-[var(--accent-teal)]/30">
          ✓ Tersimpan
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto pr-1 space-y-2 divide-y divide-[var(--border)]">
        {recentEntries.map((entry) => {
          const submitTime = formatSubmitTime(entry.created_at);

          // Parse note JSON jika ada
          let taskId: string | null = null;
          if (entry.note) {
            try {
              const parsed = JSON.parse(entry.note);
              taskId = parsed.task_id || null;
            } catch {
              // note bukan JSON valid, abaikan
            }
          }

          return (
            <div
              key={entry.id}
              className="pt-2 first:pt-0 flex items-start justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-[var(--text-primary)] truncate">
                    {entry.task_type?.name || "Task"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {entry.client_account?.name || "Akun Klien"}
                </p>
                {/* Task ID singkat dari note */}
                {taskId && (
                  <p className="text-[10px] text-[var(--primary)] truncate mt-0.5 flex items-center gap-1" title={`Task ID: ${taskId}`}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    {taskId.substring(0, 8)}…
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span className="font-mono font-bold text-[var(--primary)] block text-xs">
                    {formatSecondsToTime(entry.duration_seconds)}
                  </span>
                  {submitTime && (
                    <span className="text-[10px] text-[var(--text-secondary)] block">
                      Jam {submitTime}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onRemoveTask(entry.id)}
                  className="text-[var(--text-secondary)] hover:text-[var(--danger)] p-1 transition-colors cursor-pointer"
                  title="Hapus entri"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
