-- Opt-in weekly activity digest — see ROADMAP.md "Notification digest
-- emails" and CHANGELOG.md. Adds the single flag
-- app/api/cron/email-activity-digest checks once a week: whoever has it
-- on gets emailed a summary of their own week (items added/completed/
-- rated, trophies earned) plus what the public collectors they follow
-- have been up to. New projects get this automatically from
-- supabase-schema.sql — this is the standalone version for a project set
-- up before this column existed. Defaults to false, so nobody starts
-- getting a new automated email just because this column now exists.

alter table public.profiles
  add column if not exists email_activity_digest_enabled boolean not null default false;
