-- ============================================================================
-- SMARTZERO 2.0 — PHASE 15 ADMIN ROLE PROMOTION
-- Target User: phaneendhra2508@gmail.com
-- Database: Supabase PostgreSQL (Project: mrgbigbqdsunhplviipe)
-- ============================================================================

-- 1. TRANSACTIONAL USER PROMOTION
DO $$
DECLARE
  target_user_id uuid;
  target_email text := 'phaneendhra2508@gmail.com';
  prev_role text;
  display_name text;
BEGIN
  -- A. Locate user in auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower(target_email);

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user % was not found in auth.users. Ensure user has registered.', target_email;
  END IF;

  -- B. Check previous role in public.user_roles if existing
  SELECT role INTO prev_role
  FROM public.user_roles
  WHERE user_id = target_user_id;

  -- C. Extract or generate display name
  SELECT raw_user_meta_data->>'full_name' INTO display_name
  FROM auth.users
  WHERE id = target_user_id;

  IF display_name IS NULL OR display_name = '' THEN
    display_name := 'Phaneendhra';
  END IF;

  -- D. Ensure corresponding public.profiles row exists
  INSERT INTO public.profiles (id, email, full_name, display_name, updated_at)
  VALUES (target_user_id, target_email, display_name, display_name, now())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        updated_at = now();

  -- E. Assign ONLY this user the 'admin' role in public.user_roles
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (target_user_id, 'admin', now())
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'admin',
        created_at = now();

  RAISE NOTICE 'SUCCESS: Promoted % (UUID: %). Previous role: %, New role: admin',
    target_email, target_user_id, COALESCE(prev_role, 'none');
END $$;

-- 2. VERIFICATION QUERY
SELECT 
  u.id AS auth_uuid,
  u.email AS auth_email,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name AS profile_name,
  r.role AS assigned_role,
  public.is_admin(u.id) AS is_admin_eval,
  public.has_role(u.id, 'admin') AS has_admin_eval,
  public.has_role(u.id, 'super_admin') AS has_super_admin_eval
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE lower(u.email) = 'phaneendhra2508@gmail.com';
