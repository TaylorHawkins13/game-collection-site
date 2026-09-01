import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { generateApiToken } from '@/lib/apiTokens';

// The one step of API-token management that has to be a server route
// rather than a direct client-side Supabase call (see
// app/dashboard/api-tokens/ApiTokensClient.jsx for why listing/revoking
// don't need one): generating the actual secret has to happen
// server-side so the raw token only ever exists in two places — this
// response, and the requester's own copy of it — never in anything that
// could later be replayed to forge a hash client-side.
export async function POST(req) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) {
    return NextResponse.json({ error: 'Give the token a short label (1–60 characters).' }, { status: 400 });
  }

  // Session-scoped client, not the admin one — the insert still has to
  // satisfy api_tokens' own "user_id = auth.uid()" policy (see
  // api-tokens-migration.sql), which is exactly what's wanted here: a
  // real defense-in-depth check that this route can only ever create a
  // token for the signed-in user, on top of user_id being set from the
  // verified session rather than anything the client sent.
  const { token, hash, prefix } = generateApiToken();
  const { data, error } = await supabase
    .from('api_tokens')
    .insert({ user_id: user.id, name, token_hash: hash, token_prefix: prefix })
    .select('id, name, token_prefix, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The only response that will ever carry the raw token — the row
  // itself only ever stores its hash from here on.
  return NextResponse.json({ token, created: data });
}
