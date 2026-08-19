-- Adds per-category notification muting to an existing project.
-- New projects get this automatically from supabase-schema.sql — this is
-- the standalone version for a project set up before this column existed.
-- See supabase-schema.sql's "Per-category notification mute" section for
-- the full explanation of how muting is enforced (read-time filtering in
-- NotificationBell.jsx, not at insert time).

alter table public.profiles
  add column if not exists muted_notification_types text[] not null default '{}'::text[];
