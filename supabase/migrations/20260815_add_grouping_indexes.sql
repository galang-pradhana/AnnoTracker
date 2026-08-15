-- Migration: Tambah index untuk query grouping per akun/klien, employee, dan tanggal
-- Digunakan oleh fitur "Grouping & Subtotal Jam per Akun/Klien"
-- Index ini bersifat opsional tapi direkomendasikan untuk performa query yang lebih baik.

-- Index untuk task_entries: mempercepat GROUP BY client_account_id dan join ke session
CREATE INDEX IF NOT EXISTS idx_task_entries_client_account
  ON task_entries (client_account_id);

-- Index untuk work_sessions: mempercepat filter per user dan tanggal
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date
  ON work_sessions (user_id, session_date);

-- Composite index untuk aggregasi lintas dimensi
CREATE INDEX IF NOT EXISTS idx_task_entries_session_client
  ON task_entries (session_id, client_account_id);
