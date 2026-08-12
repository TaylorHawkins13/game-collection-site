-- Adds a grace period to self-service account deletion instead of it
-- being instant. Requesting deletion (app/api/account/delete) now just
-- timestamps the request; the actual, irreversible cleanup happens
-- later, once GRACE_PERIOD_HOURS (lib/accountDeletion.js) has passed —
-- see app/api/cron/process-account-deletions, which needs the
-- vercel.json cron entry deployed to actually run. Signing back in
-- during the window shows a "Cancel deletion" banner (see
-- DashboardClient.jsx) that just clears this column back to null.
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;
