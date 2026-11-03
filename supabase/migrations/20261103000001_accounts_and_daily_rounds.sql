-- Doppelkey: accounts, daily puzzles, ranked rounds, streaks, leaderboards.
--
-- Rules
--   * The day resets at midnight IST (Asia/Kolkata) for everyone.
--   * One ranked round per player per day. The round start is recorded by the
--     server; the score is computed by the server from the submitted words.
--   * Tables are locked down with RLS. Clients only talk to the functions below.
--   * Nothing here needs a secret key in the app. The browser uses the
--     publishable key plus the player's own login session.

-- ---------------------------------------------------------------- tables

create table if not exists public.dictionary (
  word text primary key check (word ~ '^[a-z]{4,}$')
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_puzzles (
  day date primary key,
  digits text not null check (digits ~ '^[2-9]{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started'
    check (status in ('started', 'finished', 'expired', 'rejected')),
  score integer not null default 0,
  words text[] not null default '{}',
  unique (user_id, day)
);

create index if not exists rounds_day_score_idx on public.rounds (day, score desc);

alter table public.dictionary enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.rounds enable row level security;

revoke all on public.dictionary, public.profiles, public.daily_puzzles, public.rounds
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.rounds to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "read own rounds" on public.rounds;
create policy "read own rounds" on public.rounds
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpers

create or replace function public.ist_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- Public name defaults to "First L." so a full Google name is not published.
create or replace function public.default_display_name(meta jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw text := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  parts text[];
  result text;
begin
  if raw = '' then
    return 'Player';
  end if;
  parts := regexp_split_to_array(raw, '\s+');
  if array_length(parts, 1) > 1 then
    result := parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.';
  else
    result := parts[1];
  end if;
  result := left(result, 24);
  if char_length(result) < 2 then
    return 'Player';
  end if;
  return result;
end;
$$;

create or replace function public.ensure_profile(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  select u.id, public.default_display_name(u.raw_user_meta_data)
  from auth.users u
  where u.id = p_user
  on conflict (id) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_profile(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Players who signed in before this migration ran.
insert into public.profiles (id, display_name)
select u.id, public.default_display_name(u.raw_user_meta_data)
from auth.users u
on conflict (id) do nothing;

-- Digits for a day: picked randomly the first time anyone asks, then fixed.
create or replace function public.puzzle_digits(p_day date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  select p.digits into result from public.daily_puzzles p where p.day = p_day;
  if result is null then
    insert into public.daily_puzzles (day, digits)
    select p_day, string_agg(d, '' order by d)
    from (
      select d from unnest(array['2','3','4','5','6','7','8','9']) as d
      order by random() limit 4
    ) picked
    on conflict (day) do nothing;
    select p.digits into result from public.daily_puzzles p where p.day = p_day;
  end if;
  return result;
end;
$$;

create or replace function public.allowed_letters(p_digits text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(
    (array['', '', 'abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz'])[d::int + 1],
    ''
  )
  from unnest(string_to_array(p_digits, null)) as d
$$;


create or replace function public.round_json(r public.rounds)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'day', r.day,
    'digits', public.puzzle_digits(r.day),
    'status', r.status,
    'started_at', r.started_at,
    'deadline', r.started_at + interval '180 seconds',
    'server_now', now(),
    'score', r.score,
    'words', to_jsonb(r.words),
    'word_count', coalesce(array_length(r.words, 1), 0)
  )
$$;

-- ---------------------------------------------------------------- public API

-- Today's puzzle (IST day). Anyone can call it.
create or replace function public.get_daily_puzzle()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'day', public.ist_today(),
    'digits', public.puzzle_digits(public.ist_today()),
    'server_now', now()
  )
$$;

-- The caller's round for today, or null if they have not started one.
create or replace function public.get_my_round()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.rounds;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform public.ensure_profile(uid);

  -- A round abandoned past its deadline (plus grace) is closed with no score.
  update public.rounds
  set status = 'expired', score = 0, words = '{}', finished_at = now()
  where user_id = uid and status = 'started'
    and now() > started_at + interval '195 seconds';

  select * into r from public.rounds
  where user_id = uid and day = public.ist_today();
  if not found then
    return null;
  end if;
  return public.round_json(r);
end;
$$;

-- Start today's ranked round. Safe to call twice: the second call returns the
-- existing round and never restarts the clock.
create or replace function public.start_round()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := public.ist_today();
  r public.rounds;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform public.ensure_profile(uid);
  perform public.puzzle_digits(today);

  insert into public.rounds (user_id, day)
  values (uid, today)
  on conflict (user_id, day) do nothing;

  select * into r from public.rounds where user_id = uid and day = today;
  return public.round_json(r);
end;
$$;

-- Submit the words found in the caller's open round. The server checks the
-- timing, the letters and the dictionary, and computes the score itself.
create or replace function public.finish_round(p_words text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.rounds;
  elapsed numeric;
  letters text;
  cleaned text[];
  total_letters integer;
  final_score integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into r from public.rounds
  where user_id = uid and status = 'started'
  order by started_at desc limit 1
  for update;

  if not found then
    -- Nothing open: already finished (a retry) or never started.
    select * into r from public.rounds
    where user_id = uid and day = public.ist_today();
    if not found then
      raise exception 'no_round' using errcode = 'P0001';
    end if;
    return public.round_json(r);
  end if;

  elapsed := extract(epoch from (now() - r.started_at));

  if elapsed < 170 then
    raise exception 'too_early' using errcode = 'P0001';
  end if;

  if elapsed > 195 then
    update public.rounds
    set status = 'expired', score = 0, words = '{}', finished_at = now()
    where id = r.id returning * into r;
    return public.round_json(r);
  end if;

  if coalesce(array_length(p_words, 1), 0) > 2000 then
    update public.rounds
    set status = 'rejected', score = 0, words = '{}', finished_at = now()
    where id = r.id returning * into r;
    return public.round_json(r);
  end if;

  letters := public.allowed_letters(public.puzzle_digits(r.day));

  select coalesce(array_agg(w order by w), '{}')
  into cleaned
  from (
    select distinct lower(trim(x)) as w from unnest(coalesce(p_words, '{}')) as x
  ) c
  where char_length(w) >= 4
    and w ~ ('^[' || letters || ']+$')
    and exists (select 1 from public.dictionary d where d.word = c.w);

  select coalesce(sum(char_length(w)), 0), coalesce(sum(greatest(0, char_length(w) - 3)), 0)
  into total_letters, final_score
  from unnest(cleaned) as w;

  -- More than 10 letters per second on a multi-tap keypad is not a human.
  if total_letters > greatest(40, 10 * elapsed) then
    update public.rounds
    set status = 'rejected', score = 0, words = '{}', finished_at = now()
    where id = r.id returning * into r;
    return public.round_json(r);
  end if;

  update public.rounds
  set status = 'finished', score = final_score, words = cleaned, finished_at = now()
  where id = r.id returning * into r;
  return public.round_json(r);
end;
$$;

-- Streak = consecutive IST days with a ranked round started. It stays alive
-- through today if the player has not played yet, and resets after a missed day.
create or replace function public.my_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := public.ist_today();
  cur integer;
  longest integer;
  played integer;
  best integer;
  played_today boolean;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  with d as (
    select distinct day from public.rounds where user_id = uid
  ), g as (
    select day, day - (row_number() over (order by day))::integer as grp from d
  ), islands as (
    select max(day) as last_day, count(*)::integer as len from g group by grp
  )
  select
    coalesce((select len from islands where last_day >= today - 1 order by last_day desc limit 1), 0),
    coalesce((select max(len) from islands), 0)
  into cur, longest;

  select count(*), coalesce(max(score) filter (where status = 'finished'), 0),
         bool_or(day = today)
  into played, best, played_today
  from public.rounds where user_id = uid;

  return jsonb_build_object(
    'current_streak', cur,
    'longest_streak', longest,
    'days_played', played,
    'best_score', best,
    'played_today', coalesce(played_today, false),
    'display_name', (select display_name from public.profiles where id = uid)
  );
end;
$$;

-- Public leaderboard for one IST day. Exposes only the public name, score and
-- word count. The caller's own row is included even when outside the top N.
create or replace function public.get_leaderboard(p_day date default null, p_limit integer default 50)
returns table (rank bigint, display_name text, score integer, word_count integer, is_me boolean)
language sql
security definer
set search_path = ''
as $$
  with target as (
    select least(coalesce(p_day, public.ist_today()), public.ist_today()) as day
  ), ranked as (
    select
      rank() over (order by r.score desc) as rnk,
      p.display_name,
      r.score,
      coalesce(array_length(r.words, 1), 0) as word_count,
      (r.user_id = auth.uid()) as is_me
    from public.rounds r
    join public.profiles p on p.id = r.user_id
    join target t on t.day = r.day
    where r.status = 'finished'
  )
  select rnk, ranked.display_name, ranked.score, ranked.word_count, ranked.is_me
  from ranked
  where rnk <= greatest(1, least(coalesce(p_limit, 50), 100)) or is_me
  order by rnk, ranked.word_count desc, ranked.display_name
$$;

create or replace function public.set_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cleaned text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(cleaned) < 2 or char_length(cleaned) > 24
     or cleaned !~ '^[[:alnum:] ._''-]+$' then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  perform public.ensure_profile(uid);
  update public.profiles set display_name = cleaned where id = uid;
  return cleaned;
end;
$$;

-- ---------------------------------------------------------------- permissions

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_daily_puzzle() to anon, authenticated;
grant execute on function public.get_leaderboard(date, integer) to anon, authenticated;
grant execute on function public.get_my_round() to authenticated;
grant execute on function public.start_round() to authenticated;
grant execute on function public.finish_round(text[]) to authenticated;
grant execute on function public.my_stats() to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
