// Pure logic for the Upcoming Releases page (ROADMAP.md's "Pull list /
// upcoming-release calendar with spend forecasting" — shipped in the UI
// as "Upcoming Releases," see app/dashboard/upcoming-releases/page.js's
// header comment for why) — kept DB/API-agnostic and unit-testable, same
// split as lib/itemReviews.js/lib/mosaicData.js.
//
// The actual fetching lives elsewhere: lib/igdbSearch.js's
// getFranchiseGames() (games) and lib/comicVineSeriesLookup.js's new
// getUpcomingComicIssues() (comics), pre-fetched by
// app/api/cron/refresh-upcoming-releases into upcoming_release_cache.
// This file only shapes already-fetched entries for display — grouping
// by month and totaling up a viewer's own manually-entered "expected
// price" guesses (see UpcomingReleasesClient.jsx; there's no MSRP/price
// data available from either IGDB or Comic Vine for something that
// hasn't released yet, confirmed while researching this feature, so a
// real number here is unavoidably a guess someone types in, not
// something this app can look up).

import { normalizeTitle } from './duplicateCheck';
import { normalizeSeriesText } from './textNormalize';

// A stable cross-type cache key — "game:" / "comic:" prefixed so a game
// titled the same as a comic series (it happens — "Watchmen") can never
// collide in upcoming_release_cache. Games key off their own normalized
// title (matching lib/igdbSearch.js's own franchise-lookup convention);
// comics key off the normalized `series` field (matching
// lib/seriesCrowdsource.js's existing series-matching convention) since
// that's the field the rest of the app already treats as "which run is
// this issue part of."
export function buildSeriesKey(itemType, value) {
  const v = (value || '').trim();
  if (!v) return null;
  if (itemType === 'game') return `game:${normalizeTitle(v)}`;
  if (itemType === 'comic') return `comic:${normalizeSeriesText(v)}`;
  return null;
}

// Distinct (itemType, value) pairs worth resolving a series_key for,
// from a signed-in user's own owned rows — games key off `title` (no
// stored franchise field exists on `games`, see ROADMAP.md's
// decade-badges note for the same "no per-item release info stored"
// gap), comics key off `series`.
export function distinctTrackedSeries(games) {
  const seen = new Map();
  for (const g of games || []) {
    if (g.item_type === 'game' && g.title) {
      const key = buildSeriesKey('game', g.title);
      if (key && !seen.has(key)) seen.set(key, { itemType: 'game', value: g.title, key });
    } else if (g.item_type === 'comic' && g.series) {
      const key = buildSeriesKey('comic', g.series);
      if (key && !seen.has(key)) seen.set(key, { itemType: 'comic', value: g.series, key });
    }
  }
  return Array.from(seen.values());
}

// Flattens every cache row's `entries` array into one list, tagged with
// which series/franchise each came from, filtered to genuinely
// future-dated releases (a cache row can carry past entries too — see
// the cron's own comment — so "future" is enforced here at read time,
// not just at write time, in case a cached row goes stale past someone's
// next visit), and sorted soonest-first. `referenceDate` is injectable
// for tests; defaults to now.
export function flattenUpcomingEntries(cacheRows, referenceDate = new Date()) {
  const cutoff = referenceDate.getTime();
  const flattened = [];
  for (const row of cacheRows || []) {
    const entries = Array.isArray(row.entries) ? row.entries : [];
    for (const entry of entries) {
      if (!entry?.releaseDate) continue;
      const ts = new Date(entry.releaseDate).getTime();
      if (Number.isNaN(ts) || ts < cutoff) continue;
      flattened.push({
        ...entry,
        itemType: row.item_type,
        seriesName: row.series_name,
        releaseTs: ts,
        // A stable per-entry key for the price-input/localStorage side —
        // combines type + the source API's own id so a game and a comic
        // issue that happen to share a numeric id never collide.
        entryKey: `${row.item_type}:${entry.id}`,
      });
    }
  }
  return flattened.sort((a, b) => a.releaseTs - b.releaseTs);
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
