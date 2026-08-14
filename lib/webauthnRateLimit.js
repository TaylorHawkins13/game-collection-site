import { createAdminClient } from './supabaseAdmin';

// A real sign-in naturally makes two of these calls (options, then
// verify), and someone switching devices or retrying a failed Face ID
// prompt can easily add a few more — so this sits well above
// comments/articles' 5-per-5-minutes (see comment-rate-limit-migration.sql)
// to avoid punishing normal use while still capping the volume-abuse case
// described in ROADMAP.md ("cheap challenge generation, cheap 'not
// recognized' lookups"). One shared budget across all four routes rather
// than one per route, since they're all steps of the same two flows.
const WINDOW_MINUTES = 5;
const MAX_REQUESTS_PER_WINDOW = 20;

// Best-effort client IP extraction. Vercel sets x-forwarded-for on every
// request it proxies; x-real-ip is a fallback for other hosts. A missing
// header falls back to a fixed string, which just means every such
// request shares one identifier's budget — fails safe (shared limit)
// rather than open (no limit at all).
function clientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Checks (and, if not limited, records) one request against the shared
// WebAuthn rate limit — see webauthn-rate-limit-migration.sql for why
// this is a dedicated events table checked from route handlers rather
// than the DB-trigger pattern comments/articles use. Returns
// { limited: boolean }; call sites should return a 429 when true.
export async function checkWebauthnRateLimit(req) {
  const admin = createAdminClient();
  const identifier = clientIp(req);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from('webauthn_rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .gt('created_at', since);

  // Fail open — a broken count query shouldn't lock everyone out of
  // signing in; it just means this one request goes unrate-limited.
  if (error) return { limited: false };
  if ((count || 0) >= MAX_REQUESTS_PER_WINDOW) return { limited: true };

  await admin.from('webauthn_rate_limit_events').insert({ identifier });

  // Opportunistic cleanup instead of a dedicated cron job (didn't want to
  // add a new scheduled route — see vercel.json — just for housekeeping):
  // on roughly 1 in 50 calls, sweep out rows old enough that they can no
  // longer affect any window's count, so the table doesn't grow forever.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    admin
      .from('webauthn_rate_limit_events')
      .delete()
      .lt('created_at', cutoff)
      .then(() => {})
      .catch(() => {});
  }

  return { limited: false };
}
