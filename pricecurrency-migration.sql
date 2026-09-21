-- Remembers which currency each of price/asking_price/price_alert_threshold
-- was actually entered in, the same problem market_price_currency already
-- solved for market-price snapshots (see marketpricecurrency-migration.sql).
-- Without this, changing Settings > Currency silently relabels an old
-- entry under the new symbol instead of flagging it as stale -- the same
-- number, now claiming to be a different currency. Every existing value
-- on these three columns was entered under whatever currency was current
-- on the profile at the time (there's no other record of it), so
-- backfilling to the profile's currency right now is the same assumption
-- this app already made for every one of these values before this column
-- existed -- it doesn't change what's displayed today, it only starts
-- flagging a real mismatch the next time Settings > Currency actually
-- changes, which is the whole point of this fix. See ROADMAP.md/
-- CHANGELOG.md and components/GameModal.jsx/GameCard.jsx for the
-- application-level half of this fix.
alter table games add column if not exists price_currency text;
alter table games add column if not exists asking_price_currency text;
alter table games add column if not exists price_alert_threshold_currency text;

update games g
set price_currency = p.currency
from profiles p
where p.id = g.user_id and g.price is not null and g.price_currency is null;

update games g
set asking_price_currency = p.currency
from profiles p
where p.id = g.user_id and g.asking_price is not null and g.asking_price_currency is null;

update games g
set price_alert_threshold_currency = p.currency
from profiles p
where p.id = g.user_id and g.price_alert_threshold is not null and g.price_alert_threshold_currency is null;
