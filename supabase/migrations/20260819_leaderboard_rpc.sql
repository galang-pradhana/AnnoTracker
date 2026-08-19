-- Migration: 20260819_leaderboard_rpc.sql
-- Description: RPC function untuk leaderboard jam kerja employee
--              Menggunakan SECURITY DEFINER agar bisa membaca data semua employee
--              tanpa membuka akses RLS ke tabel raw (work_sessions, task_entries, users)

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  start_date DATE,
  end_date   DATE
)
RETURNS TABLE (
  user_id       UUID,
  first_name    TEXT,
  total_seconds BIGINT,
  rank          BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER   -- bypass RLS, function berjalan sebagai owner DB
SET search_path = public
AS $$
BEGIN
  -- Hanya bisa dipanggil oleh user yang sudah login (authenticated)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id                                              AS user_id,
    -- Ambil hanya nama depan (split di spasi pertama)
    SPLIT_PART(u.full_name, ' ', 1)                  AS first_name,
    COALESCE(SUM(te.duration_seconds), 0)::BIGINT    AS total_seconds,
    RANK() OVER (ORDER BY COALESCE(SUM(te.duration_seconds), 0) DESC)::BIGINT AS rank
  FROM public.users u
  -- LEFT JOIN agar employee tanpa jam kerja tetap muncul dengan 0
  LEFT JOIN public.work_sessions ws
    ON ws.user_id = u.id
    AND ws.session_date BETWEEN start_date AND end_date
  LEFT JOIN public.task_entries te
    ON te.session_id = ws.id
  WHERE
    u.role = 'employee'
    AND u.is_active = true
  GROUP BY u.id, u.full_name
  ORDER BY total_seconds DESC;
END;
$$;

-- Grant execute hanya kepada authenticated users
-- (anonymous / unauthenticated tidak bisa memanggil fungsi ini)
REVOKE ALL ON FUNCTION public.get_leaderboard(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(DATE, DATE) TO authenticated;

-- Komentar dokumentasi
COMMENT ON FUNCTION public.get_leaderboard(DATE, DATE) IS
  'Mengembalikan klasemen jam kerja seluruh employee aktif dalam rentang tanggal tertentu.
   Berjalan dengan SECURITY DEFINER untuk bypass RLS secara aman.
   Hanya bisa dipanggil oleh authenticated users.
   Output: user_id, first_name (nama depan saja), total_seconds, rank.';
