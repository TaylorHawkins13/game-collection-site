import { NextResponse } from 'next/server';

// IGDB requires a Twitch OAuth client-credentials token. The client
// secret must never reach the browser, so this whole exchange — and the
// actual IGDB query — happens here on the server. The client only ever
// talks to this route, never to Twitch or IGDB directly.

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('IGDB_NOT_CONFIGURED');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('TWITCH_AUTH_FAILED');
  }
  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a little before it actually expires (tokens normally last ~60 days).
  tokenExpiresAt = Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000;
  return cachedToken;
}

function coverUrl(imageId, size) {
  if (!imageId) return '';
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const token = await getAccessToken();
    const clientId = process.env.IGDB_CLIENT_ID;

    // APIcalypse query syntax — IGDB's own query language, sent as a
    // plain-text POST body rather than URL params.
    const safeQuery = q.replace(/"/g, '\\"');
    const body = `search "${safeQuery}"; fields name,cover.image_id,genres.name,platforms.name,first_release_date; limit 8;`;

    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'search_failed' }, { status: 502 });
    }

    const games = await res.json();
    const results = (games || []).map((g) => ({
      id: g.id,
      name: g.name,
      cover: coverUrl(g.cover?.image_id, 't_1080p'),
      thumb: coverUrl(g.cover?.image_id, 't_cover_big'),
      genres: (g.genres || []).map((x) => x.name),
      platforms: (g.platforms || []).map((x) => x.name),
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'not_configured' });
    }
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
