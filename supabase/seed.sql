-- Seed Data: 003_seed_data.sql

-- Insert default Master Data: Client Accounts
INSERT INTO public.client_accounts (name, is_active) VALUES
  ('syimei', true),
  ('preecha', true),
  ('bjunwen', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default Master Data: Task Types
INSERT INTO public.task_types (name, is_active) VALUES
  ('PR', true),
  ('AFM4', true),
  ('VCG - ADM', true),
  ('TA - Proofreading', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default Master Data: Salary Tiers
INSERT INTO public.salary_tiers (min_hours, max_hours, rate_per_hour, effective_from) VALUES
  (0.00, 8.00, 10000, CURRENT_DATE),
  (8.01, 10.00, 11000, CURRENT_DATE),
  (10.01, 12.00, 12000, CURRENT_DATE),
  (12.01, NULL, 12000, CURRENT_DATE);

-- Insert default Master Data: Bonus Rules
INSERT INTO public.bonus_rules (min_weekly_hours, bonus_amount, effective_from) VALUES
  (40.00, 100000, CURRENT_DATE);
