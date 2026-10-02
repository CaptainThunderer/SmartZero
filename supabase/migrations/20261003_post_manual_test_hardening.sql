-- ============================================================================
-- SMARTZERO 2.0 — POST-MANUAL-TEST HARDENING MIGRATION
-- Database: Supabase PostgreSQL (Project: mrgbigbqdsunhplviipe)
-- ============================================================================

-- 1. PROFILES: Add account verification status
alter table public.profiles 
  add column if not exists account_status text not null default 'verified' 
  check (account_status in ('pending', 'verified', 'suspended', 'disabled'));

-- 2. CONTESTS: Add configurable anti-cheat & attempt settings
alter table public.contests
  add column if not exists fullscreen_required boolean not null default true,
  add column if not exists auto_submit_on_violation boolean not null default true,
  add column if not exists max_violations int not null default 1,
  add column if not exists allow_retake boolean not null default false,
  add column if not exists max_attempts int not null default 1,
  add column if not exists anti_cheat_settings jsonb default '{"track_tab_switch": true, "track_blur": true, "track_copy": true, "track_paste": true, "track_context_menu": true}'::jsonb;

-- 3. CONTEST PARTICIPANTS: Update status check and add attempt details
alter table public.contest_participants drop constraint if exists contest_participants_status_check;
alter table public.contest_participants 
  add constraint contest_participants_status_check 
  check (status in ('registered', 'ready', 'exam_started', 'in_progress', 'in_exam', 'submitted', 'auto_submitted', 'finalized'));

alter table public.contest_participants
  add column if not exists attempt_number int not null default 1,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists submission_reason text default 'manual',
  add column if not exists violations_count int not null default 0;

-- 4. CONTEST ADMIN ASSIGNMENTS TABLE
create table if not exists public.contest_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (contest_id, admin_id)
);

-- Enable RLS on contest_admin_assignments
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

-- 5. CONTEST MANAGEMENT ACCESS HELPER
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
