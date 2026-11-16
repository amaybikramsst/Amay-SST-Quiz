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

-- 8. Unique Username & Password Login (username unchangeable once set; Admin can view Name, Username & Password)
alter table public.candidates add column if not exists username text;
alter table public.candidates add column if not exists password text;

create unique index if not exists candidates_username_lower_uidx
  on public.candidates (lower(username))
  where username is not null and btrim(username) <> '';

create or replace function public.register_with_credentials(
  p_guest text,
  p_name text,
  p_username text,
  p_password text,
  p_state text default 'Bihar'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_password text := coalesce(p_password, '');
  v_existing_username text;
begin
  if length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Name must be at least 2 characters.');
  end if;
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('ok', false, 'error', 'Username must be 3-20 characters (letters, numbers, underscore only).');
  end if;
  if length(v_password) < 4 then
    return jsonb_build_object('ok', false, 'error', 'Password must be at least 4 characters.');
  end if;

  if exists (
    select 1 from public.candidates
    where lower(username) = v_username
      and guest_uuid <> p_guest
  ) then
    return jsonb_build_object('ok', false, 'error', 'This username is already taken. Choose another.');
  end if;

  select username into v_existing_username from public.candidates where guest_uuid = p_guest;
  if v_existing_username is not null and btrim(v_existing_username) <> '' and lower(v_existing_username) <> v_username then
    return jsonb_build_object('ok', false, 'error', 'Username is permanent and cannot be changed.');
  end if;

  perform public.register_player(p_guest, v_name, coalesce(nullif(btrim(p_state), ''), 'Bihar'));

  update public.candidates
  set
    display_name = v_name,
    username = v_username,
    password = v_password,
    updated_at = now()
  where guest_uuid = p_guest;

  return jsonb_build_object(
    'ok', true,
    'guest_uuid', p_guest,
    'display_name', v_name,
    'username', v_username
  );
end;
$$;

grant execute on function public.register_with_credentials(text, text, text, text, text) to anon, authenticated;

create or replace function public.login_with_credentials(
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_row public.candidates%rowtype;
begin
  if v_username = '' or coalesce(p_password, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter both username and password.');
  end if;

  select * into v_row
  from public.candidates
  where lower(username) = v_username
  limit 1;

  if not found or coalesce(v_row.password, '') <> p_password then
    return jsonb_build_object('ok', false, 'error', 'Invalid username or password.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'guest_uuid', v_row.guest_uuid,
    'display_name', v_row.display_name,
    'username', v_row.username,
    'password', coalesce(v_row.password, ''),
    'xp', coalesce(v_row.xp, 0),
    'streak', coalesce(v_row.streak, 0),
    'quizzes_count', coalesce(v_row.quizzes_count, 0),
    'perfect_count', coalesce(v_row.perfect_count, 0)
  );
end;
$$;

grant execute on function public.login_with_credentials(text, text) to anon, authenticated;

create or replace function public.get_my_credentials(p_guest text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.candidates%rowtype;
begin
  select * into v_row
  from public.candidates
  where guest_uuid = p_guest
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'has_credentials', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'has_credentials', (
      coalesce(btrim(v_row.username), '') <> ''
      and coalesce(v_row.password, '') <> ''
    ),
    'username', coalesce(v_row.username, ''),
    'password', coalesce(v_row.password, ''),
    'display_name', coalesce(v_row.display_name, '')
  );
end;
$$;

grant execute on function public.get_my_credentials(text) to anon, authenticated;

drop function if exists public.set_my_credentials(text, text, text);
drop function if exists public.set_my_credentials(text, text, text, text);

create or replace function public.set_my_credentials(
  p_guest text,
  p_username text,
  p_password text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_password text := coalesce(p_password, '');
  v_name text := left(btrim(coalesce(p_display_name, '')), 40);
  v_existing_username text;
  v_saved_name text;
begin
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object('ok', false, 'error', 'Username must be 3-20 characters (letters, numbers, underscore only).');
  end if;
  if length(v_password) < 4 then
    return jsonb_build_object('ok', false, 'error', 'Password must be at least 4 characters.');
  end if;

  select username into v_existing_username from public.candidates where guest_uuid = p_guest;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Candidate record not found.');
  end if;
  if v_existing_username is not null and btrim(v_existing_username) <> '' then
    return jsonb_build_object('ok', false, 'error', 'Username is already set and cannot be changed.');
  end if;

  if exists (
    select 1 from public.candidates
    where lower(username) = v_username
      and guest_uuid <> p_guest
  ) then
    return jsonb_build_object('ok', false, 'error', 'This username is already taken. Choose another.');
  end if;

  update public.candidates
  set
    display_name = case when length(v_name) >= 2 then v_name else display_name end,
    username = v_username,
    password = v_password,
    updated_at = now()
  where guest_uuid = p_guest
  returning display_name into v_saved_name;

  return jsonb_build_object(
    'ok', true,
    'username', v_username,
    'display_name', coalesce(v_saved_name, '')
  );
end;
$$;

grant execute on function public.set_my_credentials(text, text, text, text) to anon, authenticated;

-- 9. Real-Time Messaging & Help Chat (soft-deletes hide from students while Admin retains full audit visibility)
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  sender_uuid text not null,
  sender_name text not null,
  recipient_uuid text not null,
  recipient_name text not null,
  body text not null,
  deleted_by_sender boolean not null default false,
  deleted_by_recipient boolean not null default false,
  deleted_for_everyone boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_participants_idx
  on public.chat_messages (sender_uuid, recipient_uuid, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Allow authenticated full access chat_messages" on public.chat_messages;
create policy "Allow authenticated full access chat_messages"
  on public.chat_messages
  for all
  to authenticated
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
exception
  when others then null;
end $$;

create or replace function public.get_chat_directory(p_guest text)
returns table (
  guest_uuid text,
  display_name text,
  xp bigint
)
language sql
security definer
set search_path = public
as $$
  select
    c.guest_uuid::text,
    c.display_name::text,
    coalesce(c.xp, 0)::bigint as xp
  from public.candidates c
  where coalesce(c.hidden, false) = false
    and c.guest_uuid <> p_guest
    and btrim(coalesce(c.display_name, '')) <> ''
  order by coalesce(c.xp, 0) desc, c.display_name asc;
$$;

grant execute on function public.get_chat_directory(text) to anon, authenticated;

create or replace function public.get_my_chat_messages(p_guest text)
returns table (
  id uuid,
  sender_uuid text,
  sender_name text,
  recipient_uuid text,
  recipient_name text,
  body text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    case when m.sender_uuid = '__help__' then '__help__' else m.sender_uuid end as sender_uuid,
    case when m.sender_uuid = '__help__' then 'Help' else coalesce(sc.display_name, m.sender_name) end as sender_name,
    case when m.recipient_uuid = '__help__' then '__help__' else m.recipient_uuid end as recipient_uuid,
    case when m.recipient_uuid = '__help__' then 'Help' else coalesce(rc.display_name, m.recipient_name) end as recipient_name,
    m.body,
    m.created_at
  from public.chat_messages m
  left join public.candidates sc on sc.guest_uuid = m.sender_uuid
  left join public.candidates rc on rc.guest_uuid = m.recipient_uuid
  where not m.deleted_for_everyone
    and (
      (m.sender_uuid = p_guest and not m.deleted_by_sender)
      or (m.recipient_uuid = p_guest and not m.deleted_by_recipient)
    )
  order by m.created_at asc
  limit 600;
$$;

grant execute on function public.get_my_chat_messages(text) to anon, authenticated;

create or replace function public.send_chat_message(
  p_sender_uuid text,
  p_recipient_uuid text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_sender_name text;
  v_recipient_name text;
  v_inserted public.chat_messages%rowtype;
begin
  if v_body = '' or length(v_body) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'Message must be 1-1000 characters.');
  end if;
  if p_sender_uuid = p_recipient_uuid then
    return jsonb_build_object('ok', false, 'error', 'Cannot send a message to yourself.');
  end if;

  select display_name into v_sender_name from public.candidates where guest_uuid = p_sender_uuid;
  if v_sender_name is null then
    return jsonb_build_object('ok', false, 'error', 'Candidate account not found.');
  end if;

  if p_recipient_uuid = '__help__' then
    v_recipient_name := 'Help';
  elsif p_recipient_uuid like 'bot_%' then
    v_recipient_name := coalesce(nullif(btrim(substring(p_recipient_uuid from 5)), ''), 'Candidate');
  else
    select display_name into v_recipient_name
    from public.candidates
    where guest_uuid = p_recipient_uuid and coalesce(hidden, false) = false;
    if v_recipient_name is null then
      return jsonb_build_object('ok', false, 'error', 'Recipient not found.');
    end if;
  end if;

  insert into public.chat_messages (
    sender_uuid, sender_name, recipient_uuid, recipient_name, body
  )
  values (
    p_sender_uuid, v_sender_name, p_recipient_uuid, v_recipient_name, v_body
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'ok', true,
    'message', jsonb_build_object(
      'id', v_inserted.id,
      'sender_uuid', v_inserted.sender_uuid,
      'sender_name', v_inserted.sender_name,
      'recipient_uuid', v_inserted.recipient_uuid,
      'recipient_name', v_inserted.recipient_name,
      'body', v_inserted.body,
      'created_at', v_inserted.created_at
    )
  );
end;
$$;

grant execute on function public.send_chat_message(text, text, text) to anon, authenticated;

create or replace function public.delete_chat_message(
  p_guest text,
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_messages
  set
    deleted_by_sender = case when sender_uuid = p_guest then true else deleted_by_sender end,
    deleted_by_recipient = case when recipient_uuid = p_guest then true else deleted_by_recipient end,
    deleted_for_everyone = case when sender_uuid = p_guest then true else deleted_for_everyone end,
    deleted_at = coalesce(deleted_at, now())
  where id = p_message_id
    and (sender_uuid = p_guest or recipient_uuid = p_guest);
  return found;
end;
$$;

grant execute on function public.delete_chat_message(text, uuid) to anon, authenticated;

create or replace function public.delete_chat_thread(
  p_guest text,
  p_other_uuid text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.chat_messages
  set
    deleted_by_sender = case when sender_uuid = p_guest then true else deleted_by_sender end,
    deleted_by_recipient = case when recipient_uuid = p_guest then true else deleted_by_recipient end,
    deleted_at = coalesce(deleted_at, now())
  where (sender_uuid = p_guest and recipient_uuid = p_other_uuid)
     or (recipient_uuid = p_guest and sender_uuid = p_other_uuid);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.delete_chat_thread(text, text) to anon, authenticated;
