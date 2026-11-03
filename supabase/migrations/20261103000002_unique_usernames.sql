-- Unique usernames across all writers, including concurrent requests.
-- Existing conflicts abort rather than silently renaming a real player.
begin;
lock table public.profiles in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.profiles
    group by lower(regexp_replace(trim(display_name), '\s+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception 'Existing usernames conflict. Resolve them with the owners before applying this migration.';
  end if;
end;
$$;

create unique index profiles_username_unique
  on public.profiles (lower(regexp_replace(trim(display_name), '\s+', ' ', 'g')));

-- Keep private Google names abbreviated. New accounts with matching defaults
-- receive a short random suffix instead of blocking Google sign-in.
create or replace function public.ensure_profile(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  attempt integer := 0;
begin
  if exists (select 1 from public.profiles where id = p_user) then return; end if;
  select regexp_replace(trim(public.default_display_name(u.raw_user_meta_data)), '\s+', ' ', 'g')
    into base from auth.users u where u.id = p_user;
  if base is null then return; end if;
  if char_length(base) < 2 or base !~ '^[[:alnum:] ._''-]+$' or base !~ '[[:alnum:]]' then
    base := 'Player';
  end if;
  candidate := base;
  loop
    begin
      insert into public.profiles (id, display_name) values (p_user, candidate)
        on conflict (id) do nothing;
      return;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 20 then raise; end if;
      candidate := left(base, 17) || '-' || left(md5(random()::text || clock_timestamp()::text), 6);
    end;
  end loop;
end;
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
     or cleaned !~ '^[[:alnum:] ._''-]+$' or cleaned !~ '[[:alnum:]]' then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  perform public.ensure_profile(uid);
  begin
    update public.profiles set display_name = cleaned where id = uid;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
  end;
  return cleaned;
end;
$$;

-- CREATE OR REPLACE preserves existing execute grants. Internal helpers remain
-- unavailable to anon/authenticated, and table RLS/privileges are unchanged.
commit;
