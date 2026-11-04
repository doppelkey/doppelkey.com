-- Doppelkey: signed-out practice uses yesterday's digits, plus archive reads.
--
-- Rules
--   * Signed-in players get today's puzzle (IST day), exactly as before.
--   * Signed-out visitors get yesterday's puzzle, so nobody can practise on
--     today's ranked digits before signing in. The database decides this, so
--     it cannot be bypassed from the client.
--   * New archive functions expose past puzzles only: days strictly before
--     today (IST), and only days that already exist. They never create
--     puzzles and never reveal today's digits to anonymous callers.

-- The daily puzzle for the caller: today when signed in, yesterday when
-- signed out. Same response shape as before, plus two informational fields.
create or replace function public.get_daily_puzzle()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with target as (
    select case
      when auth.uid() is null then public.ist_today() - 1
      else public.ist_today()
    end as day
  )
  select jsonb_build_object(
    'day', target.day,
    'digits', public.puzzle_digits(target.day),
    'server_now', now(),
    'ranked_day', public.ist_today(),
    'practice', auth.uid() is null
  )
  from target
$$;

-- One past puzzle for the archive. Read-only: days that were never played
-- return null instead of generating digits, and today or later is never
-- served here (today comes from get_daily_puzzle for signed-in players).
create or replace function public.get_puzzle(p_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found text;
begin
  if p_day is null or p_day >= public.ist_today() then
    return null;
  end if;
  select p.digits into found from public.daily_puzzles p where p.day = p_day;
  if found is null then
    return null;
  end if;
  return jsonb_build_object('day', p_day, 'digits', found);
end;
$$;

-- The days the archive can offer, newest first. Past days only, so the list
-- never advertises today's digits to signed-out visitors.
create or replace function public.get_archive_days(p_limit integer default 60)
returns table (day date)
language sql
security definer
set search_path = ''
as $$
  select p.day
  from public.daily_puzzles p
  where p.day < public.ist_today()
  order by p.day desc
  limit greatest(1, least(coalesce(p_limit, 60), 366))
$$;

-- Grant the archive reads to everyone (Postgres grants EXECUTE to PUBLIC on
-- new functions by default; make the intended access explicit).
grant execute on function public.get_puzzle(date) to anon, authenticated;
grant execute on function public.get_archive_days(integer) to anon, authenticated;
-- CREATE OR REPLACE preserves the existing grant on get_daily_puzzle().
