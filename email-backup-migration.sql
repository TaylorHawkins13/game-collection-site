-- Opt-in monthly email data backup — see ROADMAP.md "Opt-in automatic
-- backup of exports" and CHANGELOG.md. Adds the single flag
-- app/api/cron/email-data-backup checks once a month: whoever has it on
-- gets emailed the same CSV + JSON export "Export CSV"/"Download my data"
-- already produce on demand (Settings > Data), as attachments. New
-- projects get this automatically from supabase-schema.sql — this is the
-- standalone version for a project set up before this column existed.
-- Defaults to false, so nobody starts getting a new automated email just
-- because this column now exists.

alter table public.profiles
  add column if not exists email_backup_enabled boolean not null default false;
