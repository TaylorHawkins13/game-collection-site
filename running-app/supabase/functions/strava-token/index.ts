// Supabase Edge Function: exchanges/refreshes Strava OAuth tokens so the
// Strava client secret never ships inside the app.
//
// Deploy:  supabase functions deploy strava-token --no-verify-jwt
// Secrets: supabase secrets set STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=...
//
// POST { "code": "..." }            → first connection
// POST { "refresh_token": "..." }   → refresh an expired access token
// Response: { access_token, refresh_token, expires_at, athlete? }

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });
  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'Strava is not configured on the server.' }, 500);

  let body: { code?: unknown; refresh_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  if (typeof body.code === 'string' && body.code.length < 200) {
    form.set('code', body.code);
    form.set('grant_type', 'authorization_code');
  } else if (typeof body.refresh_token === 'string' && body.refresh_token.length < 200) {
    form.set('refresh_token', body.refresh_token);
    form.set('grant_type', 'refresh_token');
  } else {
    return json({ error: 'Send a code or a refresh_token.' }, 400);
  }

  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body: form });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: data?.message ?? 'Strava rejected the request.' }, r.status);
  // Only pass back what the app needs.
  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete ? { id: data.athlete.id, firstname: data.athlete.firstname } : undefined,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}
