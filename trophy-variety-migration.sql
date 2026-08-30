-- Adds 8 new Shelf Life trophies — closes ROADMAP.md's "More Shelf Life
-- milestone variety" ("platform-completionist badges, genre/decade-
-- spanning badges, room for oddball community-suggested ones beyond
-- 'own N items'"). Decade-spanning specifically isn't buildable — games
-- has no original-release-date field to compute a decade from — but
-- everything else on that line has a real, already-tracked field behind
-- it:
--   - platform-depth-20 ("Platform Loyalist"): depth on one platform,
--     not breadth across many — platforms-5/10 already cover breadth.
--   - genres-10 ("Genre Connoisseur") / types-10 ("Jack of All Trades",
--     literally one of every collectible type — there are exactly 10):
--     the same breadth signal genres-5/types-5 already use, just a
--     higher bar, same scaling platforms-5 -> platforms-10 already did.
--   - tagged-10 ("Well Tagged"), notes-10 ("Archivist"),
--     condition-photos-5 ("Detail Oriented"), forsale-5 ("Yard Sale"),
--     sold-10 ("Downsizer"): genuinely new "oddball" signals off fields
--     that already exist (tags, notes, condition_photos, for_sale,
--     ownership = 'sold') but had no trophy tied to them yet.
--
-- New projects get all of this automatically from supabase-schema.sql —
-- this is the standalone version for a project set up before these
-- existed. Earning every other trophy is what unlocks Platinum Shelf,
-- so adding 8 new ones here genuinely raises that bar too, same as every
-- past trophy addition has.

insert into achievement_defs (key, name, description, tier, sort_order) values
  ('platform-depth-20',      'Platform Loyalist',   'Own 20 items for the same platform.',               'silver', 29),
  ('genres-10',              'Genre Connoisseur',   'Own items across 10 different genres.',             'gold',   30),
  ('types-10',               'Jack of All Trades',  'Own at least one item of every collectible type.',  'gold',   31),
  ('tagged-10',              'Well Tagged',         'Add a tag to 10 items.',                            'bronze', 32),
  ('notes-10',               'Archivist',           'Write notes on 10 items.',                          'silver', 33),
  ('condition-photos-5',     'Detail Oriented',     'Attach condition photos to 5 items.',               'silver', 34),
  ('forsale-5',              'Yard Sale',           'Mark 5 owned items for sale.',                      'bronze', 35),
  ('sold-10',                'Downsizer',           'Mark 10 items as sold.',                            'silver', 36)
on conflict (key) do nothing;

-- Full replacement — function bodies can't be patched incrementally, so
-- this is the complete award_achievements_for with the 6 new stat
-- lookups (platform_depth/tagged/noted/condition_photos/forsale/sold)
-- and 8 new condition rows folded in alongside everything it already did.
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
  v_platform_depth int;
  v_tagged int;
  v_noted int;
  v_condition_photos int;
  v_forsale int;
  v_sold int;
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
  -- Depth on a single platform, not breadth across many (platforms-5/10
  -- above already cover breadth) — the largest group of items sharing
  -- one platform value, same unnest-and-count approach as v_platforms.
  select coalesce(max(cnt), 0) into v_platform_depth
    from (
      select count(*) as cnt
      from games g, unnest(g.platforms) as platform
      where g.user_id = p_user_id
      group by platform
    ) t;
  -- array_length() returns null (not 0) for an empty array, so these
  -- three deliberately don't need a coalesce/nullif guard — "null > 0"
  -- is false, which already excludes untagged/photo-less/note-less rows.
  select count(*) into v_tagged from games where user_id = p_user_id and array_length(tags, 1) > 0;
  select count(*) into v_noted from games where user_id = p_user_id and notes is not null and notes <> '';
  select count(*) into v_condition_photos from games where user_id = p_user_id and array_length(condition_photos, 1) > 0;
  select count(*) into v_forsale from games where user_id = p_user_id and for_sale = true;
  select count(*) into v_sold from games where user_id = p_user_id and ownership = 'sold';

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
      ('first-platinum',         v_real_platinums     >= 1),
      ('platform-depth-20',      v_platform_depth     >= 20),
      ('genres-10',              v_genres             >= 10),
      ('types-10',               v_types              >= 10),
      ('tagged-10',              v_tagged             >= 10),
      ('notes-10',               v_noted              >= 10),
      ('condition-photos-5',     v_condition_photos   >= 5),
      ('forsale-5',              v_forsale            >= 5),
      ('sold-10',                v_sold               >= 10)
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
