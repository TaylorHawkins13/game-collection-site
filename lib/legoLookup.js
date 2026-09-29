// LEGO set auto-fill via the Rebrickable API (rebrickable.com/api) — the
// one free, live database of LEGO sets that turned up (LEGO itself has
// no public product-search API; the same discipline this codebase
// already applies to every other integration — see lib/seriesCrowdsource.js's
// module comment on the Funko Pop search that stayed blocked). Needs a
// free API key (see README for the signup steps — no cost, no paid tier
// involved), so this degrades the same way lib/igdbSearch.js/
// lib/comicVineSearch.js do when unconfigured: return
// { error: 'not_configured' } instead of throwing, so the "Search"
// button can show a clear message instead of a raw failure.
//
// Checked directly before building (Sept 2026, requested: "get [funkos
// and lego] to the best they can be"): Rebrickable's own docs/swagger
// confirm the /lego/sets/ endpoint takes a `search` query param, and its
// terms of service ("The Rebrickable API may be used for any purpose,
// including commercial" — rebrickable.com/terms/) explicitly allow this
// use, with a courtesy request (not a requirement) to credit Rebrickable
// as the source — the `searchHint` text below does that the same way
// every other search result already names its source ("Filled from
// Comic Vine…", "No matches found on MusicBrainz."). The exact Set/Theme
// object field names below (set_num, name, year, theme_id, num_parts,
// set_img_url; Theme's id/name) come from Rebrickable's long-stable,
// widely-mirrored API shape rather than a raw response this sandbox
// could fetch directly (no key configured yet to test with) — same
// "couldn't verify against live data from this sandbox" caveat
// lib/externalListings.js already carries for CeX/Amazon. Worth a real
// smoke test once REBRICKABLE_API_KEY is actually set.
//
// A set's theme comes back from Rebrickable as a bare theme_id, not a
// name, so this fetches the full theme list once (a few hundred rows,
// effectively static) and joins locally, rather than firing a per-result
// detail call — the API's own ~1 request/sec average rate limit
// wouldn't comfortably allow one extra call per each of up to 8 search
// results.

const TIMEOUT_MS = 8000;
const BASE_URL = 'https://rebrickable.com/api/v3';

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function apiKey() {
  return process.env.REBRICKABLE_API_KEY || '';
}

function authHeaders(key) {
  return { Authorization: `key ${key}`, Accept: 'application/json' };
}

// Module-scope cache — themes rarely change, and this only helps within
// one warm serverless instance (no cache shared across instances or
// survives a cold start), the same best-effort spirit as any other
// in-memory cache in a serverless environment. A failed fetch just means
// results show without a theme name filled in for this one search, not
// a broken search.
let themeCache = null;
let themeCacheAt = 0;
const THEME_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function getThemeMap(key) {
  const now = Date.now();
  if (themeCache && now - themeCacheAt < THEME_CACHE_MS) return themeCache;
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/lego/themes/?page_size=1000`, { headers: authHeaders(key) });
    if (!res.ok) return themeCache || new Map();
    const data = await res.json();
    const map = new Map((data.results || []).map((t) => [t.id, t.name]));
    themeCache = map;
    themeCacheAt = now;
    return map;
  } catch {
    return themeCache || new Map();
  }
}

export async function searchRebrickable(query) {
  const q = (query || '').trim();
  if (!q) return { results: [] };

  const key = apiKey();
  if (!key) return { error: 'not_configured' };

  try {
    const params = new URLSearchParams({ search: q, page_size: '8', ordering: '-year' });
    const [setsRes, themeMap] = await Promise.all([
      fetchWithTimeout(`${BASE_URL}/lego/sets/?${params.toString()}`, { headers: authHeaders(key) }),
      getThemeMap(key),
    ]);
    if (!setsRes.ok) return { error: 'search_failed' };
    const data = await setsRes.json();

    const results = (data.results || []).map((set) => {
      const themeName = themeMap.get(set.theme_id) || '';
      // Rebrickable suffixes every set_num with a variant number
      // ("75192-1") — the bare number before the dash is what collectors
      // actually search/list by ("LEGO 75192"), so that's what fills
      // card_number, while the full set_num (unique per variant) stays
      // the result's own id.
      const setNum = (set.set_num || '').split('-')[0];
      return {
        kind: 'lego',
        id: set.set_num,
        name: set.name,
        theme: themeName,
        setNum,
        cover: set.set_img_url || '',
        year: set.year || null,
        subtitle: [themeName, set.year ? String(set.year) : '', set.num_parts ? `${set.num_parts} pcs` : '']
          .filter(Boolean)
          .join(' · '),
      };
    });
    return { results };
  } catch {
    return { error: 'search_failed' };
  }
}
