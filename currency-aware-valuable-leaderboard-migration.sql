-- Makes the "Most valuable" leaderboards (site-wide and Friends) rank
-- collectors fairly across different display currencies, instead of
-- comparing raw numbers as if they were the same unit — a €5,000
-- collection used to outrank a real $6,000 one just because 5,000 >
-- 6,000 as plain numbers. See ROADMAP.md.
--
-- Adds a small, hand-maintained USD conversion table. This is
-- deliberately NOT a live rates API — that's real currency conversion
-- sitewide, a bigger project on its own (see ROADMAP.md "Live currency
-- conversion"). Update the values below by hand occasionally; a ranking
-- like this doesn't need to-the-minute accuracy, just to not be wildly
-- stale.
create table if not exists currency_rates_to_usd (
  code text primary key,
  rate_to_usd numeric not null,
  updated_at timestamptz not null default now()
);

alter table currency_rates_to_usd enable row level security;

drop policy if exists "Currency rates are publicly readable" on currency_rates_to_usd;
create policy "Currency rates are publicly readable"
  on currency_rates_to_usd for select
  using (true);

grant select on currency_rates_to_usd to anon, authenticated;

insert into currency_rates_to_usd (code, rate_to_usd) values
  ('USD', 1),
  ('EUR', 1.09),
  ('GBP', 1.27),
  ('JPY', 0.0067),
  ('CAD', 0.73),
  ('AUD', 0.65),
  ('NZD', 0.60),
  ('CHF', 1.14),
  ('CNY', 0.14),
  ('INR', 0.012),
  ('BRL', 0.17),
  ('MXN', 0.055),
  ('KRW', 0.00072),
  ('SEK', 0.094),
  ('ZAR', 0.055)
on conflict (code) do nothing;

-- `total_value` (what's actually displayed, via lib/currency.js's
-- formatMoney) is unchanged — still each collector's own currency.
-- Only the ranking itself is now based on `total_value_usd`. A
-- collector whose currency somehow isn't in the rate table above still
-- shows up (coalesced to a 1:1 fallback) rather than silently
-- vanishing from the board.
create or replace view leaderboard_most_valuable as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.currency,
  round(sum(coalesce(g.market_price, g.price))::numeric, 2) as total_value,
  round((sum(coalesce(g.market_price, g.price)) * coalesce(r.rate_to_usd, 1))::numeric, 2) as total_value_usd,
  count(g.id) filter (where coalesce(g.market_price, g.price) is not null) as priced_count
from profiles p
join games g on g.user_id = p.id
left join currency_rates_to_usd r on r.code = p.currency
where p.is_public = true
  and g.ownership = 'owned'
  and g.copy_type is distinct from 'digital'
group by p.id, p.username, p.display_name, p.avatar_url, p.currency, r.rate_to_usd
having sum(coalesce(g.market_price, g.price)) is not null
order by total_value_usd desc
limit 50;

create or replace view leaderboard_friends_most_valuable as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.currency,
  round(sum(coalesce(g.market_price, g.price))::numeric, 2) as total_value,
  round((sum(coalesce(g.market_price, g.price)) * coalesce(r.rate_to_usd, 1))::numeric, 2) as total_value_usd,
  count(g.id) filter (where coalesce(g.market_price, g.price) is not null) as priced_count
from profiles p
join follows f on f.following_id = p.id and f.follower_id = auth.uid()
join games g on g.user_id = p.id
left join currency_rates_to_usd r on r.code = p.currency
where p.is_public = true
  and g.ownership = 'owned'
  and g.copy_type is distinct from 'digital'
group by p.id, p.username, p.display_name, p.avatar_url, p.currency, r.rate_to_usd
having sum(coalesce(g.market_price, g.price)) is not null
order by total_value_usd desc
limit 50;

-- `create or replace view` preserves an existing view's storage
-- parameters (like security_invoker) across replacement — but re-assert
-- it explicitly anyway so this migration is correct standalone, even if
-- run somewhere security-definer-views-migration.sql wasn't (or hasn't
-- been yet).
alter view leaderboard_most_valuable set (security_invoker = on);
alter view leaderboard_friends_most_valuable set (security_invoker = on);

grant select on leaderboard_most_valuable to anon, authenticated;
grant select on leaderboard_friends_most_valuable to anon, authenticated;
