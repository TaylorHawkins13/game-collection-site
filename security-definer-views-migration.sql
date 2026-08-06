-- Fixes every "Security Definer View" warning in Supabase's Security
-- Advisor. Postgres views run with the view OWNER's permissions by
-- default (effectively acting like SECURITY DEFINER even without saying
-- so) — that's what the advisor is flagging on each leaderboard view.
-- security_invoker makes a view run with the actual querying user's own
-- permissions/RLS instead, same as querying the underlying tables
-- directly would.
--
-- This is safe to run: every table these views touch (profiles, games,
-- follows, achievement_defs, user_achievements) already has RLS
-- policies that allow exactly the reads these views need — profiles,
-- follows, and achievement data are fully public-readable, and games is
-- readable whenever the owner's profile is public, which is exactly
-- what these views already filter for. So this only tightens permission
-- *enforcement* — it doesn't change what the leaderboards actually show.
--
-- Run this once in Supabase's SQL Editor. Safe to re-run.
alter view leaderboard_most_owned set (security_invoker = on);
alter view leaderboard_biggest_collections set (security_invoker = on);
alter view leaderboard_trending set (security_invoker = on);
alter view leaderboard_trophies set (security_invoker = on);
alter view leaderboard_most_valuable set (security_invoker = on);
alter view leaderboard_friends set (security_invoker = on);
alter view leaderboard_friends_biggest set (security_invoker = on);
alter view leaderboard_friends_most_valuable set (security_invoker = on);
alter view leaderboard_friends_most_owned set (security_invoker = on);
alter view leaderboard_friends_trending set (security_invoker = on);
