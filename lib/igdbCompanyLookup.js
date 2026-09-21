// Games company lookup — the backend for the third and final Creator/
// contributor page (ROADMAP.md — "Games, via developer/publisher rather
// than an individual person," the strongest remaining candidate once
// Comics and Books both shipped). "Developer" here means a studio, not a
// person: IGDB's `companies` resource and its per-game `involved_companies`
// join (with real `developer`/`publisher`/`porting`/`supporting` role
// flags) is what backs this, the same real per-entity source
// lib/igdbPlatformCatalogue.js already leans on for the Full release
// catalogue — not a new API, a new query shape against one already wired
// up (see lib/igdbSearch.js for the shared Twitch token cache/timeout
// wrapper both reuse).
//
// Two real requests, not one, same shape lib/comicVineCreatorLookup.js
// and lib/openLibraryAuthorLookup.js already use for their own creator
// backends: IGDB's `involved_companies` join objects only carry a `game`
// id, no name/cover of their own, so getting a real coverable grid takes
// a first pass over `involved_companies` (which games this company
// touched, as developer or publisher specifically — porting/supporting
// credits are deliberately excluded, since ROADMAP.md's own framing of
// this entry names only "developer/publisher") to collect game ids, then
// a second batched pass over `/games` for the real title/cover/date rows.
// Chose this two-request shape over a single query filtered on the nested
// `involved_companies.company`/`involved_companies.developer` path
// (which IGDB's Apicalypse language may well also support) specifically
// because every existing creator-backend module in this codebase already
// uses the same two-plain-flat-filters approach and it's been verified to
// work end to end for both of them — a compound nested filter here would
// be a genuinely new, unverified query shape to introduce with no way to
// test it live from this sandbox, where the simpler two-step version at
// least only relies on filter forms (`where company = X;`, `where id =
// (a,b,c);`) already proven out elsewhere in this same codebase.
//
// Deliberately does NOT filter on IGDB's `category` field (main_game/dlc/
// bundle/etc.) — lib/igdbPlatformCatalogue.js already tried filtering a
// similarly broad, non-franchise game list by category and had to remove
// it entirely (see that file's own comment and CHANGELOG.md): real
// production IGDB data showed plenty of legitimate games with no
// `category` value set at all, not `0`, so any category filter silently
// hid real titles. This carries that same finding over by analogy rather
// than independently re-verifying it for company-scoped lists — flagging
// that honestly, since it hasn't been checked against live data from this
// sandbox any more than the rest of this file has.
//
// Couldn't be exercised against live IGDB data from this sandbox — same
// network-allowlist limitation every external API integration in this
// codebase carries until confirmed against live data; worth a real search
// (try a well-known, prolific developer or publisher) before trusting
// this fully, same caveat lib/openLibraryAuthorLookup.js and
// lib/comicVineCreatorLookup.js both already carry for their own creator
// backends.

import { fetchWithTimeout, getAccessToken, coverUrl } from './igdbSearch';

const DEADLINE_MS = 45000; // Same real-time-budget backstop lib/comicVineCreatorLookup.js uses.
const PAGE_SIZE = 500; // IGDB's own per-request ceiling (same constant lib/igdbPlatformCatalogue.js uses).
const GAME_HARD_CAP = 3000; // A backstop against a truly massive publisher (EA, Nintendo, Ubisoft), not an expected ceiling.
const SEARCH_LIMIT = 10; // Matches lib/comicVineCreatorLookup.js's own creator-search cap.

function igdbHeaders(token) {
  return {
    'Client-ID': process.env.IGDB_CLIENT_ID,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'text/plain',
  };
}

async function igdbFetch(resource, body) {
  const token = await getAccessToken(); // throws IGDB_NOT_CONFIGURED if IGDB_CLIENT_ID/SECRET are unset.
  const res = await fetchWithTimeout(`https://api.igdb.com/v4/${resource}`, {
    method: 'POST',
    headers: igdbHeaders(token),
    body,
  });
  if (!res.ok) throw new Error('QUERY_FAILED');
  return res.json();
}

// Typeahead behind /creator/games' search box. Unlike Books
// (getAuthorBibliography resolves a plain name in one call, no
// disambiguation needed), company names genuinely collide in IGDB's own
// data — regional subsidiaries and rebrands of the same real-world studio
// often exist as separate company records with near-identical names — so
// this follows Comics' search-then-pick shape rather than Books' resolve-
// by-name-directly one, same reasoning, different underlying cause.
export async function searchCompanies(query) {
  const clean = (query || '').trim();
  if (!clean) return { items: [] };
  try {
    const safe = clean.replace(/"/g, '\\"');
    const results = await igdbFetch('companies', `search "${safe}"; fields name,logo.image_id; limit ${SEARCH_LIMIT};`);
    const items = (results || [])
      .filter((c) => c?.id && c?.name)
      .map((c) => ({ id: c.id, name: c.name, logo: coverUrl(c.logo?.image_id, 't_thumb') }));
    return { items };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') return { error: 'not_configured' };
    return { error: 'query_failed' };
  }
}

// Returns { companyName, logo, games, truncated } for one company —
// `games` entries are { id, name, cover, year }, the exact same shape
// lib/igdbSearch.js's getFranchiseGames() already produces, so
// lib/seriesLookup.js's normalizeSeriesResponse('game', ...) handles this
// with zero changes (just renaming `companyName` to the `franchiseName`
// key it expects at the call site — see app/creator/games/[id]/page.js).
export async function getCompanyGames(companyId) {
  const id = String(companyId || '').trim();
  if (!id || !/^\d+$/.test(id)) return { error: 'no_company' };

  try {
    const companyResults = await igdbFetch('companies', `fields name,logo.image_id; where id = ${id};`);
    const company = companyResults?.[0];
    if (!company?.name) return { error: 'no_company' };

    // Pass 1: every game id this company is credited on as developer or
    // publisher (`company` is a single scalar reference on each
    // involved_companies row, not a list field, so a plain equality
    // filter is correct here — unlike the parenthesized "one of these"
    // form used for `id` below).
    const startedAt = Date.now();
    let stoppedEarly = false;
    const gameIds = [];
    let offset = 0;
    for (;;) {
      if (offset > 0 && Date.now() - startedAt > DEADLINE_MS) {
        stoppedEarly = true;
        break;
      }
      const batch = await igdbFetch(
        'involved_companies',
        `fields game; where (company = ${id}) & (developer = true | publisher = true); limit ${PAGE_SIZE}; offset ${offset};`
      );
      const ids = (batch || []).map((r) => r.game).filter(Boolean);
      gameIds.push(...ids);
      if (ids.length < PAGE_SIZE || gameIds.length >= GAME_HARD_CAP) break;
      offset += PAGE_SIZE;
    }
    const cappedIds = [...new Set(gameIds)].slice(0, GAME_HARD_CAP);

    const logo = coverUrl(company.logo?.image_id, 't_thumb');
    if (!cappedIds.length) {
      return { companyName: company.name, logo, games: [], truncated: false };
    }

    // Pass 2: the real title/cover/date rows for those ids, batched —
    // same shape comicVineCreatorLookup.js's issue batch-fetch uses, just
    // against IGDB's own "id = (a,b,c)" set-membership filter instead of
    // Comic Vine's "filter=id:a|b|c".
    const gamesById = new Map();
    for (let i = 0; i < cappedIds.length; i += PAGE_SIZE) {
      if (i > 0 && Date.now() - startedAt > DEADLINE_MS) {
        stoppedEarly = true;
        break;
      }
      const idBatch = cappedIds.slice(i, i + PAGE_SIZE);
      const rows = await igdbFetch(
        'games',
        `fields name,cover.image_id,first_release_date; where id = (${idBatch.join(',')}); limit ${PAGE_SIZE};`
      );
      for (const g of rows || []) {
        if (g?.id) gamesById.set(g.id, g);
      }
    }

    const games = Array.from(gamesById.values())
      .filter((g) => g.name)
      .map((g) => ({
        id: g.id,
        name: g.name,
        cover: coverUrl(g.cover?.image_id, 't_cover_big'),
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      }))
      .sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name));

    return {
      companyName: company.name,
      logo,
      games,
      truncated: stoppedEarly || gameIds.length > cappedIds.length || gamesById.size < cappedIds.length,
    };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') return { error: 'not_configured' };
    return { error: 'query_failed' };
  }
}
