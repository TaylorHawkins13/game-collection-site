// Shared IGDB search logic — used by both the client-facing
// /api/igdb-search route (GameModal's "Search" auto-fill button) and
// directly, server-side, by the collectible detail page (app/collectible/
// page.js) as a fallback when a title has no rows in `games` yet, i.e.
// nobody's added it to their shelf. Kept in one place so both call sites
// share the same Twitch token cache instead of each maintaining their own.

import { normalizeTitle } from './duplicateCheck';

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
//
// Fixed (Aug 2026 — reported live as series collections showing "far too
// many and duplicates" and some "not showing the whole series"): neither
// of the two franchise-games Apicalypse queries below specified a
// `limit`, and IGDB's documented default when one is omitted is 10 rows
// — the maximum is 500. That silently capped every real franchise (Mario,
// Zelda, GTA, Pokémon, almost anything with more than a couple platform
// re-releases) at whatever 10 rows IGDB happened to return in no
// particular order. Two knock-on effects from the same root cause: (1)
// the franchise-size comparison just below topped out at "10" for any
// franchise that actually had 10+ games, so ties between a game's
// multiple franchise tags were broken arbitrarily instead of by real
// size — an inaccurate pick; (2) the final roster fetch could land on 10
// rows dominated by several editions/re-releases of the same one or two
// titles (reads as "far too many and duplicates") while genuinely
// different games in the series never made it into that slice at all
// (reads as "doesn't show the whole series"). Both queries now ask for
// the real maximum (500 — no real game franchise has more), so the
// existing per-title dedup below is working from the actual full roster
// instead of an arbitrary 10-row sample of it.
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
      body: `search "${safeQuery}"; fields name, franchises.id, franchises.name; limit 10;`,
    });
    if (!gameRes.ok) return { error: 'search_failed' };
    const candidates = await gameRes.json();
    // IGDB's search is fuzzy-ranked, not exact-match-first — blindly
    // taking result #1 picked "Injustice: Gods Among Us" (a real DC
    // game/franchise) over the actual "Among Us" for a plain search on
    // that title, which is exactly the kind of wrong-franchise mismatch
    // that has to be avoided here. Same defensive pattern already used
    // in app/collectible/page.js: prefer an exact case-insensitive name
    // match among the candidates, only falling back to IGDB's own #1
    // ranking if nothing matches exactly.
    const game =
      (candidates || []).find((g) => g.name?.trim().toLowerCase() === q.toLowerCase()) || (candidates || [])[0] || null;
    // Not every game is tagged with a franchise on IGDB (lots of
    // one-off/indie titles genuinely have none) — that's a real "no
    // series to show" case, not a fetch failure.
    if (!game || !game.franchises || game.franchises.length === 0) {
      console.error(
        'igdb-franchise: no franchise tag on matched game',
        q,
        '-> matched:',
        game?.name ?? null,
        'candidates:',
        (candidates || []).map((c) => c.name)
      );
      return { error: 'no_franchise' };
    }
    // A game can carry more than one franchise tag; the one with the
    // most other games attached is the more useful "series" to show
    // (avoids landing on a thin secondary tag when a bigger one exists).
    //
    // Diagnostic (Aug 2026 — "Viva Piñata: Limited Edition only shows one
    // other game" reported live, right after the missing-`limit` fix
    // above): a small/short franchise like that isn't explained by the
    // 10-row cap that fix addressed, since a franchise that thin was never
    // anywhere near 10 rows in the first place. The more likely cause here
    // is upstream of this whole block — a title with "Limited Edition" (or
    // similar retail-bundle suffix) can exact-match a separate, sparser
    // IGDB entry for that specific SKU instead of the base game, and that
    // separate entry may simply carry a thinner or different franchise tag
    // than the base game's own entry does. Logging exactly what got
    // matched and picked so the next report is diagnosable from
    // production logs instead of guessed at.
    const franchiseCounts = await Promise.all(
      game.franchises.map(async (f) => {
        const res = await fetch('https://api.igdb.com/v4/franchises', {
          method: 'POST',
          headers,
          body: `fields games; where id = ${f.id}; limit 500;`,
        });
        if (!res.ok) return { ...f, count: 0 };
        const [fr] = await res.json();
        return { ...f, count: fr?.games?.length || 0 };
      })
    );
    const franchise = franchiseCounts.sort((a, b) => b.count - a.count)[0];
    if (!franchise || franchise.count === 0) {
      console.error('igdb-franchise: matched game had franchise tags but all came back empty', q, '-> matched:', game.name, 'franchises:', game.franchises);
      return { error: 'no_franchise' };
    }

    const franchiseRes = await fetch('https://api.igdb.com/v4/franchises', {
      method: 'POST',
      headers,
      body: `fields games.name, games.cover.image_id, games.first_release_date; where id = ${franchise.id}; limit 500;`,
    });
    if (!franchiseRes.ok) return { error: 'franchise_lookup_failed' };
    const [full] = await franchiseRes.json();
    console.error(
      'igdb-franchise: matched',
      q,
      '-> game:',
      game.name,
      '| picked franchise:',
      franchise.name,
      `(id ${franchise.id}, ${franchise.count} games via count-check)`,
      '| other franchise tags on this game:',
      game.franchises.filter((f) => f.id !== franchise.id).map((f) => f.name),
      '| raw games returned:',
      (full?.games || []).length
    );

    const mapped = (full?.games || [])
      .filter((g) => g.name)
      .map((g) => ({
        id: g.id,
        name: g.name,
        cover: coverUrl(g.cover?.image_id, 't_cover_big'),
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      }));

    // IGDB lists every platform/edition of a game as its own row under the
    // same franchise — "Grand Theft Auto V" shows up 3-4 times (PS3, PS4,
    // PS5, Xbox...) with the exact same name, which read as broken
    // duplicates in the UI. Collapse to one entry per normalized title,
    // preferring whichever copy has cover art, then the earliest release
    // (the original version over a later remaster/port).
    const byName = new Map();
    for (const g of mapped) {
      const key = normalizeTitle(g.name);
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, g);
        continue;
      }
      const better =
        (!existing.cover && g.cover) ||
        (!!existing.cover === !!g.cover && (g.year || 9999) < (existing.year || 9999));
      if (better) byName.set(key, g);
    }

    const games = Array.from(byName.values()).sort(
      (a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name)
    );

    return { franchiseName: franchise.name, games };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') {
      return { error: 'not_configured' };
    }
    return { error: 'search_failed' };
  }
}
