-- Adds 10 new Shelf Life trophies (collection-milestone badges, not real
-- Xbox/PlayStation trophies) on top of the original set, and updates
-- award_achievements_for() to check for them. Safe to run on an existing
-- project — existing trophies/earned rows are untouched, this only adds.
--
-- Run this once in Supabase's SQL Editor. New trophies get picked up
-- automatically the next time each person's dashboard checks trophies
-- (on load, add, import, etc.) — no backfill script needed since
-- award_achievements_for() always recomputes from live data.

insert into achievement_defs (key, name, description, tier, sort_order) values
  ('wishlist-10',           'Window Shopping',    'Add 10 items to your wishlist.',                    'bronze', 19),
  ('types-5',                'Renaissance Collector', 'Own items across 5 different item types.',       'silver', 20),
  ('cards-25',               'Card Shark',          'Own 25 trading cards.',                             'silver', 21),
  ('vinyl-10',               'Crate Digger',        'Own 10 vinyl records.',                             'silver', 22),
  ('showcase-full',          'Curator',             'Fill all 5 showcase slots.',                        'silver', 23),
  ('following-10',           'Social Butterfly',    'Follow 10 collectors.',                             'silver', 24),
  ('comments-received-10',   'Popular Shelf',       'Get 10 comments on your profile.',                  'silver', 25),
  ('platforms-10',           'Platform Hopper',     'Own games across 10 different platforms.',          'gold',   26),
  ('items-500',              'Half a Thousand',     'Own 500 items.',                                    'gold',   27),
  ('first-platinum',         'First Platinum',      'Mark your first game fully Platinum''d.',           'gold',   28)
on conflict (key) do nothing;

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
  v_wishlist int;
  v_types int;
  v_cards int;
  v_vinyl int;
  v_showcase int;
  v_comments_received int;
  v_real_platinums int;
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
  select count(*) into v_wishlist from games where user_id = p_user_id and ownership = 'wishlist';
  select count(distinct item_type) into v_types from games where user_id = p_user_id;
  select count(*) into v_cards from games where user_id = p_user_id and item_type = 'trading_card';
  select count(*) into v_vinyl from games where user_id = p_user_id and item_type = 'vinyl';
  select count(*) into v_showcase from games where user_id = p_user_id and showcase_order is not null;
  select count(*) into v_comments_received from comments where profile_id = p_user_id;
  select count(*) into v_real_platinums from games where user_id = p_user_id and trophy_platinum = true;

  with ins as (
    insert into user_achievements (user_id, key)
    select p_user_id, t.k
    from (values
      ('first-item',            v_total_items  >= 1),
      ('first-comment',         v_comments     >= 1),
      ('first-follow',          v_following    >= 1),
      ('first-follower',        v_followers    >= 1),
      ('first-rating',          v_rated        >= 1),
      ('items-10',               v_total_items  >= 10),
      ('comics-10',              v_total_comics >= 10),
      ('platforms-5',            v_platforms    >= 5),
      ('genres-5',               v_genres       >= 5),
      ('ratings-10',             v_rated        >= 10),
      ('comments-10',            v_comments     >= 10),
      ('followers-5',            v_followers    >= 5),
      ('items-100',              v_total_items  >= 100),
      ('completed-25',           v_completed    >= 25),
      ('variants-10',            v_variants     >= 10),
      ('followers-25',           v_followers    >= 25),
      ('comics-50',              v_total_comics >= 50),
      ('wishlist-10',            v_wishlist           >= 10),
      ('types-5',                v_types              >= 5),
      ('cards-25',               v_cards              >= 25),
      ('vinyl-10',               v_vinyl              >= 10),
      ('showcase-full',          v_showcase           >= 5),
      ('following-10',           v_following          >= 10),
      ('comments-received-10',   v_comments_received  >= 10),
      ('platforms-10',           v_platforms          >= 10),
      ('items-500',              v_total_items        >= 500),
      ('first-platinum',         v_real_platinums     >= 1)
    ) as t(k, cond)
    where t.cond
    on conflict do nothing
    returning user_achievements.key
  )
  select coalesce(array_agg(ins.key), '{}'::text[]) into v_new_keys from ins;

  -- Platinum: earn every other trophy, same as a PlayStation platinum.
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
