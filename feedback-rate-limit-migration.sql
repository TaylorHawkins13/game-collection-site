-- Server-enforced rate limiting for /api/feedback — the last of the site's
-- public write endpoints (comments, articles, and the four WebAuthn routes
-- already got one) with no cap at all. Flagged in ROADMAP.md: this one's
-- arguably the most exposed, since it needs no sign-in at all, and every
-- accepted submission fires a real notification email via Resend on top of
-- the database insert — a burst of junk submissions doesn't just fill the
-- `feedback` table, it floods Taylor's actual inbox too.
--
-- Same shape as webauthn_rate_limit_events (see
-- webauthn-rate-limit-migration.sql) and for the same reason: most
-- feedback submitters aren't signed in, so there's no user_id to key a
-- trigger on the way comments/articles do. Dedicated events table instead,
-- keyed by client IP, checked and recorded from the route handler itself
-- via lib/feedbackRateLimit.js rather than a DB trigger.
create table if not exists feedback_rate_limit_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  created_at timestamptz not null default now()
);

-- Every check queries "how many rows for this identifier in the last N
-- minutes" — identifier-first composite index is what makes that cheap
-- once this table has any real volume in it.
create index if not exists feedback_rate_limit_events_identifier_idx
  on feedback_rate_limit_events (identifier, created_at desc);

alter table feedback_rate_limit_events enable row level security;
-- Deliberately no policies at all — enabling RLS with zero policies
-- already denies anon/authenticated by default, and this table is only
-- ever touched by the service-role client (lib/supabaseAdmin.js), which
-- bypasses RLS entirely, same reasoning as webauthn_rate_limit_events. The
-- explicit revoke below is belt-and-suspenders on top of that
-- default-deny, not a substitute for it.
revoke all on feedback_rate_limit_events from anon, authenticated;
