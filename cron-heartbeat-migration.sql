-- Visibility layer for cron jobs — one row per job, upserted every time
-- it runs (success or failure), so /admin/stats can show "did this
-- actually run recently" without needing Vercel's own runtime logs
-- (1-hour retention on the current plan). Deliberately just visibility:
-- this alone can't catch a cron that stops firing entirely (a dropped
-- vercel.json schedule, a broken build, a Vercel Cron outage) — that
-- needs something outside Vercel watching for silence, like a free
-- dead-man's-switch service (healthchecks.io/Cronitor). See ROADMAP.md.
create table if not exists cron_runs (
  job_name text primary key,
  last_run_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_status text not null default 'unknown' check (last_status in ('success', 'error', 'unknown')),
  updated_at timestamptz not null default now()
);

alter table cron_runs enable row level security;
-- No policies at all — only ever touched by the service-role client
-- (lib/cronHeartbeat.js, called from within each cron route), same
-- reasoning as webauthn_rate_limit_events/feedback_rate_limit_events.
revoke all on cron_runs from anon, authenticated;
