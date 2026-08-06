-- Fixes Supabase Security Advisor's "can be executed by the anon role as
-- a SECURITY DEFINER function" warnings. Postgres grants EXECUTE on new
-- functions to PUBLIC by default, which silently includes both `anon`
-- and `authenticated` — none of the functions below ever had that
-- default revoked, so despite being intended as internal-only (or
-- authenticated-only), they were technically callable straight from a
-- signed-out browser via /rest/v1/rpc/<function_name>.
--
-- Also fixes a real bug found while auditing this: check_and_award_
-- achievements' auth check used `p_user_id <> auth.uid()`, but when
-- auth.uid() is null (an anon caller) that comparison evaluates to NULL
-- rather than true — and plpgsql's `if` treats NULL as "skip this
-- branch," so the intended-to-reject check was silently skipped for
-- anon callers instead of blocking them. In practice this meant anyone,
-- signed in or not, could call check_and_award_achievements(<any real
-- user's id>) and force that user's trophies to (re)compute — not a
-- data leak, but not intentional either, and worth closing. Rewritten
-- to use `is distinct from`, which handles nulls correctly.
--
-- Run this once in Supabase's SQL Editor. Safe to re-run.

create or replace function check_and_award_achievements(p_user_id uuid)
returns table(key text, name text, tier text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    return;
  end if;
  return query select * from award_achievements_for(p_user_id);
end;
$$;

revoke execute on function check_and_award_achievements(uuid) from public;
grant execute on function check_and_award_achievements(uuid) to authenticated;

-- award_achievements_for and backfill_all_achievements are internal —
-- no auth.uid() check of their own, only ever meant to be reached via
-- the wrapper above (which runs as their owner when it calls them, so
-- it doesn't need its own grant) or manually from the SQL editor.
revoke execute on function award_achievements_for(uuid) from public;
revoke execute on function backfill_all_achievements() from public;

-- refresh_item_market_price already has its own auth.uid() is null
-- check (raises an exception for anon), so this one was functionally
-- safe already — revoking anyway for defense in depth and to satisfy
-- the advisor if it flags this one too.
revoke execute on function refresh_item_market_price(uuid, numeric, text) from public;
grant execute on function refresh_item_market_price(uuid, numeric, text) to authenticated;
