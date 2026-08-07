import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(url, key);

const SQL = `
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

ALTER TABLE public.source_guidelines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='source_guidelines' AND policyname='Owner full access on source_guidelines'
  ) THEN
    EXECUTE 'CREATE POLICY "Owner full access on source_guidelines" ON public.source_guidelines FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner())';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='source_guidelines' AND policyname='Authenticated can view source_guidelines'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated can view source_guidelines" ON public.source_guidelines FOR SELECT TO authenticated USING (is_active = true)';
  END IF;
END $$;
`;

const SEED = [
  { title: 'Guideline PR – Thailand (Preecha)',  description: 'Panduan lengkap pengerjaan task PR untuk akun Preecha bahasa Thailand.', category: 'Thailand', icon: '🇹🇭', drive_url: 'https://drive.google.com/your-link-here', display_order: 1 },
  { title: 'Guideline AFM – China (Syimei)',     description: 'Panduan pengerjaan task AFM untuk akun Syimei bahasa Mandarin.',          category: 'China',    icon: '🇨🇳', drive_url: 'https://drive.google.com/your-link-here', display_order: 2 },
  { title: 'Guideline AFM – China (Bjunwen)',    description: 'Panduan pengerjaan task AFM untuk akun Bjunwen bahasa Mandarin.',         category: 'China',    icon: '🇨🇳', drive_url: 'https://drive.google.com/your-link-here', display_order: 3 },
  { title: 'Guideline – Audio Transcription',   description: 'Panduan standar untuk semua task audio transcription lintas akun.',       category: 'Umum',     icon: '🎧',  drive_url: 'https://drive.google.com/your-link-here', display_order: 4 },
  { title: 'Guideline – Image Bounding Box',    description: 'Panduan anotasi gambar bounding box untuk semua akun klien.',             category: 'Umum',     icon: '🖼️',  drive_url: 'https://drive.google.com/your-link-here', display_order: 5 },
];

async function main() {
  console.log('Creating source_guidelines table...');
  
  // Try using rpc exec_sql if available
  const { error: rpcErr } = await supabase.rpc('exec_sql', { sql: SQL });
  if (rpcErr) {
    console.log('exec_sql not available, trying direct insert...');
    // Table might already exist, try seeding directly
  } else {
    console.log('✅ Table created via exec_sql');
  }

  // Check if table already has data
  const { data: existing } = await supabase.from('source_guidelines').select('id').limit(1);
  if (existing && existing.length > 0) {
    console.log('✅ Table already has data, skipping seed');
    
    // Show existing data
    const { data: all } = await supabase.from('source_guidelines').select('*').order('display_order');
    console.log('Current data:', JSON.stringify(all, null, 2));
    return;
  }

  // Seed
  console.log('Seeding data...');
  const { data, error } = await supabase.from('source_guidelines').insert(SEED).select();
  if (error) {
    console.error('Seed error:', error);
  } else {
    console.log('✅ Seeded', data?.length, 'guidelines');
  }

  await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }).catch(() => {});
}

main().catch(console.error);
