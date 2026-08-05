-- ============================================================
-- Game Collection Tracker — Supabase schema
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles: one row per user, public-facing identity
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  is_public boolean not null default true,
  currency text not null default 'USD',
  -- verified SteamID64 from "Log in with Steam" — null if not connected
  steam_id text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are publicly readable"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when someone signs up.
-- Expects username to be passed in signUp() options.data.username
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'username', 'Player')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- games: each row is one collection entry owned by a user
-- ------------------------------------------------------------
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_type text not null default 'game' check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd', 'console', 'funko_pop')),
  title text not null,
  platforms text[] not null default '{}',
  genre text default '',
  cover text default '',
  ownership text not null default 'owned' check (ownership in ('owned','wishlist','sold')),
  condition text default '',
  price numeric,
  purchase_date date,
  play_status text not null default 'backlog' check (play_status in ('backlog','playing','completed','abandoned')),
  -- half-star steps: 0, 0.5, 1, 1.5, ... 5
  rating numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5 and mod(rating * 10, 5) = 0),
  tags text[] not null default '{}',
  barcode text default '',
  notes text default '',
  -- comic-specific fields (ignored/blank for item_type = 'game').
  -- Several of these are reused by newer types too: publisher doubles as
  -- a vinyl "label" or media "publisher/studio", writer doubles as a
  -- media "author/director", artist doubles as a vinyl "artist", grade
  -- doubles as a trading-card grade, and is_variant/variant_notes double
  -- as a trading-card "special version" flag.
  series text default '',
  issue_number text default '',
  publisher text default '',
  writer text default '',
  artist text default '',
  grade text default '',
  is_variant boolean not null default false,
  variant_notes text default '',
  -- shared fields for vinyl/media
  format text default '',
  edition text default '',
  -- trading-card-specific fields
  card_set text default '',
  card_number text default '',
  player_name text default '',
  -- game-specific: PAL / NTSC-U / NTSC-J / etc
  region text default '',
  -- game-specific: loose / cib / box
  completeness text default '',
  -- applies to any item type: 'physical' or 'digital'
  copy_type text default '',
  -- last "Check eBay price" result: average of current active listings on
  -- whichever eBay site matches the buyer's currency (see
  -- lib/ebayMarketplace.js) — market_price_currency records which one, so
  -- the stored number can still be displayed correctly later.
  market_price numeric,
  market_price_checked_at timestamptz,
  market_price_currency text,
  -- applies to any item type: fully completed (all extras/achievements
  -- done, full series/set collected, etc.) beyond play_status/condition
  fully_completed boolean not null default false,
  -- null = not on the public profile showcase; 1..5 = display position
  showcase_order integer,
  -- set when this row was imported from Steam, so re-importing skips it
  steam_appid integer,
  -- real Xbox/PlayStation trophy or achievement completion for this game —
  -- separate from Shelf Life's own collection-milestone trophies
  trophy_platinum boolean not null default false,
  trophy_completion numeric,
  -- who currently has this item on loan (any owned item, any type) and
  -- since when — null loaned_to means it's not out on loan right now
  loaned_to text,
  loaned_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_user_id_idx on games (user_id);
create index if not exists games_title_idx on games (lower(title));
create index if not exists games_item_type_idx on games (item_type);

alter table games enable row level security;

-- Readable by anyone if the owner's profile is public, or by the owner themself
create policy "Games readable if profile is public or owner"
  on games for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = games.user_id and p.is_public = true)
  );

create policy "Owners can insert their own games"
  on games for insert
  with check (user_id = auth.uid());

create policy "Owners can update their own games"
  on games for update
  using (user_id = auth.uid());

create policy "Owners can delete their own games"
  on games for delete
  using (user_id = auth.uid());

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists games_set_updated_at on games;
create trigger games_set_updated_at
  before update on games
  for each row execute function set_updated_at();

-- Lets a signed-in visitor refresh eBay prices on someone ELSE's public
-- collection, not just their own — "Owners can update their own games"
-- above only allows the row's own user_id to update it, which is right
-- for everything except this one case (checking a current market price
-- doesn't touch anything the owner actually curated). SECURITY DEFINER
-- bypasses that RLS policy, so the authorization check has to happen
-- inside the function itself: allowed if the caller owns the item, or if
-- the item's owner has a public profile. Only ever touches the three
-- market-price columns — title, price, ownership, etc. stay untouchable
-- by anyone but the real owner.
create or replace function refresh_item_market_price(
  p_game_id uuid,
  p_market_price numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_is_public boolean;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select g.user_id, p.is_public into v_owner_id, v_is_public
  from games g
  join profiles p on p.id = g.user_id
  where g.id = p_game_id;

  if v_owner_id is null then
    raise exception 'item not found';
  end if;

  if auth.uid() <> v_owner_id and not coalesce(v_is_public, false) then
    raise exception 'not allowed';
  end if;

  update games
  set market_price = p_market_price,
      market_price_checked_at = now(),
      market_price_currency = p_currency
  where id = p_game_id;
end;
$$;

grant execute on function refresh_item_market_price(uuid, numeric, text) to authenticated;

-- ------------------------------------------------------------
-- follows: social graph
-- ------------------------------------------------------------
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table follows enable row level security;

create policy "Follows are publicly readable"
  on follows for select
  using (true);

create policy "Users can follow as themselves"
  on follows for insert
  with check (follower_id = auth.uid());

create policy "Users can unfollow as themselves"
  on follows for delete
  using (follower_id = auth.uid());

-- ------------------------------------------------------------
-- comments: lightweight "wall" comments on a profile
-- ------------------------------------------------------------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_profile_id_idx on comments (profile_id);

alter table comments enable row level security;

create policy "Comments readable if profile is public or owner/author"
  on comments for select
  using (
    author_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = comments.profile_id
      and (p.is_public = true or p.id = auth.uid())
    )
  );

create policy "Logged-in users can post comments as themselves"
  on comments for insert
  with check (author_id = auth.uid());

create policy "Authors or profile owners can delete comments"
  on comments for delete
  using (author_id = auth.uid() or profile_id = auth.uid());

-- ------------------------------------------------------------
-- achievement_defs / user_achievements: Shelf Life's own PlayStation
-- Trophies-style badges for collection milestones (first item, 10/100
-- items, follower counts, etc.) — separate from the trophy_platinum/
-- trophy_completion fields on games, which track someone's *real*
-- Xbox/PlayStation trophies and are entered by hand.
-- ------------------------------------------------------------
create table if not exists achievement_defs (
  key text primary key,
  name text not null,
  description text not null,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  sort_order int not null
);

alter table achievement_defs enable row level security;

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
  ('platinum-shelf',  'Platinum Shelf',        'Earn every other trophy.',                        'platinum', 18),
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

create table if not exists user_achievements (
  user_id uuid not null references profiles(id) on delete cascade,
  key text not null references achievement_defs(key) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table user_achievements enable row level security;

create policy "Earned achievements are publicly readable"
  on user_achievements for select
  using (true);

grant select on user_achievements to anon, authenticated;

-- Deliberately no insert/update/delete policy for regular users here.
-- Trophies are only ever awarded by the trusted functions below, so
-- nobody can grant themselves a trophy by calling the API directly.

-- The real logic: recomputes stats from games/comments/follows and
-- awards anything newly earned, returning just the newly-unlocked
-- trophies (so callers can show a "trophy earned" popup). Not exposed
-- to the API directly — only called from the trusted wrapper below.
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

-- The only version exposed to the app — only ever checks/awards for
-- whoever is calling it, and hands back any trophies newly unlocked.
create or replace function check_and_award_achievements(p_user_id uuid)
returns table(key text, name text, tier text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    return;
  end if;
  return query select * from award_achievements_for(p_user_id);
end;
$$;

grant execute on function check_and_award_achievements(uuid) to authenticated;
-- award_achievements_for is deliberately NOT granted to anon/authenticated —
-- it has no auth.uid() check, so it must only ever be reachable from the
-- trusted SQL editor or the wrapper above.

-- ------------------------------------------------------------
-- value_snapshots: periodic "collection value over time" data points,
-- recorded automatically after "Refresh all prices" (or manually via
-- "Record snapshot"). Owner-only — never shown on public profiles.
-- ------------------------------------------------------------
create table if not exists value_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  total_value numeric not null,
  item_count int not null,
  taken_at timestamptz not null default now()
);

create index if not exists value_snapshots_user_id_idx on value_snapshots (user_id, taken_at);

alter table value_snapshots enable row level security;

create policy "Owners can read their own value snapshots"
  on value_snapshots for select
  using (user_id = auth.uid());

create policy "Owners can insert their own value snapshots"
  on value_snapshots for insert
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- custom_lists / custom_list_items: curated sub-lists within a
-- collection (e.g. "Favorites," "For sale," "Currently replaying")
-- beyond the 5-item showcase. Same visibility rule as everything else —
-- readable by the owner, or by anyone if the owning profile is public.
-- ------------------------------------------------------------
create table if not exists custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists custom_lists_user_id_idx on custom_lists (user_id, sort_order);

alter table custom_lists enable row level security;

create policy "Lists readable if owner or profile is public"
  on custom_lists for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = custom_lists.user_id and p.is_public = true)
  );

create policy "Owners can create their own lists"
  on custom_lists for insert
  with check (user_id = auth.uid());

create policy "Owners can update their own lists"
  on custom_lists for update
  using (user_id = auth.uid());

create policy "Owners can delete their own lists"
  on custom_lists for delete
  using (user_id = auth.uid());

create table if not exists custom_list_items (
  list_id uuid not null references custom_lists(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  sort_order int not null default 0,
  added_at timestamptz not null default now(),
  primary key (list_id, game_id)
);

create index if not exists custom_list_items_list_id_idx on custom_list_items (list_id, sort_order);

alter table custom_list_items enable row level security;

create policy "List items readable if list is readable"
  on custom_list_items for select
  using (
    exists (
      select 1 from custom_lists l
      where l.id = custom_list_items.list_id
      and (
        l.user_id = auth.uid()
        or exists (select 1 from profiles p where p.id = l.user_id and p.is_public = true)
      )
    )
  );

create policy "Owners can add items to their own lists"
  on custom_list_items for insert
  with check (
    exists (select 1 from custom_lists l where l.id = custom_list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners can reorder items in their own lists"
  on custom_list_items for update
  using (
    exists (select 1 from custom_lists l where l.id = custom_list_items.list_id and l.user_id = auth.uid())
  );

create policy "Owners can remove items from their own lists"
  on custom_list_items for delete
  using (
    exists (select 1 from custom_lists l where l.id = custom_list_items.list_id and l.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- activity_events: a log of when someone adds, completes, or rates an
-- item, shown to the people who follow them on /feed. Same visibility
-- rule as games/comments — public profile, or the actor themself.
-- ------------------------------------------------------------
create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  event_type text not null check (event_type in ('added', 'completed', 'rated', 'trophy')),
  -- set only for event_type = 'trophy' — which Shelf Life milestone badge
  -- was earned
  trophy_key text references achievement_defs(key) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_id_idx on activity_events (user_id, created_at desc);
create index if not exists activity_events_created_at_idx on activity_events (created_at desc);

alter table activity_events enable row level security;

create policy "Activity readable if profile is public or owner"
  on activity_events for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = activity_events.user_id and p.is_public = true)
  );

create policy "Owners can insert their own activity"
  on activity_events for insert
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- notifications: a bell/inbox for follows, comments, and trophies, so
-- those moments don't only exist as an in-the-moment toast. actor_id is
-- who triggered it (null for trophy notifications, since those are about
-- you and nobody else). Recipients only ever see their own inbox; only
-- the actor (or, for trophies, the recipient themself) can create a row.
-- ------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('follow', 'comment', 'trophy')),
  comment_id uuid references comments(id) on delete cascade,
  trophy_key text references achievement_defs(key) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "Recipients can read their own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Actors can notify others, or notify themselves about trophies"
  on notifications for insert
  with check (
    actor_id = auth.uid()
    or (type = 'trophy' and actor_id is null and user_id = auth.uid())
  );

create policy "Recipients can mark their own notifications read"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Recipients can delete their own notifications"
  on notifications for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- recommend_games: "Recommended for you" on the dashboard. Finds other
-- public collectors who rated the same things highly as you, then
-- surfaces titles they rated highly that you don't already own.
--
-- Deliberately NOT security definer — it should only ever see what the
-- calling user is already allowed to see under RLS (their own ratings,
-- plus anyone else's if that profile is public).
-- ------------------------------------------------------------
create or replace function recommend_games(p_user_id uuid, p_limit int default 8)
returns table (
  title text,
  item_type text,
  cover text,
  avg_rating numeric,
  recommender_count bigint
)
language sql
stable
as $$
  with my_liked as (
    select distinct lower(title) as title_key
    from games
    where user_id = p_user_id and rating >= 4
  ),
  my_owned as (
    select distinct lower(title) as title_key
    from games
    where user_id = p_user_id
  ),
  similar_users as (
    select distinct g.user_id
    from games g
    where g.user_id <> p_user_id
      and g.rating >= 4
      and lower(g.title) in (select title_key from my_liked)
  )
  select
    (array_agg(g.title order by g.created_at))[1] as title,
    (array_agg(g.item_type order by g.created_at))[1] as item_type,
    (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1] as cover,
    round(avg(g.rating), 1) as avg_rating,
    count(distinct g.user_id) as recommender_count
  from games g
  where g.user_id in (select user_id from similar_users)
    and g.rating >= 4
    and lower(g.title) not in (select title_key from my_owned)
  group by lower(g.title)
  order by recommender_count desc, avg_rating desc
  limit greatest(p_limit, 0);
$$;

grant execute on function recommend_games(uuid, int) to authenticated;

-- ------------------------------------------------------------
-- Leaderboard views (only consider public profiles)
-- ------------------------------------------------------------
create or replace view leaderboard_most_owned as
select
  lower(g.title) as title_key,
  (array_agg(g.title order by g.created_at))[1] as title,
  count(*) as owner_count,
  (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1] as cover
from games g
join profiles p on p.id = g.user_id
where g.ownership = 'owned' and p.is_public = true
group by lower(g.title)
order by owner_count desc
limit 50;

create or replace view leaderboard_biggest_collections as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(g.id) as game_count
from profiles p
join games g on g.user_id = p.id
where p.is_public = true
group by p.id, p.username, p.display_name, p.avatar_url
order by game_count desc
limit 50;

create or replace view leaderboard_trending as
select
  lower(g.title) as title_key,
  (array_agg(g.title order by g.created_at desc))[1] as title,
  count(*) as recent_adds,
  (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1] as cover
from games g
join profiles p on p.id = g.user_id
where p.is_public = true and g.created_at > now() - interval '14 days'
group by lower(g.title)
order by recent_adds desc
limit 50;

-- Ranks public collectors by Shelf Life trophies earned (bronze through
-- platinum, from achievements-migration.sql), not by collection size.
create or replace view leaderboard_trophies as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(ua.key) as trophy_count,
  count(ua.key) filter (where ad.tier = 'platinum') as platinum_count
from profiles p
join user_achievements ua on ua.user_id = p.id
join achievement_defs ad on ad.key = ua.key
where p.is_public = true
group by p.id, p.username, p.display_name, p.avatar_url
order by trophy_count desc, platinum_count desc
limit 50;

-- Ranks public collectors by estimated collection value: same "market
-- price if we have one, else the entered purchase price" rule used by
-- lib/valueSnapshot.js's estimateCollectionValue(), owned + non-digital
-- items only. Values are NOT currency-converted — each collector's total
-- is in their own profile currency (carried along as `currency` so the
-- UI can format it correctly), so this ranks raw numbers across
-- currencies, same display-only-currency limitation as the rest of the
-- site today.
create or replace view leaderboard_most_valuable as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.currency,
  round(sum(coalesce(g.market_price, g.price))::numeric, 2) as total_value,
  count(g.id) filter (where coalesce(g.market_price, g.price) is not null) as priced_count
from profiles p
join games g on g.user_id = p.id
where p.is_public = true
  and g.ownership = 'owned'
  and g.copy_type is distinct from 'digital'
group by p.id, p.username, p.display_name, p.avatar_url, p.currency
having sum(coalesce(g.market_price, g.price)) is not null
order by total_value desc
limit 50;

-- A smaller, more personal "who's ahead" than the site-wide rankings —
-- ranks by trophy count, but only among people the *querying user*
-- follows. Unlike the other leaderboard views, this one isn't the same
-- for everyone: it's scoped inline via `auth.uid()`, which Postgres
-- re-evaluates per query using the requester's session, not baked in
-- at view-creation time. A signed-out visitor (auth.uid() is null)
-- just gets an empty result — no separate code path needed for that.
-- left join (not join) on purpose: someone you follow with zero
-- trophies should still show up at 0, not disappear — this is your
-- actual follow list, not a sparse global ranking.
create or replace view leaderboard_friends as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(ua.key) as trophy_count,
  count(ua.key) filter (where ad.tier = 'platinum') as platinum_count
from profiles p
join follows f on f.following_id = p.id and f.follower_id = auth.uid()
left join user_achievements ua on ua.user_id = p.id
left join achievement_defs ad on ad.key = ua.key
where p.is_public = true
group by p.id, p.username, p.display_name, p.avatar_url
order by trophy_count desc, platinum_count desc
limit 50;

-- Friends-scoped versions of the other 4 rankings, same auth.uid()-scoping
-- trick as leaderboard_friends above. Unlike leaderboard_friends (trophies),
-- these use a left join to games so a followed collector with nothing
-- added yet still shows at 0 for "biggest" — but most_valuable stays an
-- inner join + having-not-null (like its global counterpart), since a $0
-- "value" for someone with no priced items isn't a meaningful ranking.
create or replace view leaderboard_friends_biggest as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(g.id) as game_count
from profiles p
join follows f on f.following_id = p.id and f.follower_id = auth.uid()
left join games g on g.user_id = p.id
where p.is_public = true
group by p.id, p.username, p.display_name, p.avatar_url
order by game_count desc
limit 50;

create or replace view leaderboard_friends_most_valuable as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.currency,
  round(sum(coalesce(g.market_price, g.price))::numeric, 2) as total_value,
  count(g.id) filter (where coalesce(g.market_price, g.price) is not null) as priced_count
from profiles p
join follows f on f.following_id = p.id and f.follower_id = auth.uid()
join games g on g.user_id = p.id
where p.is_public = true
  and g.ownership = 'owned'
  and g.copy_type is distinct from 'digital'
group by p.id, p.username, p.display_name, p.avatar_url, p.currency
having sum(coalesce(g.market_price, g.price)) is not null
order by total_value desc
limit 50;

create or replace view leaderboard_friends_most_owned as
select
  lower(g.title) as title_key,
  (array_agg(g.title order by g.created_at))[1] as title,
  count(*) as owner_count,
  (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1] as cover
from games g
join profiles p on p.id = g.user_id
join follows f on f.following_id = p.id and f.follower_id = auth.uid()
where g.ownership = 'owned' and p.is_public = true
group by lower(g.title)
order by owner_count desc
limit 50;

create or replace view leaderboard_friends_trending as
select
  lower(g.title) as title_key,
  (array_agg(g.title order by g.created_at desc))[1] as title,
  count(*) as recent_adds,
  (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1] as cover
from games g
join profiles p on p.id = g.user_id
join follows f on f.following_id = p.id and f.follower_id = auth.uid()
where p.is_public = true and g.created_at > now() - interval '14 days'
group by lower(g.title)
order by recent_adds desc
limit 50;

-- Make sure the API roles can read the leaderboard views
grant select on leaderboard_most_owned to anon, authenticated;
grant select on leaderboard_biggest_collections to anon, authenticated;
grant select on leaderboard_trending to anon, authenticated;
grant select on leaderboard_trophies to anon, authenticated;
grant select on leaderboard_most_valuable to anon, authenticated;
grant select on leaderboard_friends to anon, authenticated;
grant select on leaderboard_friends_biggest to anon, authenticated;
grant select on leaderboard_friends_most_valuable to anon, authenticated;
grant select on leaderboard_friends_most_owned to anon, authenticated;
grant select on leaderboard_friends_trending to anon, authenticated;
