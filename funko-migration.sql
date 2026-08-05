-- Adds "Funko Pop" as a trackable item type, alongside games, comics,
-- cards, vinyl, media, and consoles. No new columns needed — reuses
-- existing fields the same way trading cards already do:
--   card_set    -> Series / line (e.g. Marvel, Movies, Animation, Retro Toys)
--   card_number -> Pop! # (e.g. #1141)
--   player_name -> Character
--   publisher   -> Exclusive to (e.g. Hot Topic, SDCC, GameStop, Funko Shop)
--   grade       -> Grading (e.g. PPJoe 9.5, GalaxyPop 10, Raw)
--   is_variant / variant_notes -> Chase / special variant (glow, flocked,
--     metallic, diamond glitter, black light, etc.)
--   condition, tags, cover, rating, ownership, price/market_price, etc.
--   all already work the same as other types.
alter table games drop constraint if exists games_item_type_check;
alter table games add constraint games_item_type_check
  check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd', 'console', 'funko_pop'));
