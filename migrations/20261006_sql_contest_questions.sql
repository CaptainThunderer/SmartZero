-- ============================================================================
-- SMARTZERO 2.0 — SQL CONTEST QUESTIONS MIGRATION (RECONCILED RBAC)
-- Purpose: Introduce public.sql_questions, public.sql_test_cases, and update
--          public.contest_questions check constraint to allow 'sql' question type.
-- RBAC: Uses public.user_roles and public.is_admin().
-- Idempotent: 100% safe to run multiple times without data loss.
-- ============================================================================

-- 1. Ensure public.is_admin helper is defined and points to public.user_roles
CREATE OR REPLACE FUNCTION public.is_admin(lookup_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = lookup_user_id
      AND role IN ('admin', 'super_admin', 'contest_admin')
  );
$$;

-- 2. Create sql_questions table
CREATE TABLE IF NOT EXISTS public.sql_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  schema_sql text NOT NULL,
  sample_data_sql text DEFAULT '',
  sample_expected_output text DEFAULT '',
  difficulty text NOT NULL DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  time_limit_ms int NOT NULL DEFAULT 2000,
  order_sensitive boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create sql_test_cases table
CREATE TABLE IF NOT EXISTS public.sql_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.sql_questions(id) ON DELETE CASCADE,
  setup_sql text DEFAULT '',
  expected_output text NOT NULL,
  is_sample boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT true,
  weight numeric NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_sql_test_cases_qid ON public.sql_test_cases(question_id);
CREATE INDEX IF NOT EXISTS idx_sql_questions_created_by ON public.sql_questions(created_by);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.sql_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_test_cases ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for sql_questions
DROP POLICY IF EXISTS "admin_manage_sql_questions" ON public.sql_questions;
DROP POLICY IF EXISTS "sql_questions admin manage" ON public.sql_questions;
CREATE POLICY "sql_questions admin manage"
  ON public.sql_questions FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'contest_admin')
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'contest_admin')
    )
  );

DROP POLICY IF EXISTS "sql_questions student read linked" ON public.sql_questions;
CREATE POLICY "sql_questions student read linked"
  ON public.sql_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contest_questions cq
      JOIN public.contests c ON c.id = cq.contest_id
      WHERE cq.question_id = sql_questions.id
        AND c.status IN ('PUBLISHED', 'UPCOMING', 'LIVE', 'ENDED', 'FINAL_RESULTS')
    )
  );

-- 7. RLS Policies for sql_test_cases
DROP POLICY IF EXISTS "admin_manage_sql_test_cases" ON public.sql_test_cases;
DROP POLICY IF EXISTS "sql_test_cases admin manage" ON public.sql_test_cases;
CREATE POLICY "sql_test_cases admin manage"
  ON public.sql_test_cases FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'contest_admin')
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin', 'contest_admin')
    )
  );

DROP POLICY IF EXISTS "sql_test_cases sample read" ON public.sql_test_cases;
CREATE POLICY "sql_test_cases sample read"
  ON public.sql_test_cases FOR SELECT
  TO authenticated
  USING (is_sample = true AND is_hidden = false);

-- 8. Update contest_questions check constraint to allow 'sql' idempotently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contest_questions_question_type_check'
  ) THEN
    ALTER TABLE public.contest_questions DROP CONSTRAINT contest_questions_question_type_check;
  END IF;

  ALTER TABLE public.contest_questions
    ADD CONSTRAINT contest_questions_question_type_check
    CHECK (question_type IN ('mcq', 'coding', 'sql'));
END $$;

-- 9. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
