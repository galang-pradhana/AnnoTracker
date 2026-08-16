import Dexie, { type Table } from "dexie";
import type { WorkSession, TaskEntry, SyncStatus } from "@/types";

export interface SyncQueueItem {
  id: string; // UUID or auto-id
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: "work_sessions" | "task_entries";
  record_id: string;
  payload: Record<string, unknown>;
  retry_count: number;
  status: SyncStatus; // 'pending' | 'synced' | 'failed'
  error_message?: string;
  created_at: string;
}

export class AnnoTrackerLocalDB extends Dexie {
  work_sessions!: Table<WorkSession, string>;
  task_entries!: Table<TaskEntry, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor() {
    super("AnnoTrackerLocalDB");

    // Version 1 — original schema (kept for migration compatibility)
    this.version(1).stores({
      work_sessions: "id, user_id, session_date, sync_status, created_at",
      task_entries: "id, session_id, client_account_id, task_type_id, created_at",
      sync_queue: "id, action, table_name, record_id, status, created_at",
    });

    // Version 2 — add compound index [user_id+session_date] for efficient per-user daily session lookup
    this.version(2).stores({
      work_sessions: "id, user_id, session_date, sync_status, created_at, [user_id+session_date]",
      task_entries: "id, session_id, client_account_id, task_type_id, created_at",
      sync_queue: "id, action, table_name, record_id, status, created_at",
    });

    // Version 3 — add note field to task_entries for mandatory task metadata (Task ID, Work ID, etc.)
    this.version(3).stores({
      work_sessions: "id, user_id, session_date, sync_status, created_at, [user_id+session_date]",
      task_entries: "id, session_id, client_account_id, task_type_id, created_at",
      sync_queue: "id, action, table_name, record_id, status, created_at",
    });
  }
}

export const localDB = new AnnoTrackerLocalDB();
