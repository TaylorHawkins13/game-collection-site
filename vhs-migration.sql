-- Adds "VHS" as a trackable item type alongside DVD/Blu-ray, sharing the
-- same "movie" fields (writer -> Director, publisher -> Studio, format,
-- edition) and now sharing DVD's new auto-fill search too (see
-- app/api/movie-search/route.js). No new columns needed.
alter table games drop constraint if exists games_item_type_check;
alter table games add constraint games_item_type_check
  check (item_type in ('game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'vhs', 'cd', 'console', 'funko_pop'));
