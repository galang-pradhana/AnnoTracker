"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { localDB } from "@/lib/offline/db";
import { processSyncQueue } from "@/lib/offline/syncEngine";

export function useSyncQueue() {
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = useLiveQuery(
    () => localDB.sync_queue.where("status").equals("pending").count(),
    [],
    0
  );

  const failedCount = useLiveQuery(
    () => localDB.sync_queue.where("status").equals("failed").count(),
    [],
    0
  );

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await processSyncQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    pendingCount: pendingCount ?? 0,
    failedCount: failedCount ?? 0,
    isSyncing,
    triggerSync,
  };
}
