-- ============================================================
-- CLEANUP: Hapus semua data dummy sebelum 15 Agustus 2026
-- Tanggal real pertama: 2026-08-15
-- ============================================================
-- ⚠️  WAJIB jalankan dalam urutan yang benar (task_entries dulu,
--     baru work_sessions) karena ada FK cascade.
-- ✅  Aman dijalankan berkali-kali (idempotent).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 0: PREVIEW dulu — lihat data yang akan dihapus
-- Jalankan ini SEBELUM hapus sungguhan, pastikan datanya benar
-- ────────────────────────────────────────────────────────────

-- Berapa banyak session dummy?
SELECT
  session_date,
  COUNT(*) AS jumlah_session,
  COUNT(DISTINCT user_id) AS jumlah_karyawan
FROM public.work_sessions
WHERE session_date < '2026-08-15'
GROUP BY session_date
ORDER BY session_date;

-- Berapa banyak task entry dummy?
SELECT
  ws.session_date,
  COUNT(te.id) AS jumlah_entries,
  SUM(te.duration_seconds) / 3600.0 AS total_jam
FROM public.task_entries te
JOIN public.work_sessions ws ON ws.id = te.session_id
WHERE ws.session_date < '2026-08-15'
GROUP BY ws.session_date
ORDER BY ws.session_date;

-- Total ringkasan
SELECT
  COUNT(DISTINCT ws.id)  AS total_sessions_dummy,
  COUNT(te.id)           AS total_entries_dummy,
  ROUND(SUM(te.duration_seconds) / 3600.0, 2) AS total_jam_dummy
FROM public.work_sessions ws
LEFT JOIN public.task_entries te ON te.session_id = ws.id
WHERE ws.session_date < '2026-08-15';


-- ────────────────────────────────────────────────────────────
-- STEP 1: HAPUS SUNGGUHAN
-- Jalankan setelah preview sudah dicek dan yakin
-- ────────────────────────────────────────────────────────────

-- 1a. Hapus task_entries dari session dummy
--     (sebenarnya ON DELETE CASCADE sudah handle ini,
--      tapi explicit lebih aman untuk audit trail)
DELETE FROM public.task_entries
WHERE session_id IN (
  SELECT id FROM public.work_sessions
  WHERE session_date < '2026-08-15'
);

-- 1b. Hapus work_sessions dummy
DELETE FROM public.work_sessions
WHERE session_date < '2026-08-15';


-- ────────────────────────────────────────────────────────────
-- STEP 2: Hapus payroll_records dummy (jika ada)
-- Periode payroll yang seluruhnya sebelum 15 Agustus
-- ────────────────────────────────────────────────────────────

-- Preview dulu
SELECT
  pr.id,
  u.full_name,
  pr.period_start,
  pr.period_end,
  pr.total_hours,
  pr.total_pay,
  pr.payment_status
FROM public.payroll_records pr
JOIN public.users u ON u.id = pr.user_id
WHERE pr.period_end < '2026-08-15'
ORDER BY pr.period_start, u.full_name;

-- Hapus (uncomment kalau sudah yakin)
-- DELETE FROM public.payroll_records
-- WHERE period_end < '2026-08-15';


-- ────────────────────────────────────────────────────────────
-- STEP 3: VERIFIKASI SETELAH HAPUS
-- Pastikan hanya data tgl 15 Agustus ke atas yang tersisa
-- ────────────────────────────────────────────────────────────

-- Cek tidak ada sisa data dummy
SELECT
  MIN(session_date) AS tanggal_paling_awal,
  MAX(session_date) AS tanggal_paling_akhir,
  COUNT(*) AS total_sessions
FROM public.work_sessions;

-- Ringkasan data real yang tersisa
SELECT
  ws.session_date,
  COUNT(DISTINCT ws.user_id) AS jumlah_karyawan,
  COUNT(te.id) AS jumlah_entries,
  ROUND(SUM(te.duration_seconds) / 3600.0, 2) AS total_jam
FROM public.work_sessions ws
LEFT JOIN public.task_entries te ON te.session_id = ws.id
GROUP BY ws.session_date
ORDER BY ws.session_date;
