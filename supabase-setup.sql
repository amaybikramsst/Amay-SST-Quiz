-- ============================================================
-- AmaySST Quiz — One-Time Supabase Setup SQL
-- Copy EVERYTHING in this file and paste into:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================

-- 1. Create candidate_events table for "Every Tap" tracking across all devices
create table if not exists public.candidate_events (
  id uuid default gen_random_uuid() primary key,
  guest_uuid text not null,
  candidate_name text not null,
  action text not null,
  detail text default '',
  screen text default '',
  created_at timestamptz default now()
);

alter table public.candidate_events enable row level security;

drop policy if exists "Allow public insert taps" on public.candidate_events;
create policy "Allow public insert taps"
  on public.candidate_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow authenticated read taps" on public.candidate_events;
create policy "Allow authenticated read taps"
  on public.candidate_events
  for select
  to authenticated
  using (true);

-- 2. Allow Admin (signed-in authenticated user) to read/edit candidates (rename & XP update)
alter table public.candidates enable row level security;

drop policy if exists "Allow authenticated read candidates" on public.candidates;
create policy "Allow authenticated read candidates"
  on public.candidates
  for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated update candidates" on public.candidates;
create policy "Allow authenticated update candidates"
  on public.candidates
  for update
  to authenticated
  using (true)
  with check (true);

-- 3. Allow Admin to view every quiz attempt
alter table public.quiz_attempts enable row level security;

drop policy if exists "Allow authenticated read attempts" on public.quiz_attempts;
create policy "Allow authenticated read attempts"
  on public.quiz_attempts
  for select
  to authenticated
  using (true);

-- 4. Allow students to read dynamic_questions and Admin to insert/delete them (Single + Bulk Upload)
alter table public.dynamic_questions enable row level security;

drop policy if exists "Allow public read dynamic_questions" on public.dynamic_questions;
create policy "Allow public read dynamic_questions"
  on public.dynamic_questions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow authenticated insert dynamic_questions" on public.dynamic_questions;
create policy "Allow authenticated insert dynamic_questions"
  on public.dynamic_questions
  for insert
  to authenticated
  with check (true);

drop policy if exists "Allow authenticated delete dynamic_questions" on public.dynamic_questions;
create policy "Allow authenticated delete dynamic_questions"
  on public.dynamic_questions
  for delete
  to authenticated
  using (true);

-- 5. Create app_settings table so Admin can update Latest Video link & thumbnail for all students
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Allow public read app_settings" on public.app_settings;
create policy "Allow public read app_settings"
  on public.app_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow authenticated write app_settings" on public.app_settings;
create policy "Allow authenticated write app_settings"
  on public.app_settings
  for all
  to authenticated
  using (true)
  with check (true);

-- 6. Track which candidates have installed the PWA app to their home screen
alter table public.candidates add column if not exists app_installed boolean default false;
alter table public.candidates add column if not exists app_installed_at timestamptz;

create or replace function public.report_app_install(p_guest text, p_installed boolean)
returns void
language plpgsql
security definer
as $$
begin
  update public.candidates
  set
    app_installed = coalesce(app_installed, false) or coalesce(p_installed, false),
    app_installed_at = case
      when coalesce(p_installed, false) then coalesce(app_installed_at, now())
      else app_installed_at
    end,
    updated_at = now()
  where guest_uuid = p_guest;
end;
$$;

grant execute on function public.report_app_install(text, boolean) to anon, authenticated;

-- 7. Accurate 12:00 AM IST Today XP calculation from quiz_attempts (resets to 0 at midnight IST daily)
alter table public.quiz_attempts add column if not exists guest_uuid text;

create or replace function public.get_leaderboard_ist(p_guest text)
returns table (
  name text,
  xp bigint,
  today_xp bigint
)
language sql
security definer
set search_path = public
as $$
  with ist_today as (
    select (now() at time zone 'Asia/Kolkata')::date as d
  ),
  today_scores as (
    select
      c.guest_uuid,
      greatest(0, coalesce(sum(qa.xp_earned), 0))::bigint as earned_today
    from public.candidates c
    join public.quiz_attempts qa
      on (
        (qa.guest_uuid is not null and qa.guest_uuid = c.guest_uuid)
        or (qa.guest_uuid is null and qa.candidate_name = c.display_name)
      )
    cross join ist_today
    where (qa.created_at at time zone 'Asia/Kolkata')::date = ist_today.d
    group by c.guest_uuid
  )
  select
    c.display_name::text as name,
    coalesce(c.xp, 0)::bigint as xp,
    coalesce(ts.earned_today, 0)::bigint as today_xp
  from public.candidates c
  left join today_scores ts on ts.guest_uuid = c.guest_uuid
  where coalesce(c.hidden, false) = false
    and c.guest_uuid <> p_guest;
$$;

grant execute on function public.get_leaderboard_ist(text) to anon, authenticated;

create or replace function public.get_my_today_ist(p_guest text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select greatest(0, coalesce(sum(qa.xp_earned), 0))::bigint
  from public.quiz_attempts qa
  left join public.candidates c on c.guest_uuid = p_guest
  where (
    (qa.guest_uuid is not null and qa.guest_uuid = p_guest)
    or (qa.guest_uuid is null and c.display_name is not null and qa.candidate_name = c.display_name)
  )
    and (qa.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
$$;

grant execute on function public.get_my_today_ist(text) to anon, authenticated;
