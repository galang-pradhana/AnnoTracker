"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { localDB } from "@/lib/offline/db";
import { addToSyncQueue } from "@/lib/offline/syncQueue";
import { processSyncQueue, migrateDemoUserRecords } from "@/lib/offline/syncEngine";
import { useLiveQuery } from "dexie-react-hooks";
import { SyncBadge } from "@/components/shared/SyncBadge";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { SessionSummary } from "@/components/shared/SessionSummary";
import { TaskEntryForm } from "@/components/shared/TaskEntryForm";
import { TaskEntryList } from "@/components/shared/TaskEntryList";
import { LiveTimerCard } from "@/components/shared/LiveTimerCard";
import { ProofUpload } from "@/components/shared/ProofUpload";
import { ROUTES } from "@/constants";
import type {
  ClientAccount,
  TaskType,
  TaskEntryWithDetails,
  WorkSession,
  SalaryTier,
} from "@/types";

// Fallback Master Data if offline / initial load
const MOCK_CLIENT_ACCOUNTS: ClientAccount[] = [
  { id: "ca-1", name: "preecha", language: "Thailand", is_active: true },
  { id: "ca-2", name: "syimei", language: "China", is_active: true },
  { id: "ca-3", name: "bjunwen", language: "China", is_active: true },
];

const MOCK_TASK_TYPES: TaskType[] = [
  { id: "tt-1", name: "PR", is_active: true },
  { id: "tt-2", name: "AFM", is_active: true },
  { id: "tt-3", name: "Arabic LineTask", is_active: true },
  { id: "tt-4", name: "Image Bounding Box", is_active: true },
  { id: "tt-5", name: "Audio Transcription", is_active: true },
];

export default function WorkSessionPage() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];

  // Client-side date rendering to prevent hydration mismatch
  const [formattedDate, setFormattedDate] = useState("");
  useEffect(() => {
    setFormattedDate(
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  const [clientAccounts, setClientAccounts] = useState<ClientAccount[]>(
    MOCK_CLIENT_ACCOUNTS
  );
  const [taskTypes, setTaskTypes] = useState<TaskType[]>(MOCK_TASK_TYPES);
  const [salaryTiers, setSalaryTiers] = useState<SalaryTier[]>([]);
  const [userOverrideRate, setUserOverrideRate] = useState<number | undefined>(undefined);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(
    null
  );

  // State to bridge LiveTimer -> TaskEntryForm
  const [externalDuration, setExternalDuration] = useState<number | null>(null);

  // Initialize or fetch master data & session
  const initSession = useCallback(async () => {
    try {
      const supabase = createClient();

      // Fetch user session or fallback demo user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || "demo-employee-id";

      // Fetch master data & user rates from Supabase
      const [accRes, taskRes, tiersRes, userRateRes] = await Promise.all([
        supabase.from("client_accounts").select("*").eq("is_active", true),
        supabase.from("task_types").select("*").eq("is_active", true),
        supabase.from("salary_tiers").select("*").order("min_hours"),
        supabase.from("user_salary_rates").select("*").eq("user_id", userId).lte("effective_from", todayStr).order("effective_from", { ascending: false }),
      ]);

      if (accRes.data && accRes.data.length > 0) setClientAccounts(accRes.data);
      if (taskRes.data && taskRes.data.length > 0) setTaskTypes(taskRes.data);
      if (tiersRes.data && tiersRes.data.length > 0) setSalaryTiers(tiersRes.data);
      if (userRateRes.data && userRateRes.data.length > 0) {
        setUserOverrideRate(userRateRes.data[0].rate_per_hour);
      }

      // Migrate demo-employee-id records if user is logged in
      await migrateDemoUserRecords(userId);

      // Check if session exists in Dexie IndexedDB for today
      let existingSession = await localDB.work_sessions
        .where("[user_id+session_date]")
        .equals([userId, todayStr])
        .first();

      if (!existingSession) {
        // Create new work session
        const newSessionId = crypto.randomUUID();
        const newSession: WorkSession = {
          id: newSessionId,
          user_id: userId,
          session_date: todayStr,
          proof_type: null,
          proof_url: null,
          proof_note: null,
          sync_status: "pending",
          created_at: new Date().toISOString(),
        };

        await localDB.work_sessions.add(newSession);
        await addToSyncQueue("work_sessions", "INSERT", newSessionId, {
          ...newSession,
        });

        setCurrentSessionId(newSessionId);
        setCurrentSession(newSession);
      } else {
        setCurrentSessionId(existingSession.id);
        setCurrentSession(existingSession);
      }

      // Trigger automatic background sync
      processSyncQueue();
    } catch {
      // Offline fallback: create valid UUID session in localDB
      const fallbackId = crypto.randomUUID();
      const fallbackSession: WorkSession = {
        id: fallbackId,
        user_id: "demo-employee-id",
        session_date: todayStr,
        proof_type: null,
        proof_url: null,
        proof_note: null,
        sync_status: "pending",
        created_at: new Date().toISOString(),
      };
      await localDB.work_sessions.add(fallbackSession).catch(() => {});
      setCurrentSessionId(fallbackId);
      setCurrentSession(fallbackSession);
    }
  }, [todayStr]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Live Query from Dexie IndexedDB for task entries today
  const rawEntries = useLiveQuery(
    () =>
      currentSessionId
        ? localDB.task_entries
            .where("session_id")
            .equals(currentSessionId)
            .toArray()
        : [],
    [currentSessionId],
    []
  );

  // Map entries with client account & task type names
  const entriesWithDetails: TaskEntryWithDetails[] = (rawEntries || []).map(
    (e) => ({
      ...e,
      client_account: clientAccounts.find((a) => a.id === e.client_account_id),
      task_type: taskTypes.find((t) => t.id === e.task_type_id),
    })
  );

  const totalSeconds = entriesWithDetails.reduce(
    (acc, curr) => acc + curr.duration_seconds,
    0
  );

  const handleAddTask = async (data: {
    client_account_id: string;
    task_type_id: string;
    duration_seconds: number;
  }) => {
    if (!currentSessionId) return;

    const newEntryId = crypto.randomUUID();
    const newEntry = {
      id: newEntryId,
      session_id: currentSessionId,
      client_account_id: data.client_account_id,
      task_type_id: data.task_type_id,
      duration_seconds: data.duration_seconds,
      entry_order: entriesWithDetails.length + 1,
      created_at: new Date().toISOString(),
    };

    // Save to IndexedDB
    await localDB.task_entries.add(newEntry);

    // Queue for cloud sync
    await addToSyncQueue("task_entries", "INSERT", newEntryId, { ...newEntry });

    // Reset external duration signal
    setExternalDuration(null);

    // Trigger sync
    processSyncQueue();
  };

  const handleRemoveTask = async (entryId: string) => {
    await localDB.task_entries.delete(entryId);
    await addToSyncQueue("task_entries", "DELETE", entryId, {});
    processSyncQueue();
  };

  const handleSaveProof = async (proofData: {
    proof_type: "photo" | "note";
    proof_url?: string;
    proof_note?: string;
  }) => {
    if (!currentSessionId) return;

    await localDB.work_sessions.update(currentSessionId, {
      proof_type: proofData.proof_type,
      proof_url: proofData.proof_url || null,
      proof_note: proofData.proof_note || null,
      sync_status: "pending",
    });

    const updatedSession = await localDB.work_sessions.get(currentSessionId);
    if (updatedSession) {
      setCurrentSession(updatedSession);
      await addToSyncQueue("work_sessions", "UPDATE", currentSessionId, {
        ...updatedSession,
      });
      processSyncQueue();
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  const handleApplyTimerToForm = (seconds: number) => {
    setExternalDuration(seconds);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {/* Sub-header tanggal */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">
          🗓 {formattedDate || "Memuat tanggal..."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* KOLOM 1 (KIRI) - Ringkasan Hari Ini (~25% width / 3 cols) */}
          {/* Mobile Order: 3 */}
          <div className="lg:col-span-3 order-3 lg:order-1 space-y-6">
            <SessionSummary
              totalSeconds={totalSeconds}
              totalTaskCount={entriesWithDetails.length}
              salaryTiers={salaryTiers}
              overrideRate={userOverrideRate}
              targetHours={8}
              entriesWithDetails={entriesWithDetails}
            />
          </div>

          {/* KOLOM 2 (TENGAH - UTAMA) - Context Selector & Digital Stopwatch Input Form (~50% width / 6 cols) */}
          {/* Mobile Order: 1 */}
          <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
            <TaskEntryForm
              clientAccounts={clientAccounts}
              taskTypes={taskTypes}
              onAddTask={handleAddTask}
              initialDurationSeconds={externalDuration}
            />
          </div>

          {/* KOLOM 3 (KANAN) - Live Timer Card, Log Task Terakhir, & Proof Upload (~25% width / 3 cols) */}
          {/* Mobile Order: 2 (Live Timer) & 4 (Log Task & Proof) */}
          <div className="lg:col-span-3 order-2 lg:order-3 space-y-6">
            {/* Live Timer Card */}
            <LiveTimerCard
              paidSecondsTotal={totalSeconds}
              onApplyTimerToForm={handleApplyTimerToForm}
            />

            {/* Log Task Terakhir */}
            <TaskEntryList
              entries={entriesWithDetails}
              onRemoveTask={handleRemoveTask}
              maxDisplay={10}
            />

            {/* Bukti Kerja / Upload Proof */}
            <ProofUpload
              currentProofType={currentSession?.proof_type || null}
              currentProofUrl={currentSession?.proof_url || null}
              currentProofNote={currentSession?.proof_note || null}
              onSaveProof={handleSaveProof}
            />
          </div>
        </div>
    </div>
  );
}
