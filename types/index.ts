export type UserRole = "owner" | "employee";
export type ProofType = "photo" | "note";
export type SyncStatus = "pending" | "synced" | "failed";
export type PaymentStatus = "unpaid" | "paid";

export interface User {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  is_active: boolean;
  created_at: string;
}

export interface ClientAccount {
  id: string;
  name: string;
  language?: string | null;
  is_active: boolean;
}

export interface TaskType {
  id: string;
  name: string;
  is_active: boolean;
}

export interface WorkSession {
  id: string;
  user_id: string;
  session_date: string; // YYYY-MM-DD
  proof_type: ProofType | null;
  proof_url: string | null;
  proof_note: string | null;
  sync_status: SyncStatus;
  created_at: string;
}

export interface TaskEntry {
  id: string;
  session_id: string;
  client_account_id: string;
  task_type_id: string;
  duration_seconds: number;
  entry_order: number;
  created_at: string;
}

export interface SalaryTier {
  id: string;
  min_hours: number;
  max_hours: number | null;
  rate_per_hour: number;
  effective_from: string; // YYYY-MM-DD
}

export interface UserSalaryRate {
  id: string;
  user_id: string;
  rate_per_hour: number;
  effective_from: string; // YYYY-MM-DD
  note?: string | null;
  created_at: string;
  user?: User;
}

export interface BonusRule {
  id: string;
  min_weekly_hours: number;
  bonus_amount: number;
  effective_from: string; // YYYY-MM-DD
}

export interface PayrollRecord {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  base_pay: number;
  bonus_pay: number;
  total_pay: number;
  payment_status: PaymentStatus;
  paid_at: string | null;
}

// Joined / UI helper types
export interface TaskEntryWithDetails extends TaskEntry {
  client_account?: ClientAccount;
  task_type?: TaskType;
}

export interface WorkSessionWithEntries extends WorkSession {
  user?: User;
  task_entries: TaskEntryWithDetails[];
}

export interface PayrollResult {
  user: User;
  period_start: string;
  period_end: string;
  total_hours: number;
  applied_tier: SalaryTier | null;
  base_pay: number;
  bonus_pay: number;
  total_pay: number;
  payment_status: PaymentStatus;
}
