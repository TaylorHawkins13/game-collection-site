import { createAdminClient } from './supabaseAdmin';

// Rate limiting for the public /api/v1/* routes — see
// api-tokens-migration.sql for why this is a dedicated events table
// (same pattern as lib/webauthnRateLimit.js) rather than a DB trigger:
// there's no row being inserted on a read request to hang a trigger off
// of. Keyed by token id rather than client IP, unlike the WebAuthn
// limiter — a request here always has an authenticated token by the time
// it reaches this check (lib/apiAuth.js runs first), so there's no
// "no identifier yet" case to fall back to IP for.
//
// 60/minute is generous for a personal-use read API (a spreadsheet
// refresh or a personal dashboard polling occasionally) while still
// capping runaway/misbehaving scripts.
const WINDOW_MINUTES = 1;
const MAX_REQUESTS_PER_WINDOW = 60;

// Returns { limited: boolean }; call sites should return a 429 when true.
export async function checkApiRateLimit(tokenId) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from('api_rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', tokenId)
    .gt('created_at', since);

  // Fail open — a broken count query shouldn't lock out a legitimate
  // token; it just means this one request goes unrate-limited.
  if (error) return { limited: false };
  if ((count || 0) >= MAX_REQUESTS_PER_WINDOW) return { limited: true };

  await admin.from('api_rate_limit_events').insert({ identifier: tokenId });

  // Opportunistic cleanup, same ~2% chance as lib/webauthnRateLimit.js —
  // no dedicated cron just for housekeeping this table.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    admin
      .from('api_rate_limit_events')
      .delete()
      .lt('created_at', cutoff)
      .then(() => {})
      .catch(() => {});
  }

  return { limited: false };
}
