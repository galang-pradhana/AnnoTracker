import { localDB, type SyncQueueItem } from "./db";

export async function addToSyncQueue(
  tableName: SyncQueueItem["table_name"],
  action: SyncQueueItem["action"],
  recordId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const queueItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    table_name: tableName,
    action: action,
    record_id: recordId,
    payload: payload,
    retry_count: 0,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  await localDB.sync_queue.add(queueItem);
  return queueItem.id;
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return await localDB.sync_queue.where("status").equals("pending").toArray();
}

export async function getFailedSyncItems(): Promise<SyncQueueItem[]> {
  return await localDB.sync_queue.where("status").equals("failed").toArray();
}

export async function markSyncSuccess(queueItemId: string): Promise<void> {
  await localDB.sync_queue.delete(queueItemId);
}

export async function markSyncFailure(
  queueItemId: string,
  errorMsg: string
): Promise<void> {
  const item = await localDB.sync_queue.get(queueItemId);
  if (item) {
    const newRetryCount = item.retry_count + 1;
    if (newRetryCount >= 5) {
      // Discard stale un-syncable item after 5 retries to avoid permanent blocking badge
      await localDB.sync_queue.delete(queueItemId);
    } else {
      await localDB.sync_queue.update(queueItemId, {
        status: "failed",
        retry_count: newRetryCount,
        error_message: errorMsg,
      });
    }
  }
}

export async function getSyncQueueSummary() {
  const pendingCount = await localDB.sync_queue
    .where("status")
    .equals("pending")
    .count();
  const failedCount = await localDB.sync_queue
    .where("status")
    .equals("failed")
    .count();
  return { pendingCount, failedCount, total: pendingCount + failedCount };
}
