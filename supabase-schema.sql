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
  item_type text not null default 'game' check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd')),
  title text not null,
  platforms text[] not null default '{}',
  genre text default '',
  cover text default '',
  ownership text not null default 'owned' check (ownership in ('owned','wishlist','sold')),
  condition text default '',
  price numeric,
  purchase_date date,
  play_status text not null default 'backlog' check (play_status in ('backlog','playing','completed','abandoned')),
  rating int not null default 0 check (rating between 0 and 5),
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
  -- last "Check eBay price" result: average of current active US listings
  market_price numeric,
  market_price_checked_at timestamptz,
  -- applies to any item type: fully completed (all extras/achievements
  -- done, full series/set collected, etc.) beyond play_status/condition
  fully_completed boolean not null default false,
  -- null = not on the public profile showcase; 1..5 = display position
  showcase_order integer,
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
-- Leaderboard views (only consider public profiles)
-- ------------------------------------------------------------
create or replace view leaderboard_most_owned as
select
  lower(g.title) as title_key,
  (array_agg(g.title order by g.created_at))[1] as title,
  count(*) as owner_count
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
  count(*) as recent_adds
from games g
join profiles p on p.id = g.user_id
where p.is_public = true and g.created_at > now() - interval '14 days'
group by lower(g.title)
order by recent_adds desc
limit 50;

-- Make sure the API roles can read the leaderboard views
grant select on leaderboard_most_owned to anon, authenticated;
grant select on leaderboard_biggest_collections to anon, authenticated;
grant select on leaderboard_trending to anon, authenticated;
