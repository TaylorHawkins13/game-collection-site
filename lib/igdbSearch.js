// Shared IGDB search logic — used by both the client-facing
// /api/igdb-search route (GameModal's "Search" auto-fill button) and
// directly, server-side, by the collectible detail page (app/collectible/
// page.js) as a fallback when a title has no rows in `games` yet, i.e.
// nobody's added it to their shelf. Kept in one place so both call sites
// share the same Twitch token cache instead of each maintaining their own.

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

export async function searchIgdb(query) {
  const q = (query || '').trim();
  if (!q) return { results: [] };

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
      return { error: 'search_failed' };
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

    return { results };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') {
      return { error: 'not_configured' };
    }
    return { error: 'search_failed' };
  }
}

// Powers the "Series" section in GameModal — given a title already in
// someone's collection, finds every other game IGDB has tagged under the
// same franchise (e.g. searching "Grand Theft Auto V" surfaces the whole
// GTA franchise, spin-offs included). Two queries: find the title's own
// franchise id first, then a separate lookup for every game IGDB has
// attached to that franchise id — IGDB's nested `franchises.games.*`
// works in one query too, but only for the single game just searched,
// not the full franchise roster, so it has to be two round-trips.
export async function getFranchiseGames(title) {
  const q = (title || '').trim();
  if (!q) return { error: 'no_title' };

  try {
    const token = await getAccessToken();
    const clientId = process.env.IGDB_CLIENT_ID;
    const headers = {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    };

    const safeQuery = q.replace(/"/g, '\\"');
    const gameRes = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers,
      body: `search "${safeQuery}"; fields name, franchises.id, franchises.name; limit 1;`,
    });
    if (!gameRes.ok) return { error: 'search_failed' };
    const [game] = await gameRes.json();
    // Not every game is tagged with a franchise on IGDB (lots of
    // one-off/indie titles genuinely have none) — that's a real "no
    // series to show" case, not a fetch failure.
    if (!game || !game.franchises || game.franchises.length === 0) {
      return { error: 'no_franchise' };
    }
    // A game can carry more than one franchise tag; the one with the
    // most other games attached is the more useful "series" to show
    // (avoids landing on a thin secondary tag when a bigger one exists).
    const franchiseCounts = await Promise.all(
      game.franchises.map(async (f) => {
        const res = await fetch('https://api.igdb.com/v4/franchises', {
          method: 'POST',
          headers,
          body: `fields games; where id = ${f.id};`,
        });
        if (!res.ok) return { ...f, count: 0 };
        const [fr] = await res.json();
        return { ...f, count: fr?.games?.length || 0 };
      })
    );
    const franchise = franchiseCounts.sort((a, b) => b.count - a.count)[0];
    if (!franchise || franchise.count === 0) return { error: 'no_franchise' };

    const franchiseRes = await fetch('https://api.igdb.com/v4/franchises', {
      method: 'POST',
      headers,
      body: `fields games.name, games.cover.image_id, games.first_release_date; where id = ${franchise.id};`,
    });
    if (!franchiseRes.ok) return { error: 'franchise_lookup_failed' };
    const [full] = await franchiseRes.json();

    const games = (full?.games || [])
      .filter((g) => g.name)
      .map((g) => ({
        id: g.id,
        name: g.name,
        cover: coverUrl(g.cover?.image_id, 't_cover_big'),
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      }))
      .sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name));

    return { franchiseName: franchise.name, games };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') {
      return { error: 'not_configured' };
    }
    return { error: 'search_failed' };
  }
}
