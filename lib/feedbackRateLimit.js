import { createAdminClient } from './supabaseAdmin';

// Rate limit for /api/feedback — the last of the site's public write
// endpoints (comments, articles, and the four WebAuthn routes already got
// one) with no cap at all. See ROADMAP.md/CHANGELOG.md: it's arguably the
// most exposed of the four, since no sign-in is required at all, and every
// accepted submission fires a real notification email via Resend on top of
// the database insert — a burst of junk doesn't just fill the `feedback`
// table, it floods Taylor's actual inbox too.
//
// Can't reuse the trigger-on-table pattern comments/articles use, same
// reasoning as WebAuthn's routes (lib/webauthnRateLimit.js): most feedback
// submitters aren't signed in, so there's no reliable user_id/author_id to
// key a trigger on. Dedicated table instead, keyed by client IP, checked
// and recorded from the route handler.
//
// Looser than comments/articles' 5-per-5-minutes on purpose — a real
// person might legitimately resubmit once or twice after fixing a
// validation error or a failed send, and this isn't gating a feed anyone
// else sees, just an inbox.
const WINDOW_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 5;

// Best-effort client IP extraction — same as lib/webauthnRateLimit.js.
// Vercel sets x-forwarded-for on every request it proxies; x-real-ip is a
// fallback for other hosts. A missing header falls back to a fixed
// string, which just means every such request shares one identifier's
// budget — fails safe (shared limit) rather than open (no limit at all).
function clientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Checks (and, if not limited, records) one request against the shared
// feedback rate limit — see feedback-rate-limit-migration.sql for the
// table this reads/writes. Returns { limited: boolean }; call sites should
// return a 429 when true.
export async function checkFeedbackRateLimit(req) {
  const admin = createAdminClient();
  const identifier = clientIp(req);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from('feedback_rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .gt('created_at', since);

  // Fail open — a broken count query shouldn't stop someone from
  // reporting a real bug; it just means this one request goes
  // unrate-limited.
  if (error) return { limited: false };
  if ((count || 0) >= MAX_REQUESTS_PER_WINDOW) return { limited: true };

  await admin.from('feedback_rate_limit_events').insert({ identifier });

  // Opportunistic cleanup instead of a dedicated cron job (same reasoning
  // as lib/webauthnRateLimit.js — didn't want to add a new scheduled
  // route just for housekeeping): on roughly 1 in 50 calls, sweep out rows
  // old enough that they can no longer affect any window's count.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    admin
      .from('feedback_rate_limit_events')
      .delete()
      .lt('created_at', cutoff)
      .then(() => {})
      .catch(() => {});
  }

  return { limited: false };
}
