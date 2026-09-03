import { fetchWithTimeout, getAccessToken, coverUrl } from './igdbSearch';

// Backs ROADMAP.md's "Full physical-release catalogue per console" — pick
// a platform, see every game IGDB has for it, not just what's already
// logged. Reuses lib/igdbSearch.js's timeout wrapper and Twitch token
// cache (see that file) rather than standing up a second copy of both.
//
// Shelf Life doesn't store an IGDB platform id anywhere — `platform` on a
// game is a free-typed field (see supabase-schema.sql), and there's no
// per-console item type this could be pinned to either. So every request
// re-resolves the typed platform name against IGDB's own `/platforms`
// endpoint rather than keeping a hardcoded id table that would drift out
// of sync with IGDB's own list over time.
//
// Restricted to `category = 0` (IGDB's "main_game" category). Without
// that filter a real platform's IGDB catalog is dominated by DLC,
// expansions, bundles, and other entries that were never their own
// physical release — exactly the noise a "here's every game for this
// system, check off what you've got" list doesn't want. The trade-off:
// a handful of genuinely standalone remakes/remasters/ports IGDB
// categorizes outside `main_game` won't show up here — a cleaner list
// over a fully exhaustive one.
const PAGE_SIZE_DEFAULT = 100;
const PAGE_SIZE_MAX = 500; // IGDB's own per-request ceiling.

function igdbHeaders(token) {
  return {
    'Client-ID': process.env.IGDB_CLIENT_ID,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'text/plain',
  };
}

// Resolves a free-typed platform name ("PS2", "PlayStation 2", a typo) to
// a real IGDB platform record. Prefers an exact case-insensitive match on
// the platform's name/abbreviation/alternative name over IGDB's own
// fuzzy-search ranking (same defensive pattern lib/igdbSearch.js's
// getFranchiseGames already uses for games) — falls back to IGDB's #1
// result when nothing matches exactly, so an unusual typed name still
// resolves to *something* plausible rather than a hard miss.
export async function resolvePlatform(name) {
  const q = (name || '').trim();
  if (!q) return null;

  const token = await getAccessToken();
  const headers = igdbHeaders(token);
  const safeQuery = q.replace(/"/g, '\\"');
  const res = await fetchWithTimeout('https://api.igdb.com/v4/platforms', {
    method: 'POST',
    headers,
    body: `search "${safeQuery}"; fields name,abbreviation,alternative_name; limit 10;`,
  });
  if (!res.ok) return null;
  const candidates = await res.json();
  if (!candidates || candidates.length === 0) return null;

  const lower = q.toLowerCase();
  const exact = candidates.find(
    (p) =>
      p.name?.trim().toLowerCase() === lower ||
      p.abbreviation?.trim().toLowerCase() === lower ||
      p.alternative_name?.trim().toLowerCase() === lower
  );
  return exact || candidates[0];
}

// In-memory cache for resolved platform ids, keyed by the normalized
// input string — same "cache what's expensive, keep it simple" pattern
// lib/igdbSearch.js's Twitch token cache already uses. Doesn't survive a
// cold serverless start, but cuts real repeat-lookup cost within a warm
// instance, which is the case that matters here: the same handful of
// platform strings (whatever a user's own games are logged under) get
// resolved on every /dashboard/catalogue page load.
const platformIdCache = new Map();

// Resolves a single free-typed platform string to its real IGDB platform
// id — the accuracy fix for ROADMAP.md's "the full release catalogue's
// 'owned' matching is a loose heuristic" note (flagged directly: "surely
// we can fix this so it's always accurate"). Deliberately swallows any
// failure (missing IGDB config, a transient network error) into a plain
// `null` result rather than throwing — this gets called from a server
// component (app/dashboard/catalogue/page.js) for every distinct
// platform in someone's collection on every page load, and one bad
// lookup shouldn't be able to take the whole page down.
export async function resolvePlatformId(name) {
  const q = (name || '').trim();
  if (!q) return null;
  const cacheKey = q.toLowerCase();
  if (platformIdCache.has(cacheKey)) return platformIdCache.get(cacheKey);

  let id = null;
  try {
    const resolved = await resolvePlatform(q);
    id = resolved ? resolved.id : null;
  } catch {
    id = null;
  }
  platformIdCache.set(cacheKey, id);
  return id;
}

// Resolves every distinct platform string in `names` to its IGDB
// platform id, in parallel — used once per page load in
// app/dashboard/catalogue/page.js to resolve every platform value across
// the signed-in user's whole collection, so lib/platformCatalogueMatch.js
// can compare real ids instead of free-typed names. Returns a plain
// object keyed by the exact input string (not lowercased), since that's
// how a caller will look values up against a game's own `platforms`
// array.
export async function resolvePlatformIds(names) {
  const distinct = [...new Set((names || []).map((n) => (n || '').trim()).filter(Boolean))];
  const entries = await Promise.all(distinct.map(async (name) => [name, await resolvePlatformId(name)]));
  return Object.fromEntries(entries);
}

export async function getPlatformCatalogue({ platform, offset = 0, limit = PAGE_SIZE_DEFAULT, search = '' } = {}) {
  const platformName = (platform || '').trim();
  if (!platformName) return { error: 'no_platform' };

  try {
    const resolved = await resolvePlatform(platformName);
    if (!resolved) return { error: 'platform_not_found' };

    const token = await getAccessToken();
    const headers = igdbHeaders(token);

    const safeSearch = (search || '').trim().replace(/"/g, '\\"');
    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || PAGE_SIZE_DEFAULT, 1), PAGE_SIZE_MAX);
    const cappedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    // A typed search term switches to IGDB's relevance ranking instead of
    // an alphabetical sort — same trade-off the trading-card/comic search
    // buttons already make, "most relevant match" over "next in the
    // alphabet" once someone's narrowing down a specific title.
    const ordering = safeSearch ? `search "${safeSearch}";` : 'sort name asc;';

    const queryBody = `${ordering} fields name,cover.image_id,first_release_date; where platforms = (${resolved.id}) & category = 0; limit ${cappedLimit}; offset ${cappedOffset};`;
    const res = await fetchWithTimeout('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers,
      body: queryBody,
    });
    if (!res.ok) return { error: 'query_failed' };

    const rawGames = await res.json();
    // TEMPORARY diagnostic for ROADMAP.md's "full release catalogue shows
    // 'No results' for every platform" bug — `res.ok` is true (ruling out
    // an auth/config failure) but games comes back empty even for
    // platform/game pairs known to be real (Nintendo Switch / Breath of
    // the Wild, checked directly against the live API). Logs only the
    // empty-result case so this doesn't spam normal successful requests.
    // Remove this block once the raw IGDB response has been inspected via
    // Vercel logs and the real fix is identified.
    if (!rawGames || rawGames.length === 0) {
      console.error('[catalogue-diagnostic] empty result', {
        queryBody,
        resolvedPlatform: { id: resolved.id, name: resolved.name },
        rawGamesType: Array.isArray(rawGames) ? 'array' : typeof rawGames,
        rawGamesSample: JSON.stringify(rawGames).slice(0, 500),
      });
    }
    const games = (rawGames || [])
      .filter((g) => g.name)
      .map((g) => ({
        id: g.id,
        name: g.name,
        cover: coverUrl(g.cover?.image_id, 't_cover_big'),
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      }));

    return {
      platformName: resolved.name,
      // Handed back to the client so it can pass the same id into
      // lib/platformCatalogueMatch.js's id-based ownership check instead
      // of re-deriving it from the name — see that file for why id
      // equality replaced free-typed-name comparison.
      platformId: resolved.id,
      games,
      // A full page back means there's likely more — cheaper than a
      // separate /games/count request every page, at the cost of one
      // extra empty-page fetch in the rare case a platform's count lands
      // on an exact page-size multiple.
      hasMore: games.length === cappedLimit,
    };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') return { error: 'not_configured' };
    return { error: 'query_failed' };
  }
}
