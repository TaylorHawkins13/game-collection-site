import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/siteUrl';

// Steam only offers legacy OpenID 2.0 (no modern OAuth2/OIDC), which works
// as a full-page redirect handshake rather than a popup: send the browser
// to Steam with a return_to URL, Steam confirms who's logging in, then
// sends the browser back to /api/steam-callback with a signed response we
// verify there.
export async function GET() {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${SITE_URL}/api/steam-callback`,
    'openid.realm': SITE_URL,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
}
