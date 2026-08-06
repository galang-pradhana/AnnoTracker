"use client";

import React from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSyncQueue } from "@/hooks/useSyncQueue";

export function SyncBadge() {
  const isOnline = useOnlineStatus();
  const { pendingCount, failedCount, isSyncing, triggerSync } = useSyncQueue();

  if (isSyncing) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30 rounded-full text-xs font-medium animate-pulse">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-teal)] animate-ping" />
        Menyinkronkan...
      </div>
    );
  }

  if (failedCount > 0) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--primary-soft)] text-[var(--danger)] border border-[var(--danger)]/30 rounded-full text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-[var(--danger)]" />
        <span>Gagal Sync ({failedCount})</span>
        <button
          onClick={triggerSync}
          className="underline hover:brightness-90 ml-1 font-semibold focus:outline-none"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!isOnline || pendingCount > 0) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--primary-soft)] text-[var(--warning)] border border-[var(--warning)]/30 rounded-full text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
        <span>
          {!isOnline ? "Offline" : "Belum tersinkron"} ({pendingCount})
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30 rounded-full text-xs font-medium">
      <span className="w-2 h-2 rounded-full bg-[var(--accent-teal)]" />
      <span>Tersinkron</span>
    </div>
  );
}
