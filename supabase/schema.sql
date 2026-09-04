-- SmartZero V1 persistence foundation. V2 learning/notes tables are intentionally omitted.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
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
alter table public.profiles enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.attempts enable row level security;
create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "sessions own rows" on public.learning_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts through own session" on public.attempts for all using (exists(select 1 from public.learning_sessions s where s.id=session_id and s.user_id=auth.uid())) with check (exists(select 1 from public.learning_sessions s where s.id=session_id and s.user_id=auth.uid()));
