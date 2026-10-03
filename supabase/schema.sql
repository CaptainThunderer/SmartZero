-- ============================================================
-- SMARTZERO 2.0 — DATABASE SCHEMA & ACCESS CONTROL (RLS)
-- ============================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  full_name text,
  email text,
  student_id text,
  college text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist if table was already created in earlier version (idempotent)
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists student_id text;
alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists account_status text not null default 'verified' check (account_status in ('pending', 'verified', 'suspended', 'disabled'));
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

-- 2. USER ROLES TABLE
create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin', 'super_admin', 'contest_admin')),
  created_at timestamptz not null default now()
);

-- 3. LEARNING SESSIONS & ATTEMPTS (SmartZero 1.0 compatibility)
create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lesson_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.learning_sessions(id) on delete cascade,
  step_index int not null,
  choice_id text,
  correct boolean,
  misconception_code text,
  created_at timestamptz not null default now()
);

-- 4. CONTEST PLATFORM TABLES

-- 4.1 Contests Table
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  slug text not null unique,
  passcode_hash text not null,
  created_by uuid references public.profiles(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes int not null default 60,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'UPCOMING', 'LIVE', 'ENDED', 'FINAL_RESULTS')),
  instructions text default '',
  negative_marking boolean not null default false,
  default_negative_mark numeric not null default 0,
  fullscreen_required boolean not null default true,
  auto_submit_on_violation boolean not null default true,
  max_violations int not null default 1,
  allow_retake boolean not null default false,
  max_attempts int not null default 1,
  anti_cheat_settings jsonb default '{"track_tab_switch": true, "track_blur": true, "track_copy": true, "track_paste": true, "track_context_menu": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist if table was already created in earlier version (idempotent)
alter table public.contests add column if not exists fullscreen_required boolean not null default true;
alter table public.contests add column if not exists auto_submit_on_violation boolean not null default true;
alter table public.contests add column if not exists max_violations int not null default 1;
alter table public.contests add column if not exists allow_retake boolean not null default false;
alter table public.contests add column if not exists max_attempts int not null default 1;
alter table public.contests add column if not exists anti_cheat_settings jsonb default '{"track_tab_switch": true, "track_blur": true, "track_copy": true, "track_paste": true, "track_context_menu": true}'::jsonb;

-- 4.2 MCQ Questions Bank
create table if not exists public.mcq_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  explanation text default '',
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4.3 MCQ Options
create table if not exists public.mcq_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.mcq_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order int not null default 0
);

-- 4.4 Coding Questions Bank
create table if not exists public.coding_questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  input_format text default '',
  output_format text default '',
  constraints text default '',
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  time_limit_ms int not null default 2000,
  memory_limit_mb int not null default 256,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4.5 Coding Test Cases (Hidden vs Sample)
create table if not exists public.coding_test_cases (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.coding_questions(id) on delete cascade,
  input text not null,
  expected_output text not null,
  is_hidden boolean not null default true,
  is_sample boolean not null default false,
  weight numeric not null default 1,
  sort_order int not null default 0
);

-- 4.6 Contest-Question Linking Table
create table if not exists public.contest_questions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  question_id uuid not null,
  question_type text not null check (question_type in ('mcq', 'coding')),
  sort_order int not null default 0,
  marks numeric not null default 1,
  negative_marks numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(contest_id, question_id)
);

-- 4.7 Contest Participants
create table if not exists public.contest_participants (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'registered' check (status in ('registered', 'ready', 'exam_started', 'in_progress', 'in_exam', 'submitted', 'auto_submitted', 'finalized')),
  score numeric not null default 0,
  attempt_number int not null default 1,
  submission_reason text default 'manual',
  violations_count int not null default 0,
  unique(contest_id, user_id)
);

-- Ensure all columns and constraints exist if table was already created in earlier version (idempotent)
alter table public.contest_participants drop constraint if exists contest_participants_status_check;
alter table public.contest_participants add constraint contest_participants_status_check check (status in ('registered', 'ready', 'exam_started', 'in_progress', 'in_exam', 'submitted', 'auto_submitted', 'finalized'));
alter table public.contest_participants add column if not exists attempt_number int not null default 1;
alter table public.contest_participants add column if not exists started_at timestamptz;
alter table public.contest_participants add column if not exists completed_at timestamptz;
alter table public.contest_participants add column if not exists submission_reason text default 'manual';
alter table public.contest_participants add column if not exists violations_count int not null default 0;
alter table public.contest_participants add column if not exists auto_submitted boolean not null default false;

-- 4.8 MCQ Answers / Submissions
create table if not exists public.mcq_answers (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.mcq_questions(id) on delete cascade,
  selected_option_id uuid references public.mcq_options(id) on delete set null,
  is_marked_for_review boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contest_id, user_id, question_id)
);

-- 5. HELPER FUNCTIONS (SECURITY DEFINER to avoid recursive RLS)
create or replace function public.has_role(lookup_user_id uuid, required_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = lookup_user_id
      and (
        role = required_role
        or (required_role = 'admin' and role in ('admin', 'super_admin', 'contest_admin'))
      )
  );
$$;

create or replace function public.is_admin(lookup_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = lookup_user_id
      and role in ('admin', 'super_admin', 'contest_admin')
  );
$$;

create or replace function public.is_super_admin(lookup_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = lookup_user_id
      and role = 'super_admin'
  );
$$;

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

-- 4.10 Contest Admin Assignments
create table if not exists public.contest_admin_assignments (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (contest_id, admin_id)
);

-- 6. AUTOMATIC PROFILE & ROLE PROVISIONING TRIGGER
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    updated_at = now();

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.contests enable row level security;
alter table public.mcq_questions enable row level security;
alter table public.mcq_options enable row level security;
alter table public.coding_questions enable row level security;
alter table public.coding_test_cases enable row level security;
alter table public.contest_questions enable row level security;
alter table public.contest_participants enable row level security;
alter table public.mcq_answers enable row level security;

-- 8. RLS POLICIES

-- Profiles policies (Strict privacy: no public enumeration)
drop policy if exists "profiles readable by authenticated" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles registration insert" on public.profiles;
drop policy if exists "profiles registration select" on public.profiles;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User roles policies (Strict role protection: no anonymous role assignment)
drop policy if exists "user_roles read own" on public.user_roles;
drop policy if exists "user_roles registration insert" on public.user_roles;
drop policy if exists "user_roles registration select" on public.user_roles;

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

-- Secure Student Registration RPC (Forces role = 'student')
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

-- Learning sessions policies
drop policy if exists "sessions own rows" on public.learning_sessions;
create policy "sessions own rows"
  on public.learning_sessions for all
  to authenticated
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id);

-- Attempts policies
drop policy if exists "attempts through own session" on public.attempts;
create policy "attempts through own session"
  on public.attempts for all
  to authenticated
  using (
    exists (
      select 1 from public.learning_sessions s
      where s.id = session_id and (s.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.learning_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Contests policies
drop policy if exists "contests select" on public.contests;
create policy "contests select"
  on public.contests for select
  to authenticated
  using (status in ('PUBLISHED', 'UPCOMING', 'LIVE', 'ENDED', 'FINAL_RESULTS') or public.is_admin(auth.uid()));

drop policy if exists "contests admin manage" on public.contests;
create policy "contests admin manage"
  on public.contests for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- MCQ Questions policies
drop policy if exists "mcq_questions admin manage" on public.mcq_questions;
create policy "mcq_questions admin manage"
  on public.mcq_questions for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "mcq_questions student read linked" on public.mcq_questions;
create policy "mcq_questions student read linked"
  on public.mcq_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.contest_questions cq
      join public.contests c on c.id = cq.contest_id
      where cq.question_id = mcq_questions.id
        and c.status in ('PUBLISHED', 'UPCOMING', 'LIVE', 'ENDED', 'FINAL_RESULTS')
    )
  );

-- MCQ Options policies
drop policy if exists "mcq_options admin manage" on public.mcq_options;
create policy "mcq_options admin manage"
  on public.mcq_options for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Coding Questions policies
drop policy if exists "coding_questions admin manage" on public.coding_questions;
create policy "coding_questions admin manage"
  on public.coding_questions for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "coding_questions student read linked" on public.coding_questions;
create policy "coding_questions student read linked"
  on public.coding_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.contest_questions cq
      join public.contests c on c.id = cq.contest_id
      where cq.question_id = coding_questions.id
        and c.status in ('PUBLISHED', 'UPCOMING', 'LIVE', 'ENDED', 'FINAL_RESULTS')
    )
  );

-- Coding Test Cases policies
drop policy if exists "coding_test_cases admin manage" on public.coding_test_cases;
create policy "coding_test_cases admin manage"
  on public.coding_test_cases for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "coding_test_cases sample read" on public.coding_test_cases;
create policy "coding_test_cases sample read"
  on public.coding_test_cases for select
  to authenticated
  using (is_sample = true and is_hidden = false);

-- Contest Questions policies
drop policy if exists "contest_questions admin manage" on public.contest_questions;
create policy "contest_questions admin manage"
  on public.contest_questions for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "contest_questions student read linked" on public.contest_questions;
create policy "contest_questions student read linked"
  on public.contest_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.contests c
      where c.id = contest_id
        and c.status in ('PUBLISHED', 'UPCOMING', 'LIVE', 'ENDED', 'FINAL_RESULTS')
    )
  );

-- Contest Participants policies
drop policy if exists "contest_participants read" on public.contest_participants;
create policy "contest_participants read"
  on public.contest_participants for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "contest_participants insert" on public.contest_participants;
create policy "contest_participants insert"
  on public.contest_participants for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "contest_participants update" on public.contest_participants;
create policy "contest_participants update"
  on public.contest_participants for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- MCQ Answers policies
drop policy if exists "mcq_answers own manage" on public.mcq_answers;
create policy "mcq_answers own manage"
  on public.mcq_answers for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid());

-- 4.9 Coding Submissions
create table if not exists public.coding_submissions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.coding_questions(id) on delete cascade,
  language text not null,
  code text not null,
  verdict text not null,
  score numeric not null default 0,
  test_cases_passed int not null default 0,
  total_test_cases int not null default 0,
  execution_time_ms numeric default 0,
  memory_kb numeric default 0,
  compile_output text default '',
  submitted_at timestamptz not null default now()
);

alter table public.coding_submissions enable row level security;

drop policy if exists "coding_submissions own read" on public.coding_submissions;
create policy "coding_submissions own read"
  on public.coding_submissions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "coding_submissions insert" on public.coding_submissions;
create policy "coding_submissions insert"
  on public.coding_submissions for insert
  to authenticated
  with check (user_id = auth.uid());

-- 4.10 Contest Security Events (Anti-Cheat)
create table if not exists public.contest_security_events (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  participant_id text not null,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.contest_security_events enable row level security;

drop policy if exists "contest_security_events admin read" on public.contest_security_events;
create policy "contest_security_events admin read"
  on public.contest_security_events for select
  to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "contest_security_events student insert" on public.contest_security_events;
create policy "contest_security_events student insert"
  on public.contest_security_events for insert
  to authenticated
  with check (true);
