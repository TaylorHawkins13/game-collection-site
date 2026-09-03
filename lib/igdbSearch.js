// Shared IGDB search logic — used by both the client-facing
// /api/igdb-search route (GameModal's "Search" auto-fill button) and
// directly, server-side, by the collectible detail page (app/collectible/
// page.js) as a fallback when a title has no rows in `games` yet, i.e.
// nobody's added it to their shelf. Kept in one place so both call sites
// share the same Twitch token cache instead of each maintaining their own.

import { normalizeTitle } from './duplicateCheck';

// Fixed (Aug 2026 — same missing-timeout bug already fixed in book-search,
// barcode-lookup, card-search, and pokemon-master-set, see CHANGELOG.md):
// none of this file's fetch calls (the Twitch token exchange, the IGDB
// search, or any of the franchise/collection lookups) had anything
// capping how long a slow response could hang the request, so a slow
// patch on IGDB's end could stall a route until Vercel's platform-level
// 300s ceiling killed it. Every fetch below now goes through
// fetchWithTimeout instead of the raw global — see the two callers
// (app/api/igdb-search/route.js, app/api/igdb-franchise/route.js) for the
// matching maxDuration backstop.
const TIMEOUT_MS = 8000;

// Exported (Aug 2026) so lib/igdbPlatformCatalogue.js — a third IGDB call
// site, backing ROADMAP.md's "Full physical-release catalogue per
// console" — can share this exact same timeout wrapper and Twitch token
// cache instead of standing up a second, separately-authenticated copy
// of both.
export async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let cachedToken = null;
let tokenExpiresAt = 0;

export async function getAccessToken() {
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

  const res = await fetchWithTimeout(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
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

// Exported alongside the two helpers above for the same reason —
// lib/igdbPlatformCatalogue.js builds cover URLs the exact same way.
export function coverUrl(imageId, size) {
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

    const res = await fetchWithTimeout('https://api.igdb.com/v4/games', {
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
// same franchise and/or collection (e.g. searching "Grand Theft Auto V"
// surfaces the whole GTA franchise, spin-offs included). Multiple round
// trips: find the title's own franchise/collection tags first, then a
// separate lookup for every game IGDB has attached to each — IGDB's
// nested `franchises.games.*` works in one query too, but only for the
// single game just searched, not the full roster, so it has to be
// separate calls.
//
// Fixed (Aug 2026 — reported live as series collections showing "far too
// many and duplicates" and some "not showing the whole series"): neither
// of the franchise-games Apicalypse queries specified a `limit`, and
// IGDB's documented default when one is omitted is 10 rows — the maximum
// is 500. That silently capped every real franchise (Mario, Zelda, GTA,
// Pokémon, almost anything with more than a couple platform re-releases)
// at whatever 10 rows IGDB happened to return in no particular order.
// Every games-list query below now asks for the real maximum instead.
//
// Extended (Aug 2026 — "Viva Piñata: Limited Edition only shows one other
// game" reported live right after the fix above, then confirmed via the
// diagnostic logging that followed it): the `limit` fix was working
// correctly — the real problem for a case like that is IGDB's own
// `franchises` tagging simply being thin for some series (Viva Piñata's
// franchise genuinely only had 2 games attached, confirmed from
// production logs, even though the real series has at least 4), with no
// second franchise tag on the game to fall back to. IGDB separately
// exposes `collections` — a narrower, more series-specific grouping than
// `franchises` (it even deprecated the old singular `collection` field in
// favor of the current plural `collections`, i.e. IGDB itself is still
// actively investing in this being the more precise "which series is
// this game part of" tag). A game's collection tags now get merged in
// alongside its picked franchise's games, rather than only ever
// consulting `franchises`. Deliberately *not* symmetric with how
// multiple franchise tags are handled (picking a single best one, not
// merging all of them) — a franchise can span a whole loose brand
// universe, and two different franchise tags on a crossover game can be
// genuinely unrelated to each other, which is exactly the kind of
// "far too many, not really this series" clutter already fixed above.
// Collections are IGDB's narrower concept, so merging every collection
// tag in doesn't carry the same risk.
// Resolves both legs of getFranchiseGames() concurrently — see the call
// site's comment for why. Returns [franchise, franchiseGamesRaw, collectionGamesRaw].
async function resolveFranchiseAndCollections(gameFranchises, gameCollections, headers) {
  const franchiseLeg = (async () => {
    // A game can carry more than one franchise tag; the one with the most
    // other games attached is the more useful "series" to show (avoids
    // landing on a thin secondary tag when a bigger one exists).
    let franchise = null;
    if (gameFranchises.length > 0) {
      const franchiseCounts = await Promise.all(
        gameFranchises.map(async (f) => {
          const res = await fetchWithTimeout('https://api.igdb.com/v4/franchises', {
            method: 'POST',
            headers,
            body: `fields games; where id = ${f.id}; limit 500;`,
          });
          if (!res.ok) return { ...f, count: 0 };
          const [fr] = await res.json();
          return { ...f, count: fr?.games?.length || 0 };
        })
      );
      const picked = franchiseCounts.sort((a, b) => b.count - a.count)[0];
      franchise = picked && picked.count > 0 ? picked : null;
    }

    let franchiseGamesRaw = [];
    if (franchise) {
      const franchiseRes = await fetchWithTimeout('https://api.igdb.com/v4/franchises', {
        method: 'POST',
        headers,
        body: `fields games.name, games.cover.image_id, games.first_release_date; where id = ${franchise.id}; limit 500;`,
      });
      if (franchiseRes.ok) {
        const [full] = await franchiseRes.json();
        franchiseGamesRaw = full?.games || [];
      }
    }

    return [franchise, franchiseGamesRaw];
  })();

  const collectionLeg = (async () => {
    // Every collection tag gets merged in, not just the biggest one — see
    // the module comment above for why that's safe here in a way it
    // wouldn't be for franchises.
    if (gameCollections.length === 0) return [];
    const collectionResults = await Promise.all(
      gameCollections.map(async (c) => {
        const res = await fetchWithTimeout('https://api.igdb.com/v4/collections', {
          method: 'POST',
          headers,
          body: `fields games.name, games.cover.image_id, games.first_release_date; where id = ${c.id}; limit 500;`,
        });
        if (!res.ok) return [];
        const [full] = await res.json();
        return full?.games || [];
      })
    );
    return collectionResults.flat();
  })();

  const [[franchise, franchiseGamesRaw], collectionGamesRaw] = await Promise.all([franchiseLeg, collectionLeg]);
  return [franchise, franchiseGamesRaw, collectionGamesRaw];
}

// Fixed (Sep 2026 — flagged live from real refresh-upcoming-releases cron
// logs Taylor pasted: "no franchise or collection tag on matched game" for
// "MegaMan X" and "Pokemon Leaf Green"): IGDB's search is spelling-
// sensitive in ways that don't match how people actually type these
// titles. Confirmed live against production (`/api/igdb-search`):
//   - "MegaMan X" (no space, as commonly typed/stored) only matches
//     unofficial fan/ROM-hack titles on IGDB; "Mega Man X" with the space
//     finds the real 1993 SNES game.
//   - "Pokemon Leaf Green" (two words) returns zero IGDB results; IGDB's
//     own one-word convention for these version names, "Pokemon
//     LeafGreen", finds the real game.
// Returns alternate spellings worth retrying when the primary query comes
// back with nothing usable. Neither transform is guaranteed to find
// anything real — getFranchiseGames() below still runs the exact same
// exact-match-then-first-candidate selection and franchise/collection
// check against each variant, so a variant can only ever help, never
// override an already-successful match on the stored title.
export function titleVariants(title) {
  const variants = [];

  // camelCase boundary -> inserted space ("MegaMan" -> "Mega Man",
  // "PacMan" -> "Pac Man").
  const spaced = title.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  if (spaced !== title) variants.push(spaced);

  // Pokémon version names: IGDB joins the last two words of the subtitle
  // into one ("Leaf Green" -> "LeafGreen", "Fire Red" -> "FireRed").
  // Scoped tightly to "Pokemon/Pokémon <word> <word>..." (3+ words) so
  // this can't misfire on an unrelated title.
  const words = title.trim().split(/\s+/);
  if (/^pok[eé]mon$/i.test(words[0]) && words.length >= 3) {
    const merged = [...words.slice(0, -2), words.slice(-2).join('')].join(' ');
    if (merged !== title) variants.push(merged);
  }

  return variants;
}

// Runs the search-then-pick-best-candidate step for one query string —
// factored out of getFranchiseGames() so it can be tried once for the
// stored title and, if that comes back with no usable franchise/
// collection tag, retried against titleVariants()'s alternate spellings
// without duplicating the selection logic.
async function searchAndSelectCandidate(q, headers) {
  const safeQuery = q.replace(/"/g, '\\"');
  const gameRes = await fetchWithTimeout('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers,
    body: `search "${safeQuery}"; fields name, franchises.id, franchises.name, collections.id, collections.name; limit 10;`,
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
  const gameFranchises = game?.franchises || [];
  const gameCollections = game?.collections || [];
  // Not every game is tagged with a franchise or collection on IGDB
  // (lots of one-off/indie titles genuinely have neither) — that's a
  // real "no series to show" case, not a fetch failure.
  if (!game || (gameFranchises.length === 0 && gameCollections.length === 0)) {
    return { error: 'no_franchise', game, candidates };
  }
  return { game, gameFranchises, gameCollections };
}

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

    // Try the stored title first, then any alternate spellings
    // titleVariants() thinks are worth a shot — see its comment above for
    // exactly what those cover. Stops at the first one that resolves to a
    // franchise/collection-tagged game.
    const attempts = [q, ...titleVariants(q)];
    let picked = null;
    let lastOutcome = null;
    for (const attempt of attempts) {
      const outcome = await searchAndSelectCandidate(attempt, headers);
      if (outcome.error === 'search_failed') return { error: 'search_failed' };
      lastOutcome = outcome;
      if (!outcome.error) {
        picked = { ...outcome, matchedQuery: attempt };
        break;
      }
    }

    if (!picked) {
      console.error(
        'igdb-franchise: no franchise or collection tag on matched game',
        q,
        attempts.length > 1 ? `(also tried: ${attempts.slice(1).join(', ')})` : '',
        '-> matched:',
        lastOutcome?.game?.name ?? null,
        'candidates:',
        (lastOutcome?.candidates || []).map((c) => c.name)
      );
      return { error: 'no_franchise' };
    }

    const { game, gameFranchises, gameCollections, matchedQuery } = picked;
    if (matchedQuery !== q) {
      console.error('igdb-franchise: resolved via alternate spelling', q, '->', matchedQuery);
    }

    // Resolving the franchise's games and the collections' games are
    // independent of each other (neither reads the other's result), so
    // they run concurrently instead of one-after-another. Fixed (Aug
    // 2026 — flagged by inspection, not a live report): with these two
    // legs sequential, a genuinely unlucky request could chain up to 4
    // sequential 8s-timeout fetches after the initial search (franchise
    // count, franchise games, then collection games), risking the
    // route's 20s maxDuration ceiling. Running them in parallel caps the
    // worst case at whichever leg is longer — the 2-step franchise
    // lookup below — instead of the sum of both.
    const [franchise, franchiseGamesRaw, collectionGamesRaw] = await resolveFranchiseAndCollections(
      gameFranchises,
      gameCollections,
      headers
    );

    if (franchiseGamesRaw.length === 0 && collectionGamesRaw.length === 0) {
      console.error(
        'igdb-franchise: matched game had franchise/collection tags but all came back empty',
        q,
        '-> matched:',
        game.name,
        'franchises:',
        gameFranchises.map((f) => f.name),
        'collections:',
        gameCollections.map((c) => c.name)
      );
      return { error: 'no_franchise' };
    }

    // Label the series after whichever single tag actually contributed the
    // most games — franchise if it has one and it's the bigger contributor,
    // otherwise the first collection tag. Doesn't affect which games show,
    // only what the section is titled.
    const seriesName =
      franchise && franchiseGamesRaw.length >= collectionGamesRaw.length
        ? franchise.name
        : gameCollections[0]?.name || franchise?.name || q;

    console.error(
      'igdb-franchise: matched',
      q,
      '-> game:',
      game.name,
      '| picked franchise:',
      franchise?.name ?? null,
      franchise ? `(id ${franchise.id}, ${franchiseGamesRaw.length} raw games)` : '',
      '| collection tags:',
      gameCollections.map((c) => c.name),
      `(${collectionGamesRaw.length} raw games combined)`,
      '| series label used:',
      seriesName
    );

    const mapped = [...franchiseGamesRaw, ...collectionGamesRaw]
      .filter((g) => g.name)
      .map((g) => ({
        id: g.id,
        name: g.name,
        cover: coverUrl(g.cover?.image_id, 't_cover_big'),
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
        // Full timestamp alongside the display-only `year` above — added
        // Sep 2026 for the Upcoming Releases feature (app/dashboard/
        // upcoming-releases, app/api/cron/refresh-upcoming-releases),
        // which needs a real date to sort/group a calendar by, not just
        // a year. `year` is left as-is since the
        // existing "Series" section UI already renders it and has no
        // reason to change. Milliseconds (not IGDB's native seconds) to
        // match `new Date(...)`/Date.parse() elsewhere in the app,
        // including lib/upcomingReleases.js's own flattenUpcomingEntries.
        releaseDate: g.first_release_date ? g.first_release_date * 1000 : null,
      }));

    // IGDB lists every platform/edition of a game as its own row under the
    // same franchise/collection — "Grand Theft Auto V" shows up 3-4 times
    // (PS3, PS4, PS5, Xbox...) with the exact same name, which read as
    // broken duplicates in the UI. Also collapses any real overlap between
    // the franchise list and the collection list above, since a game
    // commonly belongs to both. Collapse to one entry per normalized
    // title, preferring whichever copy has cover art, then the earliest
    // release (the original version over a later remaster/port).
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

    return { franchiseName: seriesName, games };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') {
      return { error: 'not_configured' };
    }
    return { error: 'search_failed' };
  }
}
