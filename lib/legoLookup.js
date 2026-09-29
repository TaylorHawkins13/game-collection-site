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

// Minifigure auto-fill (Sept 2026, requested: "anything else we can
// improve for funkos or lego" -> "Auto-fill Minifigures"). A set's
// included minifigs aren't on the /lego/sets/ search result at all —
// Rebrickable only exposes them on a separate, per-set endpoint
// (`/lego/sets/{set_num}/minifigs/`), so this is a second, on-demand
// call — mirrors lib/comicVineSearch.js's two-step search-then-detail
// split (initial search stays cheap; the extra fetch only happens once
// someone actually clicks a result, not for every row in the list).
//
// The response shape was initially assumed from a secondary source
// (Microsoft Learn's Rebrickable connector reference, since the real
// Swagger UI is JS-rendered and couldn't be fetched from the sandbox
// this was first built in) — that source claimed a nested
// `results[].minifig.{name,set_num}` shape. Wrong: live-tested against a
// real set (71043 Hogwarts Castle) once REBRICKABLE_API_KEY was actually
// configured, and each result object is flat —
// `{id, set_num, set_name, quantity, set_img_url}`, with the minifig's
// own Rebrickable fig number in `set_num` ("fig-006175") and its real
// name in `set_name`. The nested-shape assumption silently produced zero
// usable minifigs for every set (each mapped entry had an empty name,
// filtered straight out) rather than throwing, so this shipped once
// already before the bug was caught by an actual click-through — fixed
// here from a genuine raw API response, not guessed a second time.
//
// `set_num` (the parameter to this function) needs the full Rebrickable
// set id including its "-1" variant suffix (e.g. "75192-1") — the same
// value searchRebrickable's own `id` field already carries, as opposed to
// the bare `setNum` used for card_number. Each result's quantity>1 means
// more than one copy of that exact minifig ships in the set (e.g. two
// Stormtroopers).
export async function fetchLegoMinifigs(setNum) {
  const num = (setNum || '').trim();
  if (!num) return { minifigs: [] };

  const key = apiKey();
  if (!key) return { error: 'not_configured' };

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/lego/sets/${encodeURIComponent(num)}/minifigs/?page_size=100`, {
      headers: authHeaders(key),
    });
    if (!res.ok) return { error: 'query_failed' };
    const data = await res.json();
    const minifigs = (data.results || [])
      .map((r) => ({ name: r.set_name || '', quantity: r.quantity || 1 }))
      .filter((m) => m.name);
    return { minifigs };
  } catch {
    return { error: 'query_failed' };
  }
}

// The LEGO "master set" backend (Sept 2026, requested alongside minifig
// auto-fill: "Real master-set browse by Theme"). Unlike trading
// cards/comics, a LEGO "set" isn't numbered within its theme the way a
// card is numbered within a set or an issue within a series — a theme is
// just every set Rebrickable has ever tagged with that theme_id, so this
// is shape-wise closest to lib/comicVineSeriesLookup.js's comic master
// set: one entry per set, no variant/finish complication at all, and it
// returns the exact same {seriesName, entries: [{id, cover, number,
// title}]} shape /api/series-lookup's crowdsourced response already has,
// so it flows through the same generic normalizeSeriesResponse() branch
// in lib/seriesLookup.js rather than needing its own SeriesGrid-shaping
// (contrast lib/tcgdexSetLookup.js/lib/scryfallSetLookup.js, which fan a
// single card out into several variant tiles and so pre-shape their own
// entries).
//
// `themeValue` is whatever's in card_set (Theme) — free-typed, or filled
// in from a real Rebrickable theme name via the Search button, so it's
// matched the same "exact case-insensitive match preferred, otherwise the
// first theme whose name contains it" tolerance every other master-set
// lookup in this codebase uses for a free-typed field (see
// findSetIdByName in lib/tcgdexSetLookup.js, findMtgSetByName in
// lib/scryfallSetLookup.js). Reuses getThemeMap's cached id->name lookup
// rather than a separate theme fetch.
//
// Known gap, worth being upfront about: Rebrickable's theme system has
// parent/child themes (e.g. "Star Wars" as a parent, with "Star Wars
// Episode 4/5/6" etc. as its own child theme_ids underneath) — a set only
// ever carries its own most-specific theme_id, not every ancestor. This
// only browses the exact theme name matched, not that theme's
// sub-themes too, so a set filed under a child theme won't show up when
// browsing the parent's name even though a collector might reasonably
// think of it as part of the broader line. Same tradeoff every other
// free-text-matched master-set lookup here already makes (see the modules
// named above) rather than a silent scope creep into building a full
// theme-hierarchy browser.
const LEGO_PAGE_SIZE = 1000; // Rebrickable's own page_size ceiling, same as getThemeMap already uses
const LEGO_PAGE_HARD_CAP = 10; // 10,000 sets — a backstop against a runaway loop, not an expected ceiling
const LEGO_DEADLINE_MS = 20000; // leaves headroom under the route's own maxDuration, same spirit as comicVineSeriesLookup.js's DEADLINE_MS

export async function getLegoMasterSetEntries(themeValue) {
  const clean = (themeValue || '').trim();
  if (!clean) return { error: 'no_series' };

  const key = apiKey();
  if (!key) return { error: 'not_configured' };

  const themeMap = await getThemeMap(key);
  const target = clean.toLowerCase();
  let themeId = null;
  let themeName = null;
  for (const [id, name] of themeMap.entries()) {
    if ((name || '').trim().toLowerCase() === target) {
      themeId = id;
      themeName = name;
      break;
    }
  }
  if (themeId == null) {
    for (const [id, name] of themeMap.entries()) {
      if ((name || '').trim().toLowerCase().includes(target)) {
        themeId = id;
        themeName = name;
        break;
      }
    }
  }
  if (themeId == null) return { error: 'no_series' };

  const sets = [];
  let url = `${BASE_URL}/lego/sets/?theme_id=${themeId}&page_size=${LEGO_PAGE_SIZE}&ordering=-year`;
  const startedAt = Date.now();
  for (let page = 0; url && page < LEGO_PAGE_HARD_CAP; page++) {
    if (page > 0 && Date.now() - startedAt > LEGO_DEADLINE_MS) break;
    let res;
    try {
      res = await fetchWithTimeout(url, { headers: authHeaders(key) });
    } catch {
      break;
    }
    if (!res.ok) {
      if (page === 0) return { error: 'query_failed' };
      break;
    }
    let data;
    try {
      data = await res.json();
    } catch {
      break;
    }
    sets.push(...(data.results || []));
    url = data.next || null;
  }
  if (!sets.length) return { error: 'no_series' };

  // Rebrickable can list more than one release under the same base set
  // number within a theme (a re-release, a regional variant) — same "same
  // number, logged twice" shape lib/comicVineSeriesLookup.js's own
  // byNumber dedup already handles for Comic Vine's volume/issue data,
  // reused here rather than reinvented: one tile per bare set number,
  // preferring whichever copy actually has cover art.
  const byNumber = new Map();
  for (const set of sets) {
    const bareNum = (set.set_num || '').split('-')[0];
    if (!bareNum) continue;
    const entry = { id: set.set_num, cover: set.set_img_url || '', number: bareNum, title: set.name || '' };
    const existing = byNumber.get(bareNum);
    if (!existing || (!existing.cover && entry.cover)) {
      byNumber.set(bareNum, entry);
    }
  }

  const entries = Array.from(byNumber.values());
  if (!entries.length) return { error: 'no_series' };
  return { seriesName: themeName, entries };
}
