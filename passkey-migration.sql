-- Passkey (WebAuthn / Face ID / Touch ID) sign-in.
-- Run this against an existing project to add support.

create table if not exists passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Base64url, exactly as returned by the browser's WebAuthn API —
  -- never decoded/re-encoded, just stored and compared as a string.
  credential_id text not null unique,
  -- Base64url-encoded COSE public key, verified against on every
  -- sign-in attempt. Never anything secret (it's a public key), so no
  -- special handling needed beyond the usual RLS below.
  public_key text not null,
  -- WebAuthn's replay-attack counter. Most platform authenticators
  -- (Face ID/Touch ID via iCloud Keychain) always report 0 since the
  -- credential is synced rather than device-bound, so this mostly
  -- matters for hardware security keys — kept anyway since the spec
  -- expects it and it's free to store.
  counter bigint not null default 0,
  transports text[],
  device_type text,
  backed_up boolean not null default false,
  -- User-facing label so someone with a couple of passkeys registered
  -- (phone + laptop) can tell them apart in Settings. Best-effort,
  -- filled in client-side from the browser/OS at registration time —
  -- falls back to a generic label if that's not available.
  nickname text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists passkey_credentials_user_id_idx on passkey_credentials(user_id);

alter table passkey_credentials enable row level security;

-- Users can see and remove their own passkeys (e.g. after losing a
-- device) directly from the client — safe under RLS since both are
-- scoped to auth.uid().
create policy "Users can view their own passkeys"
  on passkey_credentials for select
  using (auth.uid() = user_id);

create policy "Users can delete their own passkeys"
  on passkey_credentials for delete
  using (auth.uid() = user_id);

-- Deliberately no insert/update policy for normal users. A new
-- credential is only ever written after the server has verified a
-- real WebAuthn registration ceremony (app/api/webauthn/register-verify),
-- and the counter/last_used_at columns are only ever updated after a
-- verified sign-in (app/api/webauthn/login-verify) — both go through
-- the service-role client (lib/supabaseAdmin.js), same pattern as the
-- newsletter and price-drop-alert features. A client-side insert would
-- mean trusting the browser to say "yes I really passed WebAuthn
-- verification," which defeats the entire point.
