-- Migration: 001_initial_schema.sql
-- Description: Core tables and constraints for AnnoTracker

-- 1. Users Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'employee')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Client Accounts Table (Master Data "Nama Akun")
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 3. Task Types Table (Master Data "Jenis Task")
CREATE TABLE IF NOT EXISTS public.task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 4. Work Sessions Table (Daily Sessions)
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  proof_type TEXT CHECK (proof_type IN ('photo', 'note')),
  proof_url TEXT,
  proof_note TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_session_date UNIQUE (user_id, session_date)
);

-- 5. Task Entries Table (Individual tasks inside a session)
CREATE TABLE IF NOT EXISTS public.task_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id),
  task_type_id UUID NOT NULL REFERENCES public.task_types(id),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  entry_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Salary Tiers Table (Hourly Rate Tiers)
CREATE TABLE IF NOT EXISTS public.salary_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_hours NUMERIC(5,2) NOT NULL CHECK (min_hours >= 0),
  max_hours NUMERIC(5,2) CHECK (max_hours IS NULL OR max_hours >= min_hours),
  rate_per_hour INTEGER NOT NULL CHECK (rate_per_hour > 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 7. Bonus Rules Table (Global Weekly Bonus Rules)
CREATE TABLE IF NOT EXISTS public.bonus_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_weekly_hours NUMERIC(5,2) NOT NULL CHECK (min_weekly_hours > 0),
  bonus_amount INTEGER NOT NULL CHECK (bonus_amount > 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 8. Payroll Records Table (Payroll Calculations & History)
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  base_pay INTEGER NOT NULL DEFAULT 0,
  bonus_pay INTEGER NOT NULL DEFAULT 0,
  total_pay INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  paid_at TIMESTAMPTZ,
  proof_url TEXT,
  proof_note TEXT,
  CONSTRAINT unique_user_period UNIQUE (user_id, period_start, period_end)
);

-- Indexes for optimal querying
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date ON public.work_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_task_entries_session ON public.task_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_user_period ON public.payroll_records(user_id, period_start, period_end);

-- Function to handle new user registration automatically via Supabase Auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'employee')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto create public.users on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
