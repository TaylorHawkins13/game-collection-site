-- Steady — friends & shared runs.
--
-- Run once in a NEW Supabase project's SQL Editor (see running-app/README.md → "Friends").
-- Then set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for the app.
--
-- Privacy model:
--   * Nothing is public. Profiles, posts and cheers are visible only to you and accepted friends.
--   * Friends are added by an exact friend code (looked up through a function; there's no searchable directory).
--   * Posted routes are a shape normalised into a 100×60 box — no coordinates are ever stored.

create extension if not exists pgcrypto;

-- ───────────── profiles ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  friend_code text not null unique check (friend_code ~ '^[A-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

-- ───────────── friendships ─────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- One friendship per pair, whichever direction it was requested in.
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

-- ───────────── shared runs ─────────────
create table if not exists public.shared_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  activity_date date not null,
  kind text not null check (kind in ('run', 'strength')),
  headline text not null check (char_length(headline) <= 80),
  title text not null check (char_length(title) <= 120),
  duration_sec integer not null check (duration_sec between 0 and 172800),
  distance_m integer check (distance_m between 0 and 500000),
  pace_sec_per_km integer check (pace_sec_per_km between 60 and 3600),
  route_shape text check (char_length(route_shape) <= 8000),
  streak integer check (streak between 0 and 10000),
  week_done integer check (week_done between 0 and 50),
  week_total integer check (week_total between 0 and 50),
  rank_label text check (char_length(rank_label) <= 30)
);
create index if not exists shared_runs_user_created_idx on public.shared_runs (user_id, created_at desc);

-- ───────────── cheers ─────────────
create table if not exists public.cheers (
  run_id uuid not null references public.shared_runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '🔥', '💪')),
  created_at timestamptz not null default now(),
  primary key (run_id, user_id)
);

-- ───────────── helpers ─────────────
-- Are a and b accepted friends? SECURITY DEFINER so policies can call it without recursive RLS.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- Look up someone by exact friend code; returns only id + display name.
create or replace function public.find_by_friend_code(code text)
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name from public.profiles p
  where p.friend_code = upper(trim(code)) and p.id <> (select auth.uid());
$$;

revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.find_by_friend_code(text) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.find_by_friend_code(text) to authenticated;

-- ───────────── row-level security ─────────────
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_runs enable row level security;
alter table public.cheers enable row level security;

revoke all on public.profiles, public.friendships, public.shared_runs, public.cheers from anon;

-- profiles: see yourself, your friends, and anyone with a pending request involving you.
drop policy if exists profiles_select on public.profiles;
-- Note: columns are qualified with `profiles.` because friendships also has an `id` column.
create policy profiles_select on public.profiles for select to authenticated using (
  profiles.id = (select auth.uid())
  or public.are_friends(profiles.id, (select auth.uid()))
  or exists (
    select 1 from public.friendships f
    where (f.requester = profiles.id and f.addressee = (select auth.uid()))
       or (f.addressee = profiles.id and f.requester = (select auth.uid()))
  )
);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated using (id = (select auth.uid()));

-- friendships: involved parties only; you can only request as yourself, only the addressee accepts.
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated using (
  requester = (select auth.uid()) or addressee = (select auth.uid())
);
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert to authenticated with check (
  requester = (select auth.uid()) and status = 'pending'
);
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update to authenticated
  using (addressee = (select auth.uid()))
  with check (addressee = (select auth.uid()) and status = 'accepted');
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated using (
  requester = (select auth.uid()) or addressee = (select auth.uid())
);

-- shared runs: you and your friends can see them; only you post or delete yours.
drop policy if exists shared_runs_select on public.shared_runs;
create policy shared_runs_select on public.shared_runs for select to authenticated using (
  user_id = (select auth.uid()) or public.are_friends(user_id, (select auth.uid()))
);
drop policy if exists shared_runs_insert on public.shared_runs;
create policy shared_runs_insert on public.shared_runs for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists shared_runs_delete on public.shared_runs;
create policy shared_runs_delete on public.shared_runs for delete to authenticated using (user_id = (select auth.uid()));

-- cheers: visible on posts you can see; you can cheer friends' posts (not your own) and undo it.
drop policy if exists cheers_select on public.cheers;
create policy cheers_select on public.cheers for select to authenticated using (
  exists (
    select 1 from public.shared_runs r
    where r.id = cheers.run_id and (r.user_id = (select auth.uid()) or public.are_friends(r.user_id, (select auth.uid())))
  )
);
drop policy if exists cheers_insert on public.cheers;
create policy cheers_insert on public.cheers for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.shared_runs r where r.id = cheers.run_id and public.are_friends(r.user_id, (select auth.uid())))
);
drop policy if exists cheers_update on public.cheers;
create policy cheers_update on public.cheers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists cheers_delete on public.cheers;
create policy cheers_delete on public.cheers for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.profiles, public.friendships, public.shared_runs, public.cheers to authenticated;
