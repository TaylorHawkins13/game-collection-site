-- "Recommended for you" on the dashboard: finds other public collectors
-- who rated the same things highly as you, then surfaces titles they
-- rated highly that you don't already own.
--
-- Deliberately NOT security definer — it should only ever see what the
-- calling user is already allowed to see under RLS (their own ratings,
-- plus anyone else's if that profile is public). Passing a p_user_id that
-- isn't the caller's own id and isn't a public profile just returns
-- nothing, since the underlying CTEs go through the normal "games"
-- select policy either way.
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
set search_path = public
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
