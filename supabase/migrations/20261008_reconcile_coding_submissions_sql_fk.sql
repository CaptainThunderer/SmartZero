-- ============================================================================
-- SMARTZERO 2.0 — RECONCILE CODING SUBMISSIONS REFERENTIAL INTEGRITY
-- Purpose: Replace single-table coding_submissions_question_id_fkey with a
--          hardened polymorphic referential integrity trigger system that:
--          1. Enforces allowed language values (python, javascript, typescript, cpp, java, sql)
--             and blocks NULL or unapproved language strings.
--          2. Validates language = 'sql' against public.sql_questions(id).
--          3. Validates language != 'sql' against public.coding_questions(id).
--          4. Acquires row-level 'FOR KEY SHARE' locks on parent question rows to
--             serialize against concurrent DELETE transactions (proven concurrency safety).
--          5. Enforces bidirectional ON DELETE RESTRICT on sql_questions and coding_questions
--             distinguishing parent table and language cleanly.
--          6. Hardened with SECURITY DEFINER, search_path = public, pg_temp,
--             and no unnecessary privileges granted to anon or authenticated roles.
-- Idempotent: 100% safe to execute repeatedly without schema disruption or data loss.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Preflight Safety Assertion: Ensure no orphaned records exist before drop
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_orphan_count integer;
  v_mismatch_count integer;
BEGIN
  -- Check for orphaned submissions missing from both parent tables
  SELECT count(*)
  INTO v_orphan_count
  FROM public.coding_submissions cs
  WHERE NOT EXISTS (SELECT 1 FROM public.coding_questions cq WHERE cq.id = cs.question_id)
    AND NOT EXISTS (SELECT 1 FROM public.sql_questions sq WHERE sq.id = cs.question_id);

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Preflight abort: % orphaned submission(s) found in coding_submissions. Remediate before applying migration.', v_orphan_count;
  END IF;

  -- Check for cross-type mismatches
  SELECT count(*)
  INTO v_mismatch_count
  FROM public.coding_submissions cs
  WHERE (cs.language = 'sql' AND NOT EXISTS (SELECT 1 FROM public.sql_questions sq WHERE sq.id = cs.question_id))
     OR (cs.language <> 'sql' AND NOT EXISTS (SELECT 1 FROM public.coding_questions cq WHERE cq.id = cs.question_id));

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Preflight abort: % question-type mismatch submission(s) found. Remediate before applying migration.', v_mismatch_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Language Domain Validation Constraint (Enforce Allowed Languages)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_coding_submissions_language'
      AND table_name = 'coding_submissions'
  ) THEN
    ALTER TABLE public.coding_submissions
      ADD CONSTRAINT chk_coding_submissions_language
      CHECK (language IN ('python', 'javascript', 'typescript', 'cpp', 'java', 'sql'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Drop Legacy Single-Table Foreign Key Constraint
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'coding_submissions_question_id_fkey'
      AND table_name = 'coding_submissions'
  ) THEN
    ALTER TABLE public.coding_submissions DROP CONSTRAINT coding_submissions_question_id_fkey;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Polymorphic Validation Function with Concurrency Locking (FOR KEY SHARE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coding_submission_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_locked_id uuid;
BEGIN
  -- Strict language domain validation
  IF NEW.language IS NULL THEN
    RAISE EXCEPTION 'Submission language cannot be NULL'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate SQL submissions with parent row-level shared lock
  IF NEW.language = 'sql' THEN
    BEGIN
      SELECT id INTO STRICT v_locked_id
      FROM public.sql_questions
      WHERE id = NEW.question_id
      FOR KEY SHARE;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION 'Foreign key violation: question_id % does not exist in sql_questions for language %',
          NEW.question_id, NEW.language
          USING ERRCODE = 'foreign_key_violation';
    END;
  -- Validate standard programming questions with parent row-level shared lock
  ELSIF NEW.language IN ('python', 'javascript', 'typescript', 'cpp', 'java') THEN
    BEGIN
      SELECT id INTO STRICT v_locked_id
      FROM public.coding_questions
      WHERE id = NEW.question_id
      FOR KEY SHARE;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION 'Foreign key violation: question_id % does not exist in coding_questions for language %',
          NEW.question_id, NEW.language
          USING ERRCODE = 'foreign_key_violation';
    END;
  ELSE
    RAISE EXCEPTION 'Invalid submission language: %', NEW.language
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Secure function permissions: Explicitly revoke from PUBLIC, anon, authenticated, service_role
REVOKE ALL ON FUNCTION public.validate_coding_submission_question() FROM PUBLIC;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE 'REVOKE ALL ON FUNCTION public.validate_coding_submission_question() FROM ' || quote_ident(r);
    END IF;
  END LOOP;
END $$;

-- Attach trigger to coding_submissions
DROP TRIGGER IF EXISTS trg_validate_coding_submission_question ON public.coding_submissions;
CREATE TRIGGER trg_validate_coding_submission_question
  BEFORE INSERT OR UPDATE OF question_id, language ON public.coding_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_coding_submission_question();

-- ----------------------------------------------------------------------------
-- 5. Reverse Deletion Protection: Enforce ON DELETE RESTRICT cleanly by table
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_delete_sql_question_with_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.coding_submissions
    WHERE question_id = OLD.id
      AND language = 'sql'
  ) THEN
    RAISE EXCEPTION 'Foreign key violation: cannot delete SQL question % because submissions exist in coding_submissions', OLD.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_delete_sql_question_with_submissions() FROM PUBLIC;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE 'REVOKE ALL ON FUNCTION public.prevent_delete_sql_question_with_submissions() FROM ' || quote_ident(r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_delete_sql_question ON public.sql_questions;
CREATE TRIGGER trg_prevent_delete_sql_question
  BEFORE DELETE ON public.sql_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_sql_question_with_submissions();

CREATE OR REPLACE FUNCTION public.prevent_delete_coding_question_with_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.coding_submissions
    WHERE question_id = OLD.id
      AND language <> 'sql'
  ) THEN
    RAISE EXCEPTION 'Foreign key violation: cannot delete coding question % because submissions exist in coding_submissions', OLD.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_delete_coding_question_with_submissions() FROM PUBLIC;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE 'REVOKE ALL ON FUNCTION public.prevent_delete_coding_question_with_submissions() FROM ' || quote_ident(r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_delete_coding_question ON public.coding_questions;
CREATE TRIGGER trg_prevent_delete_coding_question
  BEFORE DELETE ON public.coding_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_coding_question_with_submissions();

-- ----------------------------------------------------------------------------
-- 6. Performance Indexes for Rapid Submissions & Constraint Verification
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_coding_submissions_question_lang
  ON public.coding_submissions(question_id, language);

CREATE INDEX IF NOT EXISTS idx_coding_submissions_contest_user
  ON public.coding_submissions(contest_id, user_id);
