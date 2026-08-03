-- ============================================================
-- Trophies / achievements migration
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- Safe to run on an existing project — only adds new tables.
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
-- Trophies are only ever awarded by the trusted function below, so
-- nobody can grant themselves a trophy by calling the API directly.

-- ------------------------------------------------------------
-- check_and_award_achievements: the only way trophies get inserted.
-- Recomputes real stats from the games/comments/follows tables and
-- awards anything newly earned. Call it (as yourself) after actions
-- like adding an item, posting a comment, or following someone.
-- ------------------------------------------------------------
create or replace function check_and_award_achievements(p_user_id uuid)
returns void
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
begin
  -- Only ever award trophies for the calling user, never on someone else's behalf.
  if p_user_id is null or p_user_id <> auth.uid() then
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

  insert into user_achievements (user_id, key) select p_user_id, 'first-item'     where v_total_items >= 1   on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'first-comment'  where v_comments >= 1      on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'first-follow'   where v_following >= 1     on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'first-follower' where v_followers >= 1     on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'first-rating'   where v_rated >= 1         on conflict do nothing;

  insert into user_achievements (user_id, key) select p_user_id, 'items-10'      where v_total_items >= 10   on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'comics-10'     where v_total_comics >= 10  on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'platforms-5'   where v_platforms >= 5      on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'genres-5'      where v_genres >= 5         on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'ratings-10'    where v_rated >= 10         on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'comments-10'   where v_comments >= 10      on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'followers-5'   where v_followers >= 5      on conflict do nothing;

  insert into user_achievements (user_id, key) select p_user_id, 'items-100'     where v_total_items >= 100  on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'completed-25'  where v_completed >= 25     on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'variants-10'   where v_variants >= 10      on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'followers-25'  where v_followers >= 25     on conflict do nothing;
  insert into user_achievements (user_id, key) select p_user_id, 'comics-50'     where v_total_comics >= 50  on conflict do nothing;

  -- Platinum: earn every other trophy, same as a PlayStation platinum.
  select count(*) into v_earned_count from user_achievements where user_id = p_user_id and key <> 'platinum-shelf';
  select count(*) into v_total_defs from achievement_defs where key <> 'platinum-shelf';
  if v_total_defs > 0 and v_earned_count >= v_total_defs then
    insert into user_achievements (user_id, key) select p_user_id, 'platinum-shelf' on conflict do nothing;
  end if;
end;
$$;

grant execute on function check_and_award_achievements(uuid) to authenticated;
