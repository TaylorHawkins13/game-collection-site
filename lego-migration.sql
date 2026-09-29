-- Adds "LEGO Set" as a trackable item type, alongside games, comics,
-- cards, vinyl, media, consoles, and Funko Pops — requested directly
-- (Sept 2026). No new columns needed — reuses existing fields the same
-- way trading cards/Funko Pops already do:
--   card_set    -> Theme (e.g. Star Wars, City, Harry Potter, Marvel)
--   card_number -> Set number (e.g. #75192)
--   player_name -> Minifigures included (e.g. Han Solo, Chewbacca, Rey)
--   publisher   -> Exclusive to (e.g. LEGO Store, LEGOLAND, San Diego Comic-Con)
--   grade       -> Grading (e.g. AFA 85, Raw)
--   is_variant / variant_notes -> Special/exclusive variant (alternate
--     box print, promotional polybag included, employee exclusive)
--   condition, tags, cover, rating, ownership, price/market_price, etc.
--   all already work the same as other types.
--
-- Already applied directly to production (Sept 2026) — this file exists
-- as the same historical record every other new-type migration in this
-- repo already gets (funko-migration.sql, vhs-migration.sql, etc.), not
-- as a "run this yourself" instruction like most of the others.
alter table games drop constraint if exists games_item_type_check;
alter table games add constraint games_item_type_check
  check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'vhs', 'cd', 'console', 'funko_pop', 'lego'));
