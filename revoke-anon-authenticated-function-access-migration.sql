-- Follow-up to revoke-internal-function-access-migration.sql and
-- handle-new-user-revoke-migration.sql — those revoked EXECUTE from
-- `public`, which is the standard vanilla-Postgres default. But Supabase
-- projects ALSO grant EXECUTE on every new public-schema function
-- directly to `anon` and `authenticated` at creation time, via its own
-- default-privilege setup (done by the internal `supabase_admin` role) —
-- a separate mechanism from the generic Postgres PUBLIC default. That's
-- why the Security Advisor kept flagging these even after the earlier
-- migration: revoking from `public` never touched the explicit
-- anon/authenticated grants underneath.
--
-- This revokes EXECUTE from anon and authenticated explicitly on all
-- five functions, then re-grants only where it's actually intended
-- (check_and_award_achievements and refresh_item_market_price, both to
-- authenticated only).
--
-- Run this once in Supabase's SQL Editor. Safe to re-run.

revoke execute on function handle_new_user() from anon, authenticated;

revoke execute on function award_achievements_for(uuid) from anon, authenticated;

revoke execute on function backfill_all_achievements() from anon, authenticated;

revoke execute on function check_and_award_achievements(uuid) from anon, authenticated;
grant execute on function check_and_award_achievements(uuid) to authenticated;

revoke execute on function refresh_item_market_price(uuid, numeric, text) from anon, authenticated;
grant execute on function refresh_item_market_price(uuid, numeric, text) to authenticated;

-- Optional but recommended (Supabase's own documented fix for this):
-- stops this from silently happening again for any function you or I
-- add to this project in the future. Only affects functions created
-- AFTER this runs — everything above still needed its own explicit
-- revoke, since this doesn't apply retroactively.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
