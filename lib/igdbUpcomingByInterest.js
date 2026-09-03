import { fetchWithTimeout, getAccessToken, coverUrl } from './igdbSearch';
import { resolvePlatform } from './igdbPlatformCatalogue';
import { resolveGenreCached } from './igdbGenreCatalogue';

// The games leg of the Upcoming Releases redesign (Sep 2026, see
// CHANGELOG.md) — flagged directly ("i dont think it should be for the
// things logged on shelflife, i think it should check the api and add
// stuff from there"): the original version only ever showed a franchise's
// next entry once someone owned a title IGDB could tag under that exact
// franchise (lib/igdbSearch.js's getFranchiseGames, still used elsewhere —
// see that file). Confirmed directly this should stay collection-derived,
// just looser — driven by the genres/platforms already in someone's
// collection rather than requiring an exact franchise match on a specific
// owned title. This file is the "given a genre or platform, what's
// upcoming" half of that; lib/upcomingReleases.js's distinctTrackedSeries
// is the "which genres/platforms does this collection actually touch"
// half, and app/api/cron/refresh-upcoming-releases wires the two together
// exactly the way it already wires owned titles to
// lib/igdbSearch.js/lib/comicVineSeriesLookup.js today — same cross-user
// pooled cache, same staleness/alias handling, just a different kind of
// key.
//
// Deliberately does NOT try to combine genre + platform into one narrower
// AND filter (e.g. "upcoming RPGs on PS5 specifically") — each is cached
// and matched independently, then merged and de-duplicated back on the
// read side (lib/upcomingReleases.js's flattenUpcomingEntries). A genre
// match and a platform match both surfacing the same upcoming game is a
// feature, not a bug — the merge step folds them into one entry credited
// to both.
//
// Popularity filter: IGDB's `hypes` count (people who've marked "I'm
// interested" pre-release — the field IGDB itself designed for exactly
// this "how much buzz does an unreleased game have" question, as opposed
// to `follows`/rating fields that only build up after release) stands in
// for "worth surfacing" instead of a hand-picked numeric cutoff — sorting
// by hypes and taking the top UPCOMING_LIMIT self-calibrates per genre/
// platform (a niche genre's top 20 by hype and a blockbuster genre's top
// 20 by hype are both "the most anticipated 20 this bucket currently has,"
// rather than everything clearing some fixed number that would have to be
// re-guessed as IGDB's own hype numbers drift over time) and keeps a
// platform/genre with literally nothing upcoming at real hype levels
// (most retro/discontinued platforms) from ever flooding the calendar
// with obscure filler just because it's technically "upcoming."
const UPCOMING_LIMIT = 20;

function igdbHeaders(token) {
  return {
    'Client-ID': process.env.IGDB_CLIENT_ID,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'text/plain',
  };
}

async function fetchUpcomingGamesWhere(whereClause, headers) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const body = `fields name,cover.image_id,first_release_date; where ${whereClause} & first_release_date > ${nowSeconds} & hypes != null; sort hypes desc; limit ${UPCOMING_LIMIT};`;
  const res = await fetchWithTimeout('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) return { error: 'query_failed' };

  const rawGames = await res.json();
  const entries = (rawGames || [])
    .filter((g) => g.name && g.first_release_date)
    .map((g) => ({
      id: g.id,
      name: g.name,
      cover: coverUrl(g.cover?.image_id, 't_cover_big'),
      year: new Date(g.first_release_date * 1000).getFullYear(),
      releaseDate: g.first_release_date * 1000,
    }))
    // Queried in hype order (to pick the top UPCOMING_LIMIT), but shown
    // soonest-first like everywhere else in this feature — re-sort here
    // rather than making every caller/reader remember to do it.
    .sort((a, b) => a.releaseDate - b.releaseDate);

  return { entries };
}

// Returns { id, seriesName, entries } — `id` is the resolved IGDB
// platform id (the cron uses it to build the cache row's real key, e.g.
// `game_platform:167`, so two different typed strings that resolve to the
// same platform — "PS5" and "PlayStation 5" — end up sharing one cache
// row instead of two), `seriesName` is the resolved platform's real IGDB
// name ("PlayStation 5"), not the raw typed string, same "label after
// what actually resolved" call lib/igdbSearch.js's getFranchiseGames
// already makes. `error` only means the platform name itself didn't
// resolve to anything on IGDB at all — resolving fine but having zero
// current hyped upcoming games is a real, valid empty result (entries:
// []), not an error; see the cron route for why that distinction matters
// (an empty-but-resolved result still gets cached and aliased, same as an
// empty-but-real franchise/series today).
export async function getUpcomingGamesForPlatform(rawPlatformName) {
  const q = (rawPlatformName || '').trim();
  if (!q) return { error: 'no_platform' };

  try {
    const platform = await resolvePlatform(q);
    if (!platform?.id) return { error: 'not_found' };

    const token = await getAccessToken();
    const headers = igdbHeaders(token);
    const result = await fetchUpcomingGamesWhere(`platforms = (${platform.id})`, headers);
    if (result.error) return result;

    return { id: platform.id, seriesName: platform.name || q, entries: result.entries };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') return { error: 'not_configured' };
    return { error: 'search_failed' };
  }
}

// Same contract as getUpcomingGamesForPlatform above, resolving a
// free-typed genre string via lib/igdbGenreCatalogue.js instead.
export async function getUpcomingGamesForGenre(rawGenreName) {
  const q = (rawGenreName || '').trim();
  if (!q) return { error: 'no_genre' };

  try {
    const genre = await resolveGenreCached(q);
    if (!genre?.id) return { error: 'not_found' };

    const token = await getAccessToken();
    const headers = igdbHeaders(token);
    const result = await fetchUpcomingGamesWhere(`genres = (${genre.id})`, headers);
    if (result.error) return result;

    return { id: genre.id, seriesName: genre.name || q, entries: result.entries };
  } catch (err) {
    if (err.message === 'IGDB_NOT_CONFIGURED') return { error: 'not_configured' };
    return { error: 'search_failed' };
  }
}
