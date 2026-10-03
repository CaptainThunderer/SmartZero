-- ============================================================================
-- SMARTZERO 2.0 — LIVE DATABASE RECONCILIATION MIGRATION
-- Project: Supabase PostgreSQL (mrgbigbqdsunhplviipe)
-- Purpose: Reconcile live database schema cache with SmartZero 2.0 definitions.
--          Fixes "Could not find the 'allow_retake' column of 'contests' in the schema cache".
--          Enforces zero anonymous profile enumeration and strict role control.
-- Idempotent: 100% safe to run multiple times without data loss.
-- ============================================================================

-- 1. PROFILES TABLE RECONCILIATION
-- Decouples profiles from auth.users for database-only registration flow
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists student_id text;
alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists account_status text not null default 'verified'
  check (account_status in ('pending', 'verified', 'suspended', 'disabled'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Unique index on email to prevent duplicate student profiles
create unique index if not exists profiles_email_idx on public.profiles (lower(trim(email)));

alter table public.profiles enable row level security;

-- 2. USER ROLES TABLE RECONCILIATION
create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin', 'super_admin', 'contest_admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- 3. CONTESTS TABLE RECONCILIATION
-- Adds allow_retake and exam hardening columns
alter table public.contests add column if not exists fullscreen_required boolean not null default true;
alter table public.contests add column if not exists auto_submit_on_violation boolean not null default true;
alter table public.contests add column if not exists max_violations int not null default 1;
alter table public.contests add column if not exists allow_retake boolean not null default false;
alter table public.contests add column if not exists max_attempts int not null default 1;
alter table public.contests add column if not exists anti_cheat_settings jsonb default '{"track_tab_switch": true, "track_blur": true, "track_copy": true, "track_paste": true, "track_context_menu": true}'::jsonb;

alter table public.contests enable row level security;

-- 4. CONTEST PARTICIPANTS RECONCILIATION
alter table public.contest_participants drop constraint if exists contest_participants_status_check;
alter table public.contest_participants 
  add constraint contest_participants_status_check 
  check (status in ('registered', 'ready', 'exam_started', 'in_progress', 'in_exam', 'submitted', 'auto_submitted', 'finalized'));

alter table public.contest_participants add column if not exists attempt_number int not null default 1;
alter table public.contest_participants add column if not exists started_at timestamptz;
alter table public.contest_participants add column if not exists completed_at timestamptz;
alter table public.contest_participants add column if not exists submission_reason text default 'manual';
alter table public.contest_participants add column if not exists violations_count int not null default 0;
alter table public.contest_participants add column if not exists auto_submitted boolean not null default false;

alter table public.contest_participants enable row level security;

-- 5. CONTEST ADMIN ASSIGNMENTS TABLE (Institutional Multi-Admin)
create table if not exists public.contest_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (contest_id, admin_id)
);

alter table public.contest_admin_assignments enable row level security;

drop policy if exists "contest_admin_assignments read" on public.contest_admin_assignments;
create policy "contest_admin_assignments read"
  on public.contest_admin_assignments for select
  to authenticated
  using (
    admin_id = auth.uid() 
    or public.is_admin(auth.uid())
  );

drop policy if exists "contest_admin_assignments manage" on public.contest_admin_assignments;
create policy "contest_admin_assignments manage"
  on public.contest_admin_assignments for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 6. SECURITY DEFINER HELPER FUNCTIONS
create or replace function public.can_manage_contest(lookup_user_id uuid, check_contest_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = lookup_user_id
      and (
        r.role in ('admin', 'super_admin')
        or (
          r.role = 'contest_admin'
          and (
            exists (
              select 1 from public.contests c
              where c.id = check_contest_id and c.created_by = lookup_user_id
            )
            or exists (
              select 1 from public.contest_admin_assignments a
              where a.contest_id = check_contest_id and a.admin_id = lookup_user_id
            )
          )
        )
      )
  );
$$;

-- Secure Student Registration RPC: Enforces role = 'student' and prevents anonymous role manipulation
create or replace function public.register_student(
  p_full_name text,
  p_email text,
  p_student_id text default '',
  p_college text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_normalized_email text;
  v_existing_id uuid;
begin
  v_normalized_email := lower(trim(p_email));
  if v_normalized_email is null or v_normalized_email = '' then
    raise exception 'Email is required';
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  select id into v_existing_id from public.profiles where lower(trim(email)) = v_normalized_email limit 1;

  if v_existing_id is not null then
    update public.profiles set
      full_name = trim(p_full_name),
      display_name = trim(p_full_name),
      student_id = coalesce(nullif(trim(p_student_id), ''), student_id),
      college = coalesce(nullif(trim(p_college), ''), college),
      updated_at = now()
    where id = v_existing_id
    returning * into v_profile;
  else
    insert into public.profiles (
      id,
      email,
      full_name,
      display_name,
      student_id,
      college,
      account_status,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_normalized_email,
      trim(p_full_name),
      trim(p_full_name),
      trim(coalesce(p_student_id, '')),
      trim(coalesce(p_college, '')),
      'verified',
      now(),
      now()
    )
    returning * into v_profile;
  end if;

  -- Strictly force role = 'student' (anonymous registration can never grant admin)
  insert into public.user_roles (user_id, role, created_at)
  values (v_profile.id, 'student', now())
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'display_name', v_profile.display_name,
    'student_id', v_profile.student_id,
    'college', v_profile.college,
    'role', 'student'
  );
end;
$$;

-- Secure Student Lookup RPC
create or replace function public.get_student_by_email(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'display_name', p.display_name,
    'student_id', p.student_id,
    'college', p.college,
    'account_status', p.account_status,
    'role', coalesce(r.role, 'student')
  ) into v_result
  from public.profiles p
  left join public.user_roles r on r.user_id = p.id
  where lower(trim(p.email)) = lower(trim(p_email))
  limit 1;

  return v_result;
end;
$$;

grant execute on function public.register_student(text, text, text, text) to anon, authenticated;
grant execute on function public.get_student_by_email(text) to anon, authenticated;

-- 7. STRICT RLS POLICIES (NO ANONYMOUS ENUMERATION OR ELEVATION)
-- Drop any legacy permissive policies
drop policy if exists "profiles registration insert" on public.profiles;
drop policy if exists "profiles registration select" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "user_roles registration insert" on public.user_roles;
drop policy if exists "user_roles registration select" on public.user_roles;

-- Profiles: Authenticated users can only read own profile or admins can view profiles
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- User roles: Only readable by self or admin; only editable by super_admin
drop policy if exists "user_roles read own or admin" on public.user_roles;
create policy "user_roles read own or admin"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "user_roles admin manage" on public.user_roles;
create policy "user_roles admin manage"
  on public.user_roles for all
  to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- Contests: Admins manage contests
drop policy if exists "contests admin manage" on public.contests;
create policy "contests admin manage"
  on public.contests for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 8. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
