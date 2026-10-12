-- ==============================================================================
-- SMARTZERO 2.0 — GRADING DATA CORRECTION PATCH
-- Targets:
--   1. Two Sum (Test 1)                : fb41e689-b9fa-4edb-aba7-33e8d01bc2c2
--   2. Two Sum (TEST 2)                : a3c5d14d-9a0e-45e6-a55a-dc5f2e831999
--   3. Employee Salary Analyzer (Final): 377ecb6c-e156-4d4e-aaa9-f61191d31388
--
-- Safety Guarantees:
--   - Atomic transaction execution via DO $$ block
--   - Preflight assertion guards: confirms pre-patch state matches audit
--   - Updates strictly and only the 3 verified rows by primary key UUID
--   - Postflight assertion guards: confirms new expected outputs match exact format
--   - Aborts with RAISE EXCEPTION if any invariant fails (no partial updates)
-- ==============================================================================

DO $$
DECLARE
  v_two_sum_1_val text;
  v_two_sum_2_val text;
  v_salary_val    text;
  v_updated_rows  integer := 0;
BEGIN
  -- ── 1. PREFLIGHT ASSERTIONS ──────────────────────────────────────────────────
  -- Verify Two Sum TC 1
  SELECT expected_output INTO v_two_sum_1_val
  FROM coding_test_cases
  WHERE id = 'fb41e689-b9fa-4edb-aba7-33e8d01bc2c2';

  IF v_two_sum_1_val IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: Two Sum TC fb41e689-b9fa-4edb-aba7-33e8d01bc2c2 does not exist.';
  ELSIF TRIM(v_two_sum_1_val) <> '0 3' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: Two Sum TC fb41e689 expected "0 3", found: "%"', v_two_sum_1_val;
  END IF;

  -- Verify Two Sum TC 2
  SELECT expected_output INTO v_two_sum_2_val
  FROM coding_test_cases
  WHERE id = 'a3c5d14d-9a0e-45e6-a55a-dc5f2e831999';

  IF v_two_sum_2_val IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: Two Sum TC a3c5d14d-9a0e-45e6-a55a-dc5f2e831999 does not exist.';
  ELSIF TRIM(v_two_sum_2_val) <> '0 3' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: Two Sum TC a3c5d14d expected "0 3", found: "%"', v_two_sum_2_val;
  END IF;

  -- Verify Employee Salary Analyzer TC
  SELECT expected_output INTO v_salary_val
  FROM coding_test_cases
  WHERE id = '377ecb6c-e156-4d4e-aaa9-f61191d31388';

  IF v_salary_val IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: Salary TC 377ecb6c-e156-4d4e-aaa9-f61191d31388 does not exist.';
  ELSIF v_salary_val NOT LIKE '%Employees Above Average: 2%' THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: Salary TC 377ecb6c expected to contain "Employees Above Average: 2", found: "%"', v_salary_val;
  END IF;

  RAISE NOTICE 'Preflight checks passed: All 3 target records confirmed in defective state.';

  -- ── 2. TARGETED UPDATES ─────────────────────────────────────────────────────
  -- Update Two Sum test cases to mathematical solution '1 3'
  UPDATE coding_test_cases
  SET expected_output = '1 3'
  WHERE id IN (
    'fb41e689-b9fa-4edb-aba7-33e8d01bc2c2',
    'a3c5d14d-9a0e-45e6-a55a-dc5f2e831999'
  );
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows <> 2 THEN
    RAISE EXCEPTION 'UPDATE FAILED: Expected to update 2 Two Sum rows, updated %', v_updated_rows;
  END IF;

  -- Update Employee Salary Analyzer test case to mathematical count 3 with standard format
  UPDATE coding_test_cases
  SET expected_output = 'Average Salary: 39000.0' || E'\n' || 'Employees Above Average: 3'
  WHERE id = '377ecb6c-e156-4d4e-aaa9-f61191d31388';
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows <> 1 THEN
    RAISE EXCEPTION 'UPDATE FAILED: Expected to update 1 Salary row, updated %', v_updated_rows;
  END IF;

  -- ── 3. POSTFLIGHT ASSERTIONS ─────────────────────────────────────────────────
  -- Confirm Two Sum TC 1
  SELECT expected_output INTO v_two_sum_1_val
  FROM coding_test_cases
  WHERE id = 'fb41e689-b9fa-4edb-aba7-33e8d01bc2c2';

  IF v_two_sum_1_val <> '1 3' THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: Two Sum TC fb41e689 was not updated to "1 3", found: "%"', v_two_sum_1_val;
  END IF;

  -- Confirm Two Sum TC 2
  SELECT expected_output INTO v_two_sum_2_val
  FROM coding_test_cases
  WHERE id = 'a3c5d14d-9a0e-45e6-a55a-dc5f2e831999';

  IF v_two_sum_2_val <> '1 3' THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: Two Sum TC a3c5d14d was not updated to "1 3", found: "%"', v_two_sum_2_val;
  END IF;

  -- Confirm Employee Salary Analyzer TC
  SELECT expected_output INTO v_salary_val
  FROM coding_test_cases
  WHERE id = '377ecb6c-e156-4d4e-aaa9-f61191d31388';

  IF v_salary_val <> ('Average Salary: 39000.0' || E'\n' || 'Employees Above Average: 3') THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: Salary TC 377ecb6c was not updated to standard format, found: "%"', v_salary_val;
  END IF;

  RAISE NOTICE 'SUCCESS: All 3 test cases verified and safely updated.';
END $$;
