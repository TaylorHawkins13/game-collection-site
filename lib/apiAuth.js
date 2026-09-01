import { createAdminClient } from './supabaseAdmin';
import { hashApiToken, looksLikeApiToken } from './apiTokens';

// Authenticates a request to one of the public /api/v1/* routes against
// the Authorization: Bearer <token> header. There is no Supabase session
// on these requests — the token itself is the credential — so the
// lookup-by-hash has to run through the service-role client (RLS's
// auth.uid() is null here, same reasoning as every other no-session
// route in this codebase). Every call site MUST then manually scope its
// own query by the returned userId — the admin client bypasses RLS
// entirely, so nothing stops it from reading a different user's rows
// unless the route explicitly filters for this one.
//
// Returns { userId, tokenId } on success, or { error, status } to return
// directly as the route's response.
export async function authenticateApiRequest(req) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  if (!token || !looksLikeApiToken(token)) {
    return {
      error: 'Missing or invalid Authorization header — expected "Bearer sl_live_...". Create a token from Settings on your dashboard.',
      status: 401,
    };
  }

  const admin = createAdminClient();
  const hash = hashApiToken(token);
  const { data, error } = await admin
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error || !data) {
    return { error: 'Invalid or revoked token.', status: 401 };
  }

  // Best-effort — a failed timestamp bump shouldn't fail the actual
  // request the token was presented for.
  admin
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
    .catch(() => {});

  return { userId: data.user_id, tokenId: data.id };
}
