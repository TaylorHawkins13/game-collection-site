-- Pull List upcoming-release cache — see ROADMAP.md "Pull list /
-- upcoming-release calendar with spend forecasting" and CHANGELOG.md.
-- Backs a new background cron (app/api/cron/refresh-upcoming-releases)
-- that pre-fetches real upcoming-release data from IGDB (games) and
-- Comic Vine (comics) for any franchise/series someone here has actually
-- logged an item from, so /dashboard/pull-list can show a real calendar
-- without hitting either API on every page load — see
-- lib/upcomingReleases.js's module comment for the full reasoning. New
-- projects get this automatically from supabase-schema.sql — this is the
-- standalone version for a project set up before this table existed.

create table if not exists upcoming_release_cache (
  series_key text primary key,
  item_type text not null check (item_type in ('game', 'comic')),
  series_name text not null,
  entries jsonb not null default '[]',
  refreshed_at timestamptz not null default now()
);

alter table upcoming_release_cache enable row level security;
revoke all on upcoming_release_cache from anon, authenticated;
