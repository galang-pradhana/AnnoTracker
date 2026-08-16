-- Migration: 20260816_add_note_to_task_entries.sql
-- Description: Tambah kolom `note` ke tabel task_entries untuk menyimpan
--              metadata task wajib (Task ID, Work ID, Collection ID, dll.)
--              dalam format JSON.

-- Tambah kolom note (TEXT, nullable untuk backward compat data lama)
ALTER TABLE public.task_entries
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Komentar kolom untuk dokumentasi
COMMENT ON COLUMN public.task_entries.note IS
  'JSON stringified TaskNote: berisi task_title, task_link, collection_id, task_id, work_id, user_id_note, annotation_tool, starshot_version';

-- Optional: tambah index GIN untuk pencarian di dalam JSON note jika diperlukan di masa depan
-- (dikomentari karena belum digunakan, aktifkan jika perlu full-text search di note)
-- CREATE INDEX IF NOT EXISTS idx_task_entries_note_gin
--   ON public.task_entries USING gin(note::jsonb);
