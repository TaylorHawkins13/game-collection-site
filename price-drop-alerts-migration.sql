-- Price-drop alerts: an optional threshold on a wishlist item, checked
-- once a day by a Vercel Cron job (app/api/cron/price-drop-check) against
-- current eBay listings. price_alert_active tracks whether the item is
-- currently below its threshold, so the alert only fires again after the
-- price rises back above it and dips a second time (rather than
-- re-notifying every single day it stays low).
alter table games add column if not exists price_alert_threshold numeric;
alter table games add column if not exists price_alert_active boolean not null default false;

-- So a price-drop notification can link to which item dropped.
alter table notifications add column if not exists game_id uuid references games(id) on delete cascade;
