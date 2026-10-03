-- ============================================================================
-- SMARTZERO 2.0 — AUTHORITATIVE PRIMARY SUPER ADMIN PROMOTION MIGRATION
-- Target User: phaneendhra2508@gmail.com (UUID: c4305395-155f-403e-91cd-15ba661f4107)
-- Database: Supabase PostgreSQL (Project: mrgbigbqdsunhplviipe)
-- Purpose: Reconcile live database public.user_roles so phaneendhra2508@gmail.com
--          is authoritatively recognized by PostgreSQL RLS as 'super_admin'.
-- Safe & Idempotent: Can be run safely in Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
  target_user_id uuid;
  target_email text := 'phaneendhra2508@gmail.com';
  prev_role text;
BEGIN
  -- 1. Locate user in public.profiles
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE lower(trim(email)) = lower(trim(target_email))
  LIMIT 1;

  IF target_user_id IS NULL THEN
    -- Fallback to auth.users if not yet linked
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE lower(trim(email)) = lower(trim(target_email))
    LIMIT 1;
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user % was not found in public.profiles or auth.users.', target_email;
  END IF;

  -- 2. Inspect current role
  SELECT role INTO prev_role
  FROM public.user_roles
  WHERE user_id = target_user_id;

  -- 3. Safely upsert role as 'super_admin'
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (target_user_id, 'super_admin', now())
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin',
        created_at = now();

  RAISE NOTICE 'SUCCESS: Promoted primary administrator % (UUID: %) from % to super_admin',
    target_email, target_user_id, COALESCE(prev_role, 'none');
END $$;

-- 4. VERIFICATION QUERY (Run to verify promotion)
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.account_status,
  r.role,
  public.is_admin(p.id) AS is_admin,
  public.is_super_admin(p.id) AS is_super_admin
FROM public.profiles p
JOIN public.user_roles r ON r.user_id = p.id
WHERE lower(trim(p.email)) = 'phaneendhra2508@gmail.com';
