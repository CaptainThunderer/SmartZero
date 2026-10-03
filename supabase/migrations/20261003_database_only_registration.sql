-- ============================================================
-- SMARTZERO 2.0 — DATABASE-ONLY USER REGISTRATION MIGRATION
-- ============================================================
-- Decouples public.profiles from auth.users so student registration
-- can persist directly into Supabase PostgreSQL without triggering
-- Supabase Auth emails or rate limits.

-- 1. Drop foreign key constraint on public.profiles to auth.users
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Ensure default ID generation if not provided
alter table public.profiles alter column id set default gen_random_uuid();

-- 3. RLS policies allowing student registration persistence
drop policy if exists "profiles registration insert" on public.profiles;
create policy "profiles registration insert"
  on public.profiles for insert
  to anon, authenticated
  with check (true);

drop policy if exists "profiles registration select" on public.profiles;
create policy "profiles registration select"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "user_roles registration insert" on public.user_roles;
create policy "user_roles registration insert"
  on public.user_roles for insert
  to anon, authenticated
  with check (true);

drop policy if exists "user_roles registration select" on public.user_roles;
create policy "user_roles registration select"
  on public.user_roles for select
  to anon, authenticated
  using (true);
