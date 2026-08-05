-- Adds a "Most valuable collections" leaderboard, ranking public
-- collectors by estimated collection value (market price if checked,
-- else entered purchase price — owned, non-digital items only, same
-- rule lib/valueSnapshot.js's estimateCollectionValue() uses).
--
-- Note: this does NOT do currency conversion. Each collector's total is
-- in their own profile currency (carried along in the view so the UI
-- can format it correctly), so it's ranking raw numbers across
-- currencies — same display-only-currency limitation the rest of the
-- site already has (see ROADMAP.md "Live currency conversion").
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

grant select on leaderboard_most_valuable to anon, authenticated;
