// The comic-book "master set" backend — real per-series issue lists from
// Comic Vine (already used for comic search/auto-fill — see
// lib/comicVineSearch.js), replacing the old crowdsourced-only "See full
// series" behavior comics used to share with Funko Pops (Funko Pops stay
// on the crowdsourced path — see ROADMAP.md, no real per-line database
// available the way TCGdex/Comic Vine cover Pokémon/comics).
//
// Shape-wise this is simpler than lib/tcgdexSetLookup.js: comics don't
// have TCGdex's "variants" complication (Normal/Reverse Holo/etc. as
// separate tiles for the same card) — one entry per issue, full stop. So
// rather than pre-shaping entries for SeriesGrid the way the Pokémon
// master set does, this returns the exact same {seriesName, entries:
// [{id, cover, number, title}]} shape /api/series-lookup's crowdsourced
// response already has, and flows through the same generic
// normalizeSeriesResponse() branch in lib/seriesLookup.js — only where
// the data comes from changes, not the shape the rest of the app expects.
//
// Comic Vine paginates at a hard 100-results-per-page cap. Fetching used
// to stop after a flat 3 pages (300 issues) as a Vercel-timeout safety
// backstop — simple, but a real, known gap for the handful of
// ultra-long-running ongoing titles (Detective Comics, Action Comics, and
// similar, well past 1000 issues) that always got truncated at exactly
// 300 regardless of how much time was actually left. Paginates against a
// real time budget instead now (see DEADLINE_MS below): keeps fetching
// pages until that budget is spent, or PAGE_HARD_CAP is hit as an
// absolute backstop against a runaway loop — whichever comes first. A
// series that fits in the time budget (nearly all of them — even a
// 1000-issue run is only 10 pages) now gets its complete issue list
// instead of a fixed truncation; only a title that's both extremely
// long-running AND unusually slow to fetch page-by-page still comes back
// partial. See app/api/comic-master-set/route.js's maxDuration.
//
// Couldn't be exercised against live Comic Vine data from this sandbox
// (same network-allowlist limitation as every other external API
// integration built here) — worth a real click-through (search a real
// series, confirm the issue grid populates and a logged issue checks off
// the right tile) before trusting this fully, same caveat every other
// from-sandbox API integration in this codebase carries until confirmed
// against live data.

const USER_AGENT = 'ShelfLifeApp/1.0 (collection tracker; contact via app)';
// Leaves real headroom under the route's maxDuration=60 for the rest of
// the request (JSON serialization, response overhead) rather than
// spending the entire allowance on pagination alone.
const DEADLINE_MS = 45000;
const PAGE_HARD_CAP = 50; // 5,000 issues — a backstop, not an expected ceiling
const PAGE_SIZE = 100;

function apiKey() {
  return process.env.COMICVINE_API_KEY || '';
}

async function comicVineFetch(resource, params) {
  const key = apiKey();
  if (!key) return { error: 'not_configured' };
  try {
    const qs = new URLSearchParams({ api_key: key, format: 'json', ...params });
    const res = await fetch(`https://comicvine.gamespot.com/api/${resource}/?${qs.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return { error: 'query_failed' };
    const data = await res.json();
    if (data.status_code !== 1) return { error: 'query_failed' };
    return { data };
  } catch {
    return { error: 'query_failed' };
  }
}

// Comic Vine's `filter=name:<value>` is a "starts with" match, not exact
// — same free-typed-field tolerance TCGdex's findSetIdByName needs:
// prefer a real case-insensitive exact match (what you get when the
// series field was filled in via the comic Search button, since that
// copies Comic Vine's own volume name verbatim) and otherwise fall back
// to whichever match has the most issues, since the most substantial/
// well-known run is the most likely real match for a free-typed name
// (a franchise often has several same-named volumes across different
// reboots/eras — the long-running one is usually what "the series" means
// day to day).
async function findVolumeByName(name) {
  const clean = (name || '').trim();
  if (!clean) return { error: 'no_series' };
  const result = await comicVineFetch('volumes', {
    filter: `name:${clean}`,
    field_list: 'id,name,count_of_issues',
    sort: 'count_of_issues:desc',
    limit: '10',
  });
  if (result.error) return result;
  const results = result.data?.results || [];
  if (!results.length) return { error: 'no_series' };
  const exact = results.find((v) => (v?.name || '').trim().toLowerCase() === clean.toLowerCase());
  const chosen = exact || results[0];
  return chosen?.id ? { volume: chosen } : { error: 'no_series' };
}

// Returns { seriesName, entries } where each entry is { id, cover,
// number, title } — see the module comment above for why this
// deliberately matches /api/series-lookup's shape instead of inventing
// its own.
export async function getComicMasterSetEntries(seriesName) {
  const found = await findVolumeByName(seriesName);
  if (found.error) return { error: found.error };
  const volumeId = found.volume.id;

  const startedAt = Date.now();
  const issues = [];
  for (let page = 0; page < PAGE_HARD_CAP; page++) {
    if (page > 0 && Date.now() - startedAt > DEADLINE_MS) break;
    const result = await comicVineFetch('issues', {
      filter: `volume:${volumeId}`,
      field_list: 'id,issue_number,name,image',
      sort: 'issue_number:asc',
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (result.error) {
      // A failure on the very first page means the whole lookup failed —
      // nothing to show. A failure on a later page still leaves whatever
      // was already fetched, which is more useful than throwing away a
      // partial-but-real issue list over one bad page.
      if (page === 0) return { error: result.error };
      break;
    }
    const pageResults = result.data?.results || [];
    issues.push(...pageResults);
    if (pageResults.length < PAGE_SIZE) break; // last page reached
  }

  if (!issues.length) return { error: 'no_series' };

  const entries = issues
    .filter((issue) => issue?.issue_number != null && issue.issue_number !== '')
    .map((issue) => ({
      id: issue.id,
      cover: issue.image?.small_url || issue.image?.medium_url || '',
      number: issue.issue_number,
      title: issue.name || '',
    }));

  if (!entries.length) return { error: 'no_series' };
  return { seriesName: found.volume.name, entries };
}
