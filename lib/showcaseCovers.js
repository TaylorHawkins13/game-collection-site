// Server-side helpers for the home page's hero showcase: fetch a real
// cover photo for the fallback game/book slots, via the exact same free
// APIs the app's own "Search" buttons already use (see
// app/api/igdb-search and app/api/book-search). Kept as separate, minimal
// copies here rather than shared with those routes, so a change to one
// can never accidentally break the other. Only ever called for whichever
// slot(s) don't already have a real item from an actual public
// collection — see app/page.js.
//
// There used to be a third helper here, fetchPokemonCardCover(), which
// pulled a real Charizard card (real art, real "Pokémon" publisher text)
// into the hero's trading-card demo slot. Apple rejected the 1.0
// resubmission under Guideline 4.1(a) (Copycats) specifically over
// Pokémon references in the app's screenshots — this hero is the most
// likely source, since it's the first thing a signed-out screenshot of
// the app would show. Removed rather than swapped for a different real
// card game's art (Magic, Yu-Gi-Oh, etc. — same category of risk, just
// a different trademark holder); the trading-card demo slot in
// app/page.js now uses fully generic, non-branded placeholder text and
// no fetched image instead. See CHANGELOG.md.

let cachedIgdbToken = null;
let igdbTokenExpiresAt = 0;

async function getIgdbToken() {
  if (cachedIgdbToken && Date.now() < igdbTokenExpiresAt) return cachedIgdbToken;
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, { method: 'POST' });
  if (!res.ok) return null;
  const data = await res.json();
  cachedIgdbToken = data.access_token;
  igdbTokenExpiresAt = Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000;
  return cachedIgdbToken;
}

export async function fetchIgdbCover(title) {
  try {
    const token = await getIgdbToken();
    if (!token) return null;
    const safeQuery = title.replace(/"/g, '\\"');
    const body = `search "${safeQuery}"; fields cover.image_id; limit 1;`;
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      },
      body,
    });
    if (!res.ok) return null;
    const games = await res.json();
    const imageId = games?.[0]?.cover?.image_id;
    return imageId ? `https://images.igdb.com/igdb/image/upload/t_1080p/${imageId}.jpg` : null;
  } catch {
    return null;
  }
}

export async function fetchOpenLibraryCover(title) {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1&fields=cover_i`,
      { headers: { 'User-Agent': 'ShelfLifeApp/1.0 (collection tracker; contact via app)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const coverId = data?.docs?.[0]?.cover_i;
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
  } catch {
    return null;
  }
}
