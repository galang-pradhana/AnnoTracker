import { createClient } from "@/lib/supabase/client";
import { localDB } from "./db";
import {
  markSyncSuccess,
  markSyncFailure,
} from "./syncQueue";

let isSyncing = false;

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function migrateDemoUserRecords(realUserId: string): Promise<void> {
  if (!realUserId || realUserId === "demo-employee-id") return;

  try {
    const demoSessions = await localDB.work_sessions
      .where("user_id")
      .equals("demo-employee-id")
      .toArray();

    for (const session of demoSessions) {
      const existingRealSession = await localDB.work_sessions
        .where("[user_id+session_date]")
        .equals([realUserId, session.session_date])
        .first();

      if (existingRealSession) {
        const demoEntries = await localDB.task_entries
          .where("session_id")
          .equals(session.id)
          .toArray();

        for (const entry of demoEntries) {
          await localDB.task_entries.update(entry.id, { session_id: existingRealSession.id });
          
          const queueItems = await localDB.sync_queue
            .where("record_id")
            .equals(entry.id)
            .toArray();
          for (const qItem of queueItems) {
            const payload = { ...qItem.payload, session_id: existingRealSession.id };
            await localDB.sync_queue.update(qItem.id, { payload });
          }
        }

        await localDB.work_sessions.delete(session.id);

        const queueSessItems = await localDB.sync_queue
          .where("record_id")
          .equals(session.id)
          .toArray();
        for (const qItem of queueSessItems) {
          await localDB.sync_queue.delete(qItem.id);
        }
      } else {
        await localDB.work_sessions.update(session.id, { user_id: realUserId });

        const queueSessItems = await localDB.sync_queue
          .where("record_id")
          .equals(session.id)
          .toArray();
        for (const qItem of queueSessItems) {
          const payload = { ...qItem.payload, user_id: realUserId };
          await localDB.sync_queue.update(qItem.id, { payload });
        }
      }
    }
  } catch (err) {
    console.error("Failed to migrate offline demo sessions:", err);
  }
}

export async function processSyncQueue(): Promise<{
  successCount: number;
  failureCount: number;
}> {
  if (isSyncing) return { successCount: 0, failureCount: 0 };
  if (typeof window !== "undefined" && !navigator.onLine) {
    return { successCount: 0, failureCount: 0 };
  }

  isSyncing = true;
  let successCount = 0;
  let failureCount = 0;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Reset all "failed" items to "pending" so retrying re-evaluates them
    const failedItems = await localDB.sync_queue.where("status").equals("failed").toArray();
    for (const item of failedItems) {
      await localDB.sync_queue.update(item.id, { status: "pending" });
    }

    // 2. Fetch all pending sync items
    const pendingItems = await localDB.sync_queue.where("status").equals("pending").toArray();
    if (pendingItems.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    // Sort pending items chronologically to avoid FK constraint errors
    pendingItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 3. Fetch current Master Data from Supabase to resolve any mock/invalid IDs
    const [clientRes, taskRes] = await Promise.all([
      supabase.from("client_accounts").select("*"),
      supabase.from("task_types").select("*"),
    ]);

    const realClients = clientRes.data || [];
    const realTaskTypes = taskRes.data || [];

    // Fallback ID mapping for mock IDs if user selected mock data offline
    const mockClientMap: Record<string, string> = {
      "ca-1": realClients.find((c) => c.name.toLowerCase() === "aatikah")?.id || realClients[0]?.id,
      "ca-2": realClients.find((c) => c.name.toLowerCase() === "preecha")?.id || realClients[0]?.id,
      "ca-3": realClients.find((c) => c.name.toLowerCase() === "farah")?.id || realClients[0]?.id,
    };

    const mockTaskMap: Record<string, string> = {
      "tt-1": realTaskTypes.find((t) => t.name.toLowerCase() === "pr")?.id || realTaskTypes[0]?.id,
      "tt-2": realTaskTypes.find((t) => t.name.toLowerCase() === "afm")?.id || realTaskTypes[0]?.id,
      "tt-3": realTaskTypes.find((t) => t.name.toLowerCase().includes("arabic"))?.id || realTaskTypes[0]?.id,
      "tt-4": realTaskTypes.find((t) => t.name.toLowerCase().includes("image"))?.id || realTaskTypes[0]?.id,
      "tt-5": realTaskTypes.find((t) => t.name.toLowerCase().includes("audio"))?.id || realTaskTypes[0]?.id,
    };

    // Cache for valid session UUID for today
    let validSessionId: string | null = null;

    for (const item of pendingItems) {
      try {
        if (item.action === "INSERT" || item.action === "UPDATE") {
          const payload = { ...item.payload };

          // Sanitize work_sessions
          if (item.table_name === "work_sessions") {
            if (!isValidUUID(String(payload.id))) {
              payload.id = crypto.randomUUID();
            }
            if (user?.id) {
              payload.user_id = user.id;
            }
            validSessionId = String(payload.id);
          }

          // Sanitize task_entries
          if (item.table_name === "task_entries") {
            if (!isValidUUID(String(payload.id))) {
              payload.id = crypto.randomUUID();
            }

            // Fix invalid session_id (e.g., "session-2026-07-28")
            if (!isValidUUID(String(payload.session_id))) {
              const todayStr = new Date().toISOString().split("T")[0];
              if (validSessionId && isValidUUID(validSessionId)) {
                payload.session_id = validSessionId;
              } else {
                // Find or create valid session in Supabase for user & date
                const { data: sessData } = await supabase
                  .from("work_sessions")
                  .select("id")
                  .eq("user_id", user?.id)
                  .eq("session_date", todayStr)
                  .maybeSingle();

                if (sessData?.id && isValidUUID(sessData.id)) {
                  payload.session_id = sessData.id;
                  validSessionId = sessData.id;
                } else if (user?.id) {
                  // Create session in Supabase first
                  const newSessId = crypto.randomUUID();
                  await supabase.from("work_sessions").insert({
                    id: newSessId,
                    user_id: user.id,
                    session_date: todayStr,
                    proof_type: null,
                    proof_url: null,
                    proof_note: null,
                    sync_status: "synced",
                    created_at: new Date().toISOString(),
                  });
                  payload.session_id = newSessId;
                  validSessionId = newSessId;
                }
              }
            }

            // Fix client_account_id & task_type_id if mock or invalid
            const rawClientId = String(payload.client_account_id || "");
            const rawTaskId = String(payload.task_type_id || "");

            if (mockClientMap[rawClientId]) {
              payload.client_account_id = mockClientMap[rawClientId];
            } else if (!realClients.some((c) => c.id === rawClientId) && realClients.length > 0) {
              payload.client_account_id = realClients[0].id;
            }

            if (mockTaskMap[rawTaskId]) {
              payload.task_type_id = mockTaskMap[rawTaskId];
            } else if (!realTaskTypes.some((t) => t.id === rawTaskId) && realTaskTypes.length > 0) {
              payload.task_type_id = realTaskTypes[0].id;
            }
          }

          // Filter payload to only retain columns that exist in standard Supabase schema
          const workSessionColumns = new Set([
            "id",
            "user_id",
            "session_date",
            "proof_type",
            "proof_url",
            "proof_note",
            "sync_status",
            "created_at",
          ]);
          const taskEntryColumns = new Set([
            "id",
            "session_id",
            "client_account_id",
            "task_type_id",
            "duration_seconds",
            "entry_order",
            "created_at",
          ]);

          const allowedColumns =
            item.table_name === "work_sessions" ? workSessionColumns : taskEntryColumns;

          const cleanPayload: Record<string, unknown> = {};
          for (const key of Object.keys(payload)) {
            if (allowedColumns.has(key)) {
              cleanPayload[key] = payload[key];
            }
          }

          let { error } = await supabase
            .from(item.table_name)
            .upsert(cleanPayload, { onConflict: "id" });

          // If duplicate unique_user_session_date, fetch existing session id and update local cache
          if (error && item.table_name === "work_sessions" && error.message.includes("unique_user_session_date")) {
            const { data: existing } = await supabase
              .from("work_sessions")
              .select("id")
              .eq("user_id", payload.user_id)
              .eq("session_date", payload.session_date)
              .maybeSingle();
            if (existing?.id) {
              validSessionId = existing.id;
              await localDB.work_sessions.update(item.record_id, { sync_status: "synced" });
              await markSyncSuccess(item.id);
              successCount++;
              continue;
            }
          }

          if (error) {
            console.error(`Sync error on ${item.table_name}:`, error.message);
            await markSyncFailure(item.id, error.message);
            failureCount++;
          } else {
            await markSyncSuccess(item.id);
            if (item.table_name === "work_sessions") {
              await localDB.work_sessions.update(item.record_id, {
                sync_status: "synced",
              });
            }
            successCount++;
          }

        } else if (item.action === "DELETE") {
          // If record_id is not a valid UUID, just mark as success (local clean up)
          if (!isValidUUID(String(item.record_id))) {
            await markSyncSuccess(item.id);
            successCount++;
            continue;
          }

          const { error } = await supabase
            .from(item.table_name)
            .delete()
            .eq("id", item.record_id);

          if (error) {
            await markSyncFailure(item.id, error.message);
            failureCount++;
          } else {
            await markSyncSuccess(item.id);
            successCount++;
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Sync error";
        await markSyncFailure(item.id, errorMsg);
        failureCount++;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { successCount, failureCount };
}
