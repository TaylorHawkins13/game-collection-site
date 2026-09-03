import { fetchWithTimeout, getAccessToken } from './igdbSearch';

// Resolves a free-typed genre string (whatever's sitting in a `game` row's
// `genre` column — see supabase-schema.sql) to a real IGDB genre record,
// the exact same "search IGDB's own list, prefer an exact match, fall back
// to the top fuzzy result" pattern lib/igdbPlatformCatalogue.js already
// uses for platforms — see that file's header comment for why a live
// lookup beats a hardcoded id table (IGDB's own genre list can still add
// entries over time, same as platforms).
//
// Added Sep 2026 for the Upcoming Releases redesign (see CHANGELOG.md,
// "Upcoming Releases now recommends by genre/platform, not just exact
// franchise matches"): `genre` is a free-typed field, not IGDB-sourced —
// confirmed directly against real production data before building this
// (195/268 owned game rows have a genre value; most look auto-filled from
// IGDB's own naming ("Shooter", "Role-playing (RPG)"), but a real minority
// are hand-typed and don't match IGDB's naming at all ("FPS", "Platformer",
// "action open world") — those simply fail to resolve here and get
// silently skipped upstream (app/api/cron/refresh-upcoming-releases), the
// same "no reliable match, so skip rather than guess" outcome an
// unresolvable platform or franchise title already gets.
function igdbHeaders(token) {
  return {
    'Client-ID': process.env.IGDB_CLIENT_ID,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'text/plain',
  };
}

export async function resolveGenre(name) {
  const q = (name || '').trim();
  if (!q) return null;

  const token = await getAccessToken();
  const headers = igdbHeaders(token);
  const safeQuery = q.replace(/"/g, '\\"');
  const res = await fetchWithTimeout('https://api.igdb.com/v4/genres', {
    method: 'POST',
    headers,
    body: `search "${safeQuery}"; fields name; limit 10;`,
  });
  if (!res.ok) return null;
  const candidates = await res.json();
  if (!candidates || candidates.length === 0) return null;

  const lower = q.toLowerCase();
  const exact = candidates.find((g) => g.name?.trim().toLowerCase() === lower);
  return exact || candidates[0];
}

// In-memory cache of the full { id, name } record (not just an id — unlike
// igdbPlatformCatalogue.js's resolvePlatformId, every caller here wants the
// resolved display name too, to label the cache row it writes), same
// "cheap within a warm instance, doesn't need to survive a cold start"
// tradeoff as that file's platformIdCache — the cron's own alias table
// (upcoming_release_aliases) is what actually makes a resolved genre
// durable across cron runs, this is just there to avoid a second lookup
// for the same string within one run if it ever comes up twice.
const genreCache = new Map();

export async function resolveGenreCached(name) {
  const q = (name || '').trim();
  if (!q) return null;
  const cacheKey = q.toLowerCase();
  if (genreCache.has(cacheKey)) return genreCache.get(cacheKey);

  let resolved = null;
  try {
    resolved = await resolveGenre(q);
  } catch {
    resolved = null;
  }
  genreCache.set(cacheKey, resolved);
  return resolved;
}
