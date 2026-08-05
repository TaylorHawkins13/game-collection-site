-- Adds a "Friends" leaderboard tab: ranks by Shelf Life trophy count,
-- but only among people the viewer follows — a smaller, more personal
-- "who's ahead" than the site-wide rankings.
--
-- Unlike the other leaderboard views, this one isn't the same for
-- everyone: it's scoped inline via auth.uid(), which Postgres
-- re-evaluates per query using whoever's actually asking, not baked in
-- at creation time. A signed-out visitor (auth.uid() is null) just
-- gets an empty result — no separate code path needed for that.
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

grant select on leaderboard_friends to anon, authenticated;
