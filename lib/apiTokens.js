import crypto from 'crypto';

// ROADMAP.md "Public read-only API / personal access tokens." A token
// looks like sl_live_<48 hex chars> — the sl_live_ prefix is purely a
// recognizability convention (the same idea as Stripe's sk_live_/GitHub's
// ghp_) so a token is identifiable as a Shelf Life credential at a
// glance if it ever turns up somewhere it shouldn't (a public repo, a
// support ticket, etc.), not a version marker — there's no sl_test_
// counterpart today.
const TOKEN_PREFIX = 'sl_live_';
const RAW_BYTES = 24; // 24 bytes -> 48 hex chars of real entropy

// Only ever called server-side (app/api/tokens/route.js) — the raw
// token is returned to the owner exactly once and never stored; only
// its hash (below) persists, so this function running twice can never
// produce the same token (crypto.randomBytes), and there is no way to
// recover a lost token short of revoking it and creating a new one.
export function generateApiToken() {
  const raw = crypto.randomBytes(RAW_BYTES).toString('hex');
  const token = `${TOKEN_PREFIX}${raw}`;
  return {
    token,
    hash: hashApiToken(token),
    // Shown in the token list UI so an owner can tell entries apart
    // without ever being able to reconstruct the full value from it —
    // prefix plus a handful of characters, not the whole thing.
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
  };
}

// sha256 is plenty here — unlike a password, an API token is already
// high-entropy random data (48 hex chars, no dictionary/pattern to
// brute-force against), so there's no need for a slow, salted KDF like
// bcrypt/argon2 the way lib/checkPassword-adjacent code would use for
// user-chosen passwords. This just needs to not store the token in
// recoverable plain text.
export function hashApiToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function looksLikeApiToken(token) {
  return typeof token === 'string' && token.startsWith(TOKEN_PREFIX) && token.length > TOKEN_PREFIX.length;
}
