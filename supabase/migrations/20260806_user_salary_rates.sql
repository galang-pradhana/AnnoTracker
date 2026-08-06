-- Migration: Create user_salary_rates table for per-employee custom salary rates & effective dates
CREATE TABLE IF NOT EXISTS public.user_salary_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rate_per_hour NUMERIC NOT NULL CHECK (rate_per_hour >= 0),
  effective_from DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup by user_id and date
CREATE INDEX IF NOT EXISTS idx_user_salary_rates_user_date ON public.user_salary_rates(user_id, effective_from DESC);

-- Enable RLS
ALTER TABLE public.user_salary_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read user_salary_rates"
  ON public.user_salary_rates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage user_salary_rates"
  ON public.user_salary_rates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'owner'
    )
  );
