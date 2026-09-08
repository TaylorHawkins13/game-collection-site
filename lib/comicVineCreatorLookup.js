// Comic creator lookup — the backend for public "Creator pages"
// (ROADMAP.md's "Creator/contributor pages... browse everything by an
// author, artist, developer, director" — comics first per that entry's
// own feasibility note: Comic Vine's real `person` resource is the only
// creator-credit source integrated in this app with genuine issue-level
// data, not just a free-typed writer/artist string).
//
// Comic Vine's person resource only ever returns bare-stub issue credits
// on its own `issue_credits` field — id/name/api_detail_url, confirmed
// against the API docs and Comic Vine's own community forum threads: no
// issue_number, no cover image on that field at all, the most stripped-
// down of any embedded list this API returns anywhere. So getting a real,
// coverable grid takes two real requests, not one: first the person's
// issue_credits stub list, then a second batch fetch of the real issue
// rows (cover/issue_number/volume) for those same ids. Comic Vine's
// `filter=id:a|b|c` accepts a pipe-separated OR list (confirmed via an
// official Comic Vine changelog thread), so this batches up to 100 ids
// per request rather than one request per issue — same shape
// getComicMasterSetEntries (lib/comicVineSeriesLookup.js) already uses
// for one volume's issues, just filtered by id instead of by volume.
//
// Same real-time-budget pagination posture getComicMasterSetEntries
// already uses: a truly prolific creator (decades of monthly output
// across many titles) could have thousands of credits, and nothing in
// Comic Vine's docs states a cap on the embedded issue_credits list
// itself — DEADLINE_MS/ISSUE_HARD_CAP below are a defensive backstop
// against that unconfirmed risk, not an expected ceiling for a normal
// creator.
//
// Couldn't be exercised against live Comic Vine data from this sandbox —
// same network-allowlist caveat every external API integration in this
// codebase carries until confirmed against live data; worth a real
// search (try a well-known, prolific writer or artist) before trusting
// this fully.

const USER_AGENT = 'ShelfLifeApp/1.0 (collection tracker; contact via app)';
const TIMEOUT_MS = 8000;
// Leaves real headroom under the route's maxDuration for response
// overhead, same reasoning DEADLINE_MS carries in comicVineSeriesLookup.js.
const DEADLINE_MS = 45000;
const ISSUE_BATCH_SIZE = 100; // Comic Vine's own per-request cap on list resources
const ISSUE_HARD_CAP = 3000; // 30 batches — a backstop, not an expected ceiling
const SEARCH_LIMIT = 8; // Comic Vine's /search endpoint caps at 10 regardless of what's asked for
// Comic Vine's own id prefix for the `person` resource in its {prefix}-{id}
// detail-object URLs — a fixed, documented convention of theirs (same
// family as issue's 4000 and volume's 4050, already relied on in
// lib/comicVineSearch.js), not something this app invents.
const PERSON_ID_PREFIX = '4040';

function apiKey() {
  return process.env.COMICVINE_API_KEY || '';
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function comicVineFetch(resource, params) {
  const key = apiKey();
  if (!key) return { error: 'not_configured' };
  try {
    const qs = new URLSearchParams({ api_key: key, format: 'json', ...params });
    const res = await fetchWithTimeout(`https://comicvine.gamespot.com/api/${resource}/?${qs.toString()}`, {
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

// Plain lowercase/punctuation-stripped normalization, same rule
// lib/duplicateCheck.js's normalizeTitle applies — inlined rather than
// imported so this file has no dependency on client-only modules (it
// runs from a public, server-rendered route). Series name + issue number
// together, not issue number alone: a creator's body of work spans many
// unrelated series, so "issue #1" on its own would collide across every
// series they've ever worked on (see components/CreatorWorksGrid usage
// notes in the page that calls this).
function normalize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function creatorMatchKey(series, number) {
  return `${normalize(series)}::${normalize(number)}`;
}

// Search for a creator by (partial) name — the typeahead behind
// /creator/comics's search box. Comic Vine's own /search resource caps
// at 10 regardless of the limit requested.
export async function searchComicCreators(query) {
  const clean = (query || '').trim();
  if (!clean) return { items: [] };
  const result = await comicVineFetch('search', {
    resources: 'person',
    query: clean,
    field_list: 'id,name,image,count_of_issue_appearances',
    limit: String(SEARCH_LIMIT),
  });
  if (result.error) return result;
  const items = (result.data?.results || [])
    .filter((p) => p?.id && p?.name)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image?.thumb_url || p.image?.small_url || '',
      issueCount: p.count_of_issue_appearances || 0,
    }));
  return { items };
}

// Returns { name, image, entries, truncated } for one creator — entries
// are { id, cover, label, series, number, matchKey }, deliberately the
// same shape normalizeSeriesResponse() produces for a single-series
// master set (lib/seriesLookup.js) so SeriesGrid can render this exactly
// as-is with zero changes: `label` already reads "Series #N" per entry
// (a single-series master set's entries don't need the series name
// repeated in their own label the way these do, since one whole grid is
// already one series there — this grid spans many). `truncated` is best-
// effort honesty, not a precise count: true whenever ISSUE_HARD_CAP or
// DEADLINE_MS cut the fetch short, so the page can say "may not show
// every credit" rather than implying completeness it can't back up.
export async function getComicCreatorWorks(personId) {
  const id = String(personId || '').trim();
  if (!id) return { error: 'no_creator' };

  const personResult = await comicVineFetch(`person/${PERSON_ID_PREFIX}-${id}`, {
    field_list: 'name,image,issue_credits',
  });
  if (personResult.error) return personResult;
  const person = personResult.data?.results;
  if (!person?.name) return { error: 'no_creator' };

  const allStubs = (person.issue_credits || []).filter((s) => s?.id);
  const stubs = allStubs.slice(0, ISSUE_HARD_CAP);
  if (!stubs.length) {
    return { name: person.name, image: person.image?.small_url || '', entries: [], truncated: false };
  }

  const startedAt = Date.now();
  const issuesById = new Map();
  let stoppedEarly = false;
  for (let i = 0; i < stubs.length; i += ISSUE_BATCH_SIZE) {
    if (i > 0 && Date.now() - startedAt > DEADLINE_MS) {
      stoppedEarly = true;
      break;
    }
    const batch = stubs.slice(i, i + ISSUE_BATCH_SIZE);
    const result = await comicVineFetch('issues', {
      filter: `id:${batch.map((s) => s.id).join('|')}`,
      field_list: 'id,issue_number,name,image,volume',
      limit: String(ISSUE_BATCH_SIZE),
    });
    if (result.error) {
      // A failure on the very first batch means the whole lookup failed —
      // nothing to show. A failure partway through still leaves whatever
      // was already fetched, same "partial is better than nothing"
      // reasoning getComicMasterSetEntries already applies.
      if (i === 0) return result;
      stoppedEarly = true;
      break;
    }
    for (const issue of result.data?.results || []) {
      issuesById.set(issue.id, issue);
    }
  }

  const entries = [];
  for (const stub of stubs) {
    const issue = issuesById.get(stub.id);
    if (!issue || issue.issue_number == null || issue.issue_number === '') continue;
    const seriesName = issue.volume?.name || '';
    const number = issue.issue_number;
    entries.push({
      id: issue.id,
      cover: issue.image?.small_url || issue.image?.medium_url || '',
      label: seriesName ? `${seriesName} #${number}` : issue.name || `#${number}`,
      series: seriesName,
      number,
      matchKey: creatorMatchKey(seriesName, number),
    });
  }

  // Grouped by series then issue number for a coherent, browsable grid,
  // rather than whatever order the stub list happened to return in
  // (spot-checked as roughly chronological across a creator's whole
  // career, not documented as guaranteed) — reads far better sorted by
  // title than shuffled across everything a creator's ever touched.
  entries.sort((a, b) => {
    if (a.series !== b.series) return a.series.localeCompare(b.series);
    const na = parseFloat(a.number);
    const nb = parseFloat(b.number);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return String(a.number).localeCompare(String(b.number));
  });

  return {
    name: person.name,
    image: person.image?.small_url || '',
    entries,
    truncated: stoppedEarly || allStubs.length > stubs.length || issuesById.size < stubs.length,
  };
}
