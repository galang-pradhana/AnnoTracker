-- Migration: Add contact and bank info columns to users table
-- Adds phone number and bank account fields for payroll purposes

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

COMMENT ON COLUMN public.users.phone IS 'No. HP / WhatsApp karyawan';
COMMENT ON COLUMN public.users.bank_name IS 'Nama bank untuk transfer gaji (BCA, BRI, Mandiri, dll)';
COMMENT ON COLUMN public.users.bank_account_number IS 'Nomor rekening bank karyawan';
COMMENT ON COLUMN public.users.bank_account_holder IS 'Nama pemilik rekening sesuai buku tabungan';
