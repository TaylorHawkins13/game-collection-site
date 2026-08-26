-- Adds the "public_lists" view, which powers the new /lists directory
-- page — a browsable feed of everyone's public custom lists (Favorites,
-- For sale, etc.), not just visible on each list's own owner's profile.
-- See ROADMAP.md's competitor-pass note (Backloggd/Grouvee both lean
-- hard on "browse thousands of community-made lists" as a discovery
-- surface) and CHANGELOG.md for the full writeup.
--
-- No new table — this is a view over the existing custom_lists /
-- custom_list_items / games tables, so it's safe to run even on a
-- project with existing lists; they just start showing up here too, as
-- long as the list's owner has a public profile and the list has at
-- least one item in it.
create or replace view public_lists
  with (security_invoker = true) as
select
  l.id,
  l.name,
  l.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  l.created_at,
  count(cli.game_id) as item_count,
  (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1] as cover
from custom_lists l
join profiles p on p.id = l.user_id
join custom_list_items cli on cli.list_id = l.id
join games g on g.id = cli.game_id
where p.is_public = true
group by l.id, l.name, l.user_id, p.username, p.display_name, p.avatar_url, l.created_at
order by count(cli.game_id) desc, l.created_at desc
limit 200;

grant select on public_lists to anon, authenticated;
