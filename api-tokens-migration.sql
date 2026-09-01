-- ROADMAP.md "Public read-only API / personal access tokens" — lets a
-- collector generate an API key scoped to just their own data, so a
-- spreadsheet, personal dashboard, or script can pull their collection
-- directly instead of exporting a CSV by hand. See lib/apiTokens.js /
-- lib/apiAuth.js / app/api/v1/*.
--
-- Only a sha256 hash of the actual token is ever stored — the raw token
-- (sl_live_<48 hex chars>, see lib/apiTokens.js) is generated server-side
-- in app/api/tokens/route.js and shown to the owner exactly once at
-- creation time, the same "you won't see this again" pattern any real
-- API-key product uses, so a leaked database dump alone can never be
-- used to authenticate as someone's token. token_prefix (the token's
-- first several characters) is stored in the clear purely so the owner
-- can tell their tokens apart in the list UI without ever re-deriving
-- the full value.
create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_tokens_user_id_idx on api_tokens (user_id);

alter table api_tokens enable row level security;

-- Normal user-owned-row policies — same "(select auth.uid())" wrapped
-- form the rls-performance-migration pass already standardized on, so
-- the planner evaluates it once per query rather than once per row.
create policy "Users can view their own tokens"
  on api_tokens for select
  using (user_id = (select auth.uid()));

create policy "Users can create their own tokens"
  on api_tokens for insert
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own tokens"
  on api_tokens for delete
  using (user_id = (select auth.uid()));

-- Deliberately no update policy for normal users — a token's name/hash
-- never needs editing from the client; the only writer of last_used_at
-- is the service-role client in lib/apiAuth.js (a public /api/v1
-- request has no Supabase session to satisfy the above policies with
-- anyway, exactly the same reasoning webauthn_rate_limit_events and
-- passkey_credentials' server-only writes already rely on).

-- ------------------------------------------------------------
-- api_rate_limit_events: same dedicated-events-table pattern as
-- webauthn_rate_limit_events (see webauthn-rate-limit-migration.sql),
-- but keyed by the calling token's id instead of client IP — a public
-- API request always has a token by the time it reaches the rate
-- limiter (checked in lib/apiAuth.js first), so there's no "no
-- identifier yet" case here the way login-options has for WebAuthn.
-- ------------------------------------------------------------
create table if not exists api_rate_limit_events (
  id bigint generated always as identity primary key,
  identifier text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limit_events_identifier_idx
  on api_rate_limit_events (identifier, created_at desc);

alter table api_rate_limit_events enable row level security;
-- Deliberately no policies at all — same default-deny-plus-explicit-
-- revoke belt-and-suspenders as webauthn_rate_limit_events. Only ever
-- touched by the service-role client (lib/apiRateLimit.js).
revoke all on api_rate_limit_events from anon, authenticated;
