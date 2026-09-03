// Pure logic for the Upcoming Releases page (ROADMAP.md's "Pull list /
// upcoming-release calendar with spend forecasting" — shipped in the UI
// as "Upcoming Releases," see app/dashboard/upcoming-releases/page.js's
// header comment for why) — kept DB/API-agnostic and unit-testable, same
// split as lib/itemReviews.js/lib/mosaicData.js.
//
// The actual fetching lives elsewhere: lib/igdbUpcomingByInterest.js's
// getUpcomingGamesForPlatform()/getUpcomingGamesForGenre() (games) and
// lib/comicVineSeriesLookup.js's getUpcomingComicIssues() (comics),
// pre-fetched by app/api/cron/refresh-upcoming-releases into
// upcoming_release_cache. This file only shapes already-fetched entries
// for display — grouping by month and totaling up a viewer's own
// manually-entered "expected price" guesses (see
// UpcomingReleasesClient.jsx; there's no MSRP/price data available from
// either IGDB or Comic Vine for something that hasn't released yet,
// confirmed while researching this feature, so a real number here is
// unavoidably a guess someone types in, not something this app can look
// up).
//
// Games and comics are tracked differently here (Sep 2026 redesign — see
// CHANGELOG.md, "Upcoming Releases now recommends by genre/platform, not
// just exact franchise matches" — flagged directly: "i dont think it
// should be for the things logged on shelflife, i think it should check
// the api and add stuff from there," refined to "still based on your
// collection, but looser" than an exact title match): a comic is tracked
// by its exact series (buildSeriesKey below, unchanged from the original
// design — Comic Vine has no clean genre-equivalent taxonomy to broaden
// against, and comics are a small enough slice of real usage that the
// extra Comic Vine API calls broadening would cost aren't worth it right
// now — see ROADMAP.md). A game is tracked by the genres and platforms
// already showing up across someone's own collection (buildPlatformKey/
// buildGenreKey below) instead of any specific owned title — so a new
// upcoming shooter can surface because you collect shooters, even if it
// has nothing to do with any franchise you already own.

import { normalizeSeriesText } from './textNormalize';

// A stable cache key for a comic series — "comic:" prefixed so a comic
// series titled the same as a game (it happens — "Watchmen") can never
// collide in upcoming_release_cache with a game/genre/platform key below.
// Keys off the normalized `series` field (matching
// lib/seriesCrowdsource.js's existing series-matching convention) since
// that's the field the rest of the app already treats as "which run is
// this issue part of." Games no longer key off a title at all — see the
// module comment above and buildPlatformKey/buildGenreKey below.
export function buildSeriesKey(itemType, value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (itemType === 'comic') return `comic:${normalizeSeriesText(v)}`;
  return null;
}

function normalizeInterestValue(value) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Raw, as-typed keys for a game's platform/genre — resolved through
// upcoming_release_aliases to a real `game_platform:<igdb id>` /
// `game_genre:<igdb id>` cache row, exactly the same raw-key-then-alias
// indirection buildSeriesKey's comic keys already go through (see
// app/api/cron/refresh-upcoming-releases and
// app/dashboard/upcoming-releases/page.js). Needed because the same real
// platform/genre is typed inconsistently across a real collection ("PS5"
// vs "PlayStation 5" vs "Ps5" — confirmed directly against production
// data) — the raw key just captures "what was actually typed," the alias
// table is what collapses those onto one shared cache row once
// lib/igdbUpcomingByInterest.js resolves each to a real IGDB id.
export function buildPlatformKey(value) {
  const v = normalizeInterestValue(value);
  return v ? `game_platform_name:${v}` : null;
}

export function buildGenreKey(value) {
  const v = normalizeInterestValue(value);
  return v ? `game_genre_name:${v}` : null;
}

// The RESOLVED cache-row key for a game interest signal, built from the
// real IGDB id lib/igdbUpcomingByInterest.js resolved rather than the raw
// typed string — the games-side equivalent of buildSeriesKey('comic', ...)
// above, used once a platform/genre has actually been looked up
// successfully (see the cron route). `kind` is 'platform' or 'genre'.
export function buildResolvedInterestKey(kind, igdbId) {
  if (igdbId == null) return null;
  if (kind === 'platform') return `game_platform:${igdbId}`;
  if (kind === 'genre') return `game_genre:${igdbId}`;
  return null;
}

// Distinct interest signals worth resolving a cache row for, from a
// signed-in user's own rows (or, from the cron, every user's rows pooled
// together — same cross-user pooling the old title-based version already
// did). A comic keys off its exact `series` value, unchanged. A game
// contributes one entry per distinct platform in its `platforms` array
// and one per distinct genre in its (possibly comma-separated — "Shooter,
// Adventure" — see supabase-schema.sql) `genre` string, rather than one
// entry for its own title — so a 268-game collection with a handful of
// repeated platforms/genres now resolves to a much *smaller* distinct set
// than before (confirmed directly: ~25 distinct platform strings alone
// for a real 268-game account, versus 268 distinct titles previously),
// not a larger one, despite covering more of what IGDB has upcoming.
export function distinctTrackedSeries(games) {
  const seen = new Map();
  for (const g of games || []) {
    if (g.item_type === 'comic') {
      if (!g.series) continue;
      const key = buildSeriesKey('comic', g.series);
      if (key && !seen.has(key)) seen.set(key, { itemType: 'comic', kind: 'series', value: g.series, key });
      continue;
    }
    if (g.item_type !== 'game') continue;

    for (const platform of g.platforms || []) {
      const key = buildPlatformKey(platform);
      if (key && !seen.has(key)) seen.set(key, { itemType: 'game', kind: 'platform', value: platform, key });
    }

    for (const rawGenre of (g.genre || '').split(',')) {
      const genre = rawGenre.trim();
      if (!genre) continue;
      const key = buildGenreKey(genre);
      if (key && !seen.has(key)) seen.set(key, { itemType: 'game', kind: 'genre', value: genre, key });
    }
  }
  return Array.from(seen.values());
}

// Flattens every cache row's `entries` array into one list, tagged with
// which series/genre/platform each came from, filtered to genuinely
// future-dated releases (a cache row can carry past entries too — see
// the cron's own comment — so "future" is enforced here at read time,
// not just at write time, in case a cached row goes stale past someone's
// next visit), and sorted soonest-first. `referenceDate` is injectable
// for tests; defaults to now.
//
// De-dupes by entryKey (added Sep 2026 alongside the genre/platform
// redesign — see the module comment above): a comic issue can only ever
// come from one series' cache row, but a single upcoming game can now
// legitimately show up in more than one of a viewer's own cache rows at
// once — e.g. it's tagged both "PlayStation 5" and "Role-playing (RPG)",
// and the viewer's collection matches both. Rather than showing the same
// game twice, the first occurrence wins and every later duplicate's
// `series_name` gets folded into that entry's `seriesName` (comma-joined,
// de-duplicated) instead of being dropped silently — so the card still
// credits every reason it showed up.
export function flattenUpcomingEntries(cacheRows, referenceDate = new Date()) {
  const cutoff = referenceDate.getTime();
  const byKey = new Map();
  for (const row of cacheRows || []) {
    const entries = Array.isArray(row.entries) ? row.entries : [];
    for (const entry of entries) {
      if (!entry?.releaseDate) continue;
      const ts = new Date(entry.releaseDate).getTime();
      if (Number.isNaN(ts) || ts < cutoff) continue;

      // A stable per-entry key for the price-input/localStorage side —
      // combines type + the source API's own id so a game and a comic
      // issue that happen to share a numeric id never collide.
      const entryKey = `${row.item_type}:${entry.id}`;
      const existing = byKey.get(entryKey);
      if (existing) {
        if (!existing.matchedVia.includes(row.series_name)) {
          existing.matchedVia.push(row.series_name);
          existing.seriesName = existing.matchedVia.join(', ');
        }
        continue;
      }

      byKey.set(entryKey, {
        ...entry,
        itemType: row.item_type,
        seriesName: row.series_name,
        matchedVia: [row.series_name],
        releaseTs: ts,
        entryKey,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.releaseTs - b.releaseTs);
}

// Groups an already-sorted (see flattenUpcomingEntries) entry list into
// [{ monthKey: 'YYYY-MM', monthLabel: 'September 2026', entries: [...] }]
// — a plain grouped list rather than a real calendar grid, since a grid
// mostly-empty-cells layout would waste far more space than it clarifies
// for what's usually a handful of releases spread across months (same
// "don't build the fancier thing just because the feature is calendar-
// shaped" call as e.g. the notifications page choosing a plain list too).
export function groupEntriesByMonth(entries) {
  const groups = new Map();
  for (const entry of entries || []) {
    const d = new Date(entry.releaseTs);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(monthKey)) {
      const monthLabel = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
      groups.set(monthKey, { monthKey, monthLabel, entries: [] });
    }
    groups.get(monthKey).entries.push(entry);
  }
  return Array.from(groups.values());
}

// "This week" / "this month" running spend totals from a caller-supplied
// { [entryKey]: price } map of manually-entered expected prices (see
// UpcomingReleasesClient.jsx — there's no real price data to sum otherwise).
// Unpriced entries simply don't contribute, same as
// lib/valueSnapshot.js's estimateCollectionValue() only counting items
// that actually have a price.
export function computeSpendTotals(entries, expectedPrices, referenceDate = new Date()) {
  const now = referenceDate.getTime();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const monthEnd = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1)
  ).getTime();

  let thisWeek = 0;
  let thisMonth = 0;
  for (const entry of entries || []) {
    const price = parseFloat(expectedPrices?.[entry.entryKey]);
    if (!Number.isFinite(price)) continue;
    if (entry.releaseTs <= weekEnd) thisWeek += price;
    if (entry.releaseTs < monthEnd) thisMonth += price;
  }
  return {
    thisWeek: Math.round(thisWeek * 100) / 100,
    thisMonth: Math.round(thisMonth * 100) / 100,
  };
}
