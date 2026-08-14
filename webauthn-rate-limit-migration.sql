-- Server-enforced rate limiting for the four WebAuthn API routes
-- (register-options, register-verify, login-options, login-verify) —
-- flagged in ROADMAP.md: none of these had any request cap, unlike
-- comments/articles which each got a trigger-based limit earlier.
--
-- This can't reuse that same trigger pattern though: comments/articles
-- are rate-limited by putting a check on the table they insert into, but
-- login-options doesn't insert anything at all (it just mints a
-- challenge), and none of the four routes have a signed-in user_id to
-- key on the way comments/articles do — login is exactly the case where
-- there's no user yet. So this is a dedicated events table, keyed by
-- client IP instead, checked and recorded from the route handlers
-- themselves via lib/webauthnRateLimit.js rather than a DB trigger.
create table if not exists webauthn_rate_limit_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  created_at timestamptz not null default now()
);

-- Every check queries "how many rows for this identifier in the last N
-- minutes" — identifier-first composite index is what makes that cheap
-- once this table has any real volume in it.
create index if not exists webauthn_rate_limit_events_identifier_idx
  on webauthn_rate_limit_events (identifier, created_at desc);

alter table webauthn_rate_limit_events enable row level security;
-- Deliberately no policies at all — enabling RLS with zero policies
-- already denies anon/authenticated by default, and this table is only
-- ever touched by the service-role client (lib/supabaseAdmin.js), which
-- bypasses RLS entirely, same reasoning as passkey_credentials in
-- passkey-migration.sql. The explicit revoke below is belt-and-suspenders
-- on top of that default-deny, not a substitute for it — table-level
-- grants and RLS are two separate layers, so it's worth closing both
-- rather than relying on RLS alone.
revoke all on webauthn_rate_limit_events from anon, authenticated;
