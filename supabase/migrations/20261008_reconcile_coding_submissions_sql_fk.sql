-- ============================================================================
-- SMARTZERO 2.0 — RECONCILE CODING SUBMISSIONS QUESTION ID FOREIGN KEY
-- Purpose: Drop coding_submissions_question_id_fkey so coding_submissions can
--          persist both coding_questions and sql_questions submissions.
-- Idempotent: 100% safe to run multiple times without error or data loss.
-- ============================================================================

DO $$
BEGIN
  -- Drop the foreign key constraint referencing coding_questions directly
  -- to allow polymorphic question IDs (both coding_questions and sql_questions)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'coding_submissions_question_id_fkey'
      AND table_name = 'coding_submissions'
  ) THEN
    ALTER TABLE public.coding_submissions DROP CONSTRAINT coding_submissions_question_id_fkey;
  END IF;
END $$;

-- Ensure indexes exist for fast submission lookups by question and participant
CREATE INDEX IF NOT EXISTS idx_coding_submissions_question_id ON public.coding_submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_coding_submissions_contest_user ON public.coding_submissions(contest_id, user_id);
