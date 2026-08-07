-- Migration: 20260807_source_guidelines.sql
-- Tabel untuk menyimpan link guideline PDF (owner bisa CRUD dari UI)

CREATE TABLE IF NOT EXISTS public.source_guidelines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'Umum',
  icon         TEXT NOT NULL DEFAULT '📄',
  drive_url    TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: owner bisa semua, authenticated bisa SELECT
ALTER TABLE public.source_guidelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access on source_guidelines" ON public.source_guidelines;
CREATE POLICY "Owner full access on source_guidelines"
  ON public.source_guidelines
  FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Authenticated can view source_guidelines" ON public.source_guidelines;
CREATE POLICY "Authenticated can view source_guidelines"
  ON public.source_guidelines
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Seed data awal
INSERT INTO public.source_guidelines (title, description, category, icon, drive_url, display_order) VALUES
  ('Guideline PR – Thailand (Preecha)',   'Panduan lengkap pengerjaan task PR untuk akun Preecha bahasa Thailand.',  'Thailand', '🇹🇭', 'https://drive.google.com/your-link-here', 1),
  ('Guideline AFM – China (Syimei)',      'Panduan pengerjaan task AFM untuk akun Syimei bahasa Mandarin.',           'China',    '🇨🇳', 'https://drive.google.com/your-link-here', 2),
  ('Guideline AFM – China (Bjunwen)',     'Panduan pengerjaan task AFM untuk akun Bjunwen bahasa Mandarin.',          'China',    '🇨🇳', 'https://drive.google.com/your-link-here', 3),
  ('Guideline – Audio Transcription',    'Panduan standar untuk semua task audio transcription lintas akun.',        'Umum',     '🎧', 'https://drive.google.com/your-link-here', 4),
  ('Guideline – Image Bounding Box',     'Panduan anotasi gambar bounding box untuk semua akun klien.',              'Umum',     '🖼️', 'https://drive.google.com/your-link-here', 5)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
