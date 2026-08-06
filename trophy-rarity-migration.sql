-- "X% of collectors have this" per Shelf Life trophy — computed live from
-- real user_achievements data across every profile (profile rows and
-- achievement definitions are both publicly readable already, so nothing
-- here needs security definer).
create or replace function trophy_rarity()
returns table(key text, pct numeric)
language sql
stable
set search_path = public
as $$
  select
    ad.key,
    round(
      coalesce(count(ua.user_id), 0)::numeric
      / nullif((select count(*) from profiles), 0) * 100,
      1
    ) as pct
  from achievement_defs ad
  left join user_achievements ua on ua.key = ad.key
  group by ad.key;
$$;

grant execute on function trophy_rarity() to anon, authenticated;
