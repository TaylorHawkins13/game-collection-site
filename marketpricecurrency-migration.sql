-- Remembers which currency a checked eBay price actually came back in, now
-- that price checks search a different eBay site depending on the buyer's
-- currency (GBP -> ebay.co.uk, EUR -> ebay.de, etc.) instead of always
-- USD. Without this, there's no way to know after the fact whether a
-- stored market_price is $, £, or something else — every existing
-- market_price on this column was checked before regional pricing shipped,
-- so it's safe to backfill those as USD.
alter table games add column if not exists market_price_currency text;

update games set market_price_currency = 'USD' where market_price is not null and market_price_currency is null;
