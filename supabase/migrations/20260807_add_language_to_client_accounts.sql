-- Migration: 20260807_add_language_to_client_accounts.sql
-- Description: Create client_accounts table if missing, add language column, and seed accounts

-- 1. Ensure table client_accounts exists
CREATE TABLE IF NOT EXISTS public.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 2. Add language column
ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS language TEXT;

COMMENT ON COLUMN public.client_accounts.language IS 'Bahasa pengerjaan task untuk akun klien (misal: Thailand, China, Indonesia)';

-- 3. Upsert default client accounts with languages
INSERT INTO public.client_accounts (name, language, is_active) VALUES
  ('preecha', 'Thailand', true),
  ('syimei', 'China', true),
  ('bjunwen', 'China', true)
ON CONFLICT (name) DO UPDATE SET language = EXCLUDED.language;
