import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { authenticateApiRequest } from '@/lib/apiAuth';
import { checkApiRateLimit } from '@/lib/apiRateLimit';

// GET /api/v1/me — basic account info for the token's owner. Public
// (no session), authenticated by the Authorization: Bearer <token>
// header instead — see lib/apiAuth.js.
export async function GET(req) {
  const auth = await authenticateApiRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { limited } = await checkApiRateLimit(auth.tokenId);
  if (limited) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute.' }, { status: 429 });
  }

  // Admin client — a token request has no Supabase session for RLS to
  // scope against, so every query here must explicitly filter by the
  // userId authenticateApiRequest resolved rather than relying on RLS.
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('username, display_name, is_public, currency, created_at')
    .eq('id', auth.userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Could not load account.' }, { status: 500 });
  }

  const { count } = await admin
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId);

  return NextResponse.json({
    username: profile.username,
    display_name: profile.display_name,
    is_public: profile.is_public,
    currency: profile.currency,
    member_since: profile.created_at,
    item_count: count || 0,
  });
}
