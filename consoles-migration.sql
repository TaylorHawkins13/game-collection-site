-- Adds "Console" as a trackable item type (Nintendo Switch, PS5, Xbox,
-- retro hardware, etc.) alongside games, comics, cards, vinyl, and media.
-- No new columns needed — reuses existing fields the same way trading
-- cards/vinyl/media already do:
--   publisher  -> Manufacturer (Nintendo, Sony, Microsoft, Sega, ...)
--   format     -> Storage / variant (e.g. 512GB, OLED, Digital Edition)
--   edition    -> Special edition (e.g. Pokémon Scarlet & Violet Edition)
--   grade      -> Grading (e.g. WATA 9.6, VGA 85, Raw)
--   condition, completeness, region, tags, cover, rating, ownership,
--   price/market_price, etc. all already work the same as other types.
alter table games drop constraint if exists games_item_type_check;
alter table games add constraint games_item_type_check
  check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd', 'console'));
