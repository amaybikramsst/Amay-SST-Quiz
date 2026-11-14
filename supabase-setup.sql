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
