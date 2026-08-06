-- Migration: 002_rls_policies.sql
-- Description: Row Level Security (RLS) Policies for AnnoTracker

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'owner' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. POLICIES FOR public.users
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_owner());

CREATE POLICY "Owners can manage all users" ON public.users
  FOR ALL USING (public.is_owner());

-- 2. POLICIES FOR public.client_accounts
CREATE POLICY "Authenticated users can view client accounts" ON public.client_accounts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage client accounts" ON public.client_accounts
  FOR ALL USING (public.is_owner());

-- 3. POLICIES FOR public.task_types
CREATE POLICY "Authenticated users can view task types" ON public.task_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage task types" ON public.task_types
  FOR ALL USING (public.is_owner());

-- 4. POLICIES FOR public.work_sessions
CREATE POLICY "Employees can CRUD own work sessions" ON public.work_sessions
  FOR ALL USING (auth.uid() = user_id OR public.is_owner());

-- 5. POLICIES FOR public.task_entries
CREATE POLICY "Employees can CRUD own task entries" ON public.task_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.work_sessions
      WHERE work_sessions.id = task_entries.session_id
      AND (work_sessions.user_id = auth.uid() OR public.is_owner())
    )
  );

-- 6. POLICIES FOR public.salary_tiers
CREATE POLICY "Authenticated users can view salary tiers" ON public.salary_tiers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage salary tiers" ON public.salary_tiers
  FOR ALL USING (public.is_owner());

-- 7. POLICIES FOR public.bonus_rules
CREATE POLICY "Authenticated users can view bonus rules" ON public.bonus_rules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage bonus rules" ON public.bonus_rules
  FOR ALL USING (public.is_owner());

-- 8. POLICIES FOR public.payroll_records
CREATE POLICY "Employees can view own payroll records" ON public.payroll_records
  FOR SELECT USING (auth.uid() = user_id OR public.is_owner());

CREATE POLICY "Owners can manage payroll records" ON public.payroll_records
  FOR ALL USING (public.is_owner());
