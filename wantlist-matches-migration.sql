-- Adds the "find_wantlist_matches" function, which powers the new
-- "Wishlist matches" panel on the dashboard — closes ROADMAP.md's
-- "Wantlist matching / trading" ("surface when someone you follow has
-- something on your wishlist, or a duplicate they might trade"). Both
-- signals from that line fold into one query: for each of the caller's
-- own wishlist items, find public collectors they follow who own it,
-- with a count of how many copies — 2+ is the "maybe a spare" signal,
-- same tile rather than a second feature.
--
-- Same shape and same reasoning as recommend_games/recommend_collectors
-- right above it in supabase-schema.sql: deliberately NOT security
-- definer, so it only ever sees what the calling user is already
-- allowed to see under RLS (their own wishlist, plus a followed
-- profile's owned items if that profile is public) — the explicit
-- `p.is_public = true` below is belt-and-suspenders on top of that RLS
-- backstop, same pattern recommend_collectors already uses. Matches on
-- lower(title) within the same item_type, same simple convention every
-- other title-matching SQL function here already uses (no punctuation
-- normalization at the SQL layer — that's a JS-only concern, see
-- lib/duplicateCheck.js's own comment on why).
create or replace function find_wantlist_matches(p_user_id uuid, p_limit int default 30)
returns table (
  wishlist_game_id uuid,
  title text,
  item_type text,
  cover text,
  owner_user_id uuid,
  owner_username text,
  owner_display_name text,
  owned_copies bigint
)
language sql
stable
set search_path = public
as $$
  select
    w.id as wishlist_game_id,
    w.title,
    w.item_type,
    coalesce(
      nullif(w.cover, ''),
      (array_agg(g.cover) filter (where g.cover is not null and g.cover <> ''))[1]
    ) as cover,
    g.user_id as owner_user_id,
    p.username as owner_username,
    p.display_name as owner_display_name,
    count(g.id) as owned_copies
  from games w
  join follows f on f.follower_id = p_user_id
  join games g
    on g.user_id = f.following_id
    and g.item_type = w.item_type
    and lower(g.title) = lower(w.title)
    and g.ownership = 'owned'
  join profiles p on p.id = g.user_id and p.is_public = true
  where w.user_id = p_user_id
    and w.ownership = 'wishlist'
  group by w.id, w.title, w.item_type, w.cover, g.user_id, p.username, p.display_name
  order by w.title
  limit greatest(p_limit, 0);
$$;

grant execute on function find_wantlist_matches(uuid, int) to authenticated;
