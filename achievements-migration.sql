-- ============================================================
-- Trophies / achievements migration
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- Safe to run again later too — it's fully idempotent, and re-running
-- it will re-backfill anyone who's earned new trophies since last time.
-- ============================================================

-- ------------------------------------------------------------
-- achievement_defs: the fixed catalog of every trophy that exists
-- ------------------------------------------------------------
create table if not exists achievement_defs (
  key text primary key,
  name text not null,
  description text not null,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  sort_order int not null
);

alter table achievement_defs enable row level security;

drop policy if exists "Achievement definitions are publicly readable" on achievement_defs;
create policy "Achievement definitions are publicly readable"
  on achievement_defs for select
  using (true);

grant select on achievement_defs to anon, authenticated;

insert into achievement_defs (key, name, description, tier, sort_order) values
  ('first-item',      'First Pickup',          'Add your first item to your collection.',        'bronze',   1),
  ('first-comment',   'Say Something',         'Leave your first comment on someone''s shelf.',   'bronze',   2),
  ('first-follow',    'Making Friends',        'Follow another collector.',                       'bronze',   3),
  ('first-follower',  'Getting Noticed',       'Gain your first follower.',                       'bronze',   4),
  ('first-rating',    'Critic in Training',    'Rate your first item.',                           'bronze',   5),
  ('items-10',        'Double Digits',         'Own 10 items.',                                   'silver',   6),
  ('comics-10',       'Bookworm',              'Own 10 comics.',                                  'silver',   7),
  ('platforms-5',     'Multi-Platform',        'Own games across 5 different platforms.',         'silver',   8),
  ('genres-5',        'Genre Explorer',        'Own items across 5 different genres.',            'silver',   9),
  ('ratings-10',      'Seasoned Critic',       'Rate 10 items.',                                  'silver',  10),
  ('comments-10',     'Regular',               'Leave 10 comments.',                              'silver',  11),
  ('followers-5',     'Building a Following',  'Gain 5 followers.',                               'silver',  12),
  ('items-100',       'Centurion',             'Own 100 items.',                                  'gold',    13),
  ('completed-25',    'Completionist',         'Mark 25 items as completed.',                     'gold',    14),
  ('variants-10',     'Variant Hunter',        'Own 10 variant comic covers.',                    'gold',    15),
  ('followers-25',    'Community Favorite',    'Gain 25 followers.',                              'gold',    16),
  ('comics-50',       'Longbox Legend',        'Own 50 comics.',                                  'gold',    17),
  ('platinum-shelf',  'Platinum Shelf',        'Earn every other trophy.',                        'platinum', 18)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- user_achievements: which trophies each user has actually earned
-- ------------------------------------------------------------
create table if not exists user_achievements (
  user_id uuid not null references profiles(id) on delete cascade,
  key text not null references achievement_defs(key) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table user_achievements enable row level security;

drop policy if exists "Earned achievements are publicly readable" on user_achievements;
create policy "Earned achievements are publicly readable"
  on user_achievements for select
  using (true);

grant select on user_achievements to anon, authenticated;

-- Deliberately no insert/update/delete policy for regular users here.
-- Trophies are only ever awarded by the trusted functions below, so
-- nobody can grant themselves a trophy by calling the API directly.

-- ------------------------------------------------------------
-- award_achievements_for: the real logic. Recomputes stats from the
-- games/comments/follows tables and awards anything newly earned,
-- returning just the trophies that were newly unlocked (so callers can
-- show a "trophy earned" popup). Not exposed to the API directly — only
-- called from the two trusted wrappers below.
-- ------------------------------------------------------------
create or replace function award_achievements_for(p_user_id uuid)
returns table(key text, name text, tier text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_items int;
  v_total_comics int;
  v_completed int;
  v_rated int;
  v_platforms int;
  v_genres int;
  v_variants int;
  v_comments int;
  v_followers int;
  v_following int;
  v_earned_count int;
  v_total_defs int;
  v_new_keys text[];
begin
  if p_user_id is null then
    return;
  end if;

  select count(*) into v_total_items from games where user_id = p_user_id;
  select count(*) into v_total_comics from games where user_id = p_user_id and item_type = 'comic';
  select count(*) into v_completed from games where user_id = p_user_id and play_status = 'completed';
  select count(*) into v_rated from games where user_id = p_user_id and rating > 0;
  select count(distinct platform) into v_platforms
    from games g, unnest(g.platforms) as platform
    where g.user_id = p_user_id;
  select count(distinct genre) into v_genres
    from games where user_id = p_user_id and genre is not null and genre <> '';
  select count(*) into v_variants from games where user_id = p_user_id and is_variant = true;
  select count(*) into v_comments from comments where author_id = p_user_id;
  select count(*) into v_followers from follows where following_id = p_user_id;
  select count(*) into v_following from follows where follower_id = p_user_id;

  with ins as (
    insert into user_achievements (user_id, key)
    select p_user_id, t.k
    from (values
      ('first-item',     v_total_items  >= 1),
      ('first-comment',  v_comments     >= 1),
      ('first-follow',   v_following    >= 1),
      ('first-follower', v_followers    >= 1),
      ('first-rating',   v_rated        >= 1),
      ('items-10',       v_total_items  >= 10),
      ('comics-10',      v_total_comics >= 10),
      ('platforms-5',    v_platforms    >= 5),
      ('genres-5',       v_genres       >= 5),
      ('ratings-10',     v_rated        >= 10),
      ('comments-10',    v_comments     >= 10),
      ('followers-5',    v_followers    >= 5),
      ('items-100',      v_total_items  >= 100),
      ('completed-25',   v_completed    >= 25),
      ('variants-10',    v_variants     >= 10),
      ('followers-25',   v_followers    >= 25),
      ('comics-50',      v_total_comics >= 50)
    ) as t(k, cond)
    where t.cond
    on conflict do nothing
    returning user_achievements.key
  )
  select coalesce(array_agg(ins.key), '{}'::text[]) into v_new_keys from ins;

  -- Platinum: earn every other trophy, same as a PlayStation platinum.
  -- (The function's own RETURNS TABLE column is also called "key", so
  -- every reference to the real table column below has to be qualified
  -- with the table/alias name — otherwise Postgres can't tell which
  -- "key" you mean and throws an ambiguous-column error.)
  select count(*) into v_earned_count from user_achievements ua where ua.user_id = p_user_id and ua.key <> 'platinum-shelf';
  select count(*) into v_total_defs from achievement_defs ad where ad.key <> 'platinum-shelf';
  if v_total_defs > 0 and v_earned_count >= v_total_defs then
    with ins2 as (
      insert into user_achievements (user_id, key)
      select p_user_id, 'platinum-shelf'
      on conflict do nothing
      returning user_achievements.key
    )
    select v_new_keys || coalesce(array_agg(ins2.key), '{}'::text[]) into v_new_keys from ins2;
  end if;

  return query
  select d.key, d.name, d.tier
  from achievement_defs d
  where d.key = any(v_new_keys)
  order by d.sort_order;
end;
$$;

-- ------------------------------------------------------------
-- check_and_award_achievements: the only version exposed to the app.
-- Only ever checks/awards for whoever is calling it (never on someone
-- else's behalf), and hands back any trophies newly unlocked so the
-- app can pop up a notification.
--
-- An earlier version of this migration created this function with
-- "returns void". Postgres won't let CREATE OR REPLACE change a
-- function's return type, so we drop the old one first — otherwise
-- this whole script errors out partway through and nothing after it
-- (including the backfill below) runs.
-- ------------------------------------------------------------
drop function if exists check_and_award_achievements(uuid);

create or replace function check_and_award_achievements(p_user_id uuid)
returns table(key text, name text, tier text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `is distinct from` (not `<>`) on purpose: `<>` against a null
  -- auth.uid() (a signed-out/anon caller) evaluates to NULL rather than
  -- true, and plpgsql's `if` treats NULL as "don't enter the branch" —
  -- so the old `p_user_id <> auth.uid()` check silently let an anon
  -- caller through instead of rejecting them. `is distinct from` treats
  -- null sanely and is always true/false, never null.
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    return;
  end if;
  return query select * from award_achievements_for(p_user_id);
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, which
-- silently includes anon — revoke that first so only the explicit grant
-- below actually applies (the drop-and-recreate above would otherwise
-- reset any earlier revoke back to the default). award_achievements_for
-- and backfill_all_achievements are deliberately not granted to anyone —
-- they have no auth.uid() check of their own, so they must only ever be
-- reachable from the trusted SQL editor (the backfill below) or the
-- wrapper above (which runs as this function's owner when it calls
-- them, so it doesn't need its own grant).
revoke execute on function check_and_award_achievements(uuid) from public;
grant execute on function check_and_award_achievements(uuid) to authenticated;
revoke execute on function award_achievements_for(uuid) from public;

-- ------------------------------------------------------------
-- backfill_all_achievements: retroactively awards trophies to every
-- existing user based on their collection/comments/follows as they
-- stand right now, instead of only awarding new trophies going forward.
-- ------------------------------------------------------------
create or replace function backfill_all_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from profiles loop
    perform award_achievements_for(r.id);
  end loop;
end;
$$;

revoke execute on function backfill_all_achievements() from public;

-- Run the backfill right now. Safe to re-run this whole file any time —
-- everything here is idempotent, and this will simply top up anyone
-- who's newly crossed a threshold since the last run.
select backfill_all_achievements();
