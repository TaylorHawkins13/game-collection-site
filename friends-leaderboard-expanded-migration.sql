-- Expands the Friends leaderboard tab beyond trophies-only. If you already
-- ran friends-leaderboard-migration.sql, that gave you leaderboard_friends
-- (trophies) — this adds four more friends-scoped views so the Friends tab
-- can rank by the same categories as the site-wide leaderboard: biggest
-- collection, most valuable, most-owned titles, and trending titles.
--
-- Same auth.uid()-scoping trick as leaderboard_friends: each view is
-- re-evaluated per query using whoever's actually asking, so the same view
-- returns a different (correctly private) result per viewer, and a
-- signed-out visitor just gets nothing back.
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

grant select on leaderboard_friends_biggest to anon, authenticated;
grant select on leaderboard_friends_most_valuable to anon, authenticated;
grant select on leaderboard_friends_most_owned to anon, authenticated;
grant select on leaderboard_friends_trending to anon, authenticated;
