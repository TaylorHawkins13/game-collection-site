-- Adds a trophy leaderboard (public collectors ranked by Shelf Life
-- trophies earned), and adds cover art to the existing most-owned/trending
-- views so the leaderboard page has something more than bare text rows.
--
-- The new "cover" column has to be added at the very end of each SELECT
-- list — Postgres's CREATE OR REPLACE VIEW only allows appending new
-- columns, not inserting them in the middle, or it errors with something
-- like: cannot change name of view column "owner_count" to "cover".

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

grant select on leaderboard_most_owned to anon, authenticated;
grant select on leaderboard_trending to anon, authenticated;
grant select on leaderboard_trophies to anon, authenticated;
