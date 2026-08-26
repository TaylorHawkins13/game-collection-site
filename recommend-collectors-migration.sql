-- Adds the "recommend_collectors" function, which powers the new
-- "Collectors you might like" panel on the dashboard — reuses the exact
-- same shared-high-rating signal that already powers "Recommended for
-- you" (recommend_games: other public collectors who rated the same
-- titles 4-5 stars as you did), turned around to suggest *people* worth
-- following instead of items worth owning. See ROADMAP.md's
-- competitor-pass note and CHANGELOG.md for the full writeup.
--
-- Deliberately NOT security definer, same reasoning as recommend_games
-- right above it in supabase-schema.sql: it should only ever see what
-- the calling user is already allowed to see under RLS (their own
-- ratings, plus anyone else's if that profile is public).
create or replace function recommend_collectors(p_user_id uuid, p_limit int default 6)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  shared_count bigint
)
language sql
stable
set search_path = public
as $$
  with my_liked as (
    select distinct lower(title) as title_key
    from games
    where user_id = p_user_id and rating >= 4
  )
  select
    g.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    count(distinct lower(g.title)) as shared_count
  from games g
  join profiles p on p.id = g.user_id
  where g.user_id <> p_user_id
    and p.is_public = true
    and g.rating >= 4
    and lower(g.title) in (select title_key from my_liked)
    and not exists (
      select 1 from follows f
      where f.follower_id = p_user_id and f.following_id = g.user_id
    )
  group by g.user_id, p.username, p.display_name, p.avatar_url
  order by shared_count desc
  limit greatest(p_limit, 0);
$$;

grant execute on function recommend_collectors(uuid, int) to authenticated;
