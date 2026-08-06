-- Fixes "Function Search Path Mutable" warnings from Supabase's Security
-- Advisor. A function without an explicit search_path can be tricked by
-- someone creating same-named objects earlier in the schema resolution
-- order — most dangerous on SECURITY DEFINER functions (which run with
-- elevated privileges), but the advisor flags any function missing it.
-- This pins each affected function to the public schema, matching the
-- pattern this project's other functions (award_achievements_for,
-- check_and_award_achievements, refresh_item_market_price,
-- backfill_all_achievements) already use.
--
-- ALTER FUNCTION ... SET only changes function metadata, not the
-- function body — nothing about what these functions actually do
-- changes. Safe to re-run.
alter function handle_new_user() set search_path = public;
alter function set_updated_at() set search_path = public;
alter function recommend_games(uuid, int) set search_path = public;
