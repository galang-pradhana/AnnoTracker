-- ============================================================
-- AnnoTracker: Assessment Module Migration
-- Jalankan di: https://supabase.com/dashboard/project/gdqpfxbowtebkghfkpxn/sql/new
-- ============================================================

-- 1. Tabel assessment_tasks
CREATE TABLE IF NOT EXISTS public.assessment_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'closed')),
  form_template JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabel assessment_items
CREATE TABLE IF NOT EXISTS public.assessment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.assessment_tasks(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  user_request TEXT NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabel assessment_submissions
CREATE TABLE IF NOT EXISTS public.assessment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.assessment_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  justification_id TEXT,
  justification_en TEXT,
  score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_assessment_items_task ON public.assessment_items(task_id);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_task ON public.assessment_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_user ON public.assessment_submissions(user_id);

-- 5. Enable RLS
ALTER TABLE public.assessment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_tasks' AND policyname = 'Anyone auth can read tasks'
  ) THEN
    CREATE POLICY "Anyone auth can read tasks" ON public.assessment_tasks
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_tasks' AND policyname = 'Owners manage tasks'
  ) THEN
    CREATE POLICY "Owners manage tasks" ON public.assessment_tasks
      FOR ALL USING (public.is_owner());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_items' AND policyname = 'Anyone auth can read items'
  ) THEN
    CREATE POLICY "Anyone auth can read items" ON public.assessment_items
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_items' AND policyname = 'Owners manage items'
  ) THEN
    CREATE POLICY "Owners manage items" ON public.assessment_items
      FOR ALL USING (public.is_owner());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assessment_submissions' AND policyname = 'Users manage own submissions'
  ) THEN
    CREATE POLICY "Users manage own submissions" ON public.assessment_submissions
      FOR ALL USING (auth.uid() = user_id OR public.is_owner());
  END IF;
END $$;

-- Done!
SELECT 'Assessment tables created successfully!' AS result;
