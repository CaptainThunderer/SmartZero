-- ============================================================================
-- SMARTZERO 2.0 — RECONCILE LEADERBOARD_VISIBILITY MIGRATION
-- Project: Supabase PostgreSQL (mrgbigbqdsunhplviipe)
-- Purpose: Add leaderboard_visibility column to public.contests with default 'PUBLIC'
--          and check constraint ('PUBLIC', 'ANONYMOUS').
--          Refreshes PostgREST schema cache via NOTIFY pgrst, 'reload schema'.
-- Idempotent: 100% safe to run multiple times without data loss.
-- ============================================================================

-- 1. Add column if not exists
ALTER TABLE public.contests
ADD COLUMN IF NOT EXISTS leaderboard_visibility TEXT
DEFAULT 'PUBLIC'
NOT NULL;

-- 2. Add check constraint idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contests_leaderboard_visibility_check'
  ) THEN
    ALTER TABLE public.contests
    ADD CONSTRAINT contests_leaderboard_visibility_check
    CHECK (leaderboard_visibility IN ('PUBLIC', 'ANONYMOUS'));
  END IF;
END $$;

-- 3. Ensure any existing rows have 'PUBLIC'
UPDATE public.contests
SET leaderboard_visibility = 'PUBLIC'
WHERE leaderboard_visibility IS NULL;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
