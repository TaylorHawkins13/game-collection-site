-- Fixes a real bug in the Upcoming Releases feature (Sep 2026 — found
-- while investigating why the page still showed nothing for a real
-- account even after the separate CRON_SECRET-never-set incident was
-- fixed, see CHANGELOG.md). `upcoming_release_cache.series_key` is keyed
-- by the *resolved* IGDB franchise / Comic Vine volume name (e.g.
-- "Super Mario Land" resolves to the "Mario" franchise, cached as
-- `game:mario`) — but the read side
-- (app/dashboard/upcoming-releases/page.js) was looking rows up by a key
-- built straight from the signed-in user's own *stored* title
-- (`game:super mario land`), which essentially never equals the
-- resolved key unless someone happens to own an item titled exactly the
-- same as its own franchise/series. In practice this meant the page
-- showed real cached data for almost nobody, even once the cache itself
-- was populating correctly.
--
-- This table records, for every raw title/series the cron
-- (app/api/cron/refresh-upcoming-releases) has ever resolved, which
-- cache row it actually belongs to — a plain raw_key -> resolved_key
-- lookup, populated as the cron processes each title. The read side
-- resolves through this table first, then falls back to treating the
-- raw key as a cache key too (covers the coincidental exact-match case,
-- and any row cached before this fix shipped). New projects get this
-- automatically from supabase-schema.sql — this is the standalone
-- version for a project set up before this table existed.
create table if not exists upcoming_release_aliases (
  raw_key text primary key,
  resolved_key text not null,
  updated_at timestamptz not null default now()
);

alter table upcoming_release_aliases enable row level security;
revoke all on upcoming_release_aliases from anon, authenticated;
