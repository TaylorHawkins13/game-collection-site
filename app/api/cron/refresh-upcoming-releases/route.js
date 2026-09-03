import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getUpcomingGamesForPlatform, getUpcomingGamesForGenre } from '@/lib/igdbUpcomingByInterest';
import { getUpcomingComicIssues } from '@/lib/comicVineSeriesLookup';
import { distinctTrackedSeries, buildSeriesKey, buildResolvedInterestKey } from '@/lib/upcomingReleases';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs weekly (see vercel.json's crons entry) and pre-fetches real
// upcoming-release data — from IGDB for games, Comic Vine for comics.
// See upcoming_release_cache in supabase-schema.sql and
// lib/upcomingReleases.js's module comment for the full reasoning.
// Closes ROADMAP.md's "Pull list / upcoming-release calendar with spend
// forecasting": once a series/genre/platform has a fresh cache row,
// /dashboard/upcoming-releases can show real upcoming dates for it
// without hitting either external API on a live page load. Modeled
// closely on refresh-master-sets/route.js — same shape, same tradeoffs,
// applied to a different cache table.
//
// Redesigned Sep 2026 (see CHANGELOG.md, "Upcoming Releases now
// recommends by genre/platform, not just exact franchise matches" —
// flagged directly: "i dont think it should be for the things logged on
// shelflife, i think it should check the api and add stuff from there").
// Comics are unchanged: still tracked by exact series (getUpcomingComicIssues),
// still resolved/cached under a `comic:<series>` key. Games are no longer
// tracked by resolving a franchise from a specific owned title
// (lib/igdbSearch.js's getFranchiseGames, still used elsewhere — see that
// file — just not by this feature anymore); instead every distinct
// platform and genre showing up across someone's collection
// (distinctTrackedSeries) gets its own cache row of currently-hyped
// upcoming games for that platform/genre (lib/igdbUpcomingByInterest.js),
// keyed `game_platform:<igdb id>` / `game_genre:<igdb id>` once resolved.
// A platform/genre string that doesn't resolve to anything real on IGDB
// (a typo, a genuinely obscure/regional platform) is just skipped, same
// as a title that never resolved to a franchise used to be.
//
// Still pools across ALL users, not per-account (see
// distinctTrackedSeries) — rather than being wasteful, this pooling is
// now a bigger win than it was for the old per-title design: platforms
// and genres are a naturally small, shared set (confirmed directly: ~25
// distinct platform strings alone across one real 268-game account),
// so most users' collections end up reusing cache rows other users
// already warmed, instead of each of 268 distinct owned titles needing
// its own resolution the way the old design did.
//
// Capped at MAX_SERIES_PER_RUN fresh/stale entries per run, and skips
// anything refreshed within STALE_AFTER_DAYS — same spread-coverage-
// across-multiple-runs tradeoff refresh-master-sets already makes, for
// the same reason (real external-API calls, real per-request time). A
// newly-tracked platform/genre or comic series might take a couple of
// weekly runs to get its first cache row; the upcoming-releases page
// just shows nothing for it until then, which is a reasonable gap for a
// feature that's inherently "here's what's coming," not something
// anyone depends on being instantly live the moment they log a new item.
//
// Set at 25, not 5 like refresh-master-sets' MAX_SETS_PER_RUN — carried
// over from the original per-title design, which needed the higher cap
// after the page shipped genuinely empty for an account with 238 distinct
// tracked game titles (see CHANGELOG.md). The genre/platform redesign
// above needs far fewer distinct entries to cover the same collection, so
// 25 now clears a typical account's full backlog in a single run rather
// than several — left as-is rather than lowered, since a higher cap here
// costs nothing extra once there's this little left to process. See
// README.md's note on manually triggering a run (`vercel crons run`) to
// speed up backfill for a brand new/unusually large collection rather
// than waiting on the weekly schedule alone.
const MAX_SERIES_PER_RUN = 25;
const STALE_AFTER_DAYS = 7;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    await notifyCronFailure('refresh-upcoming-releases', e);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // No clean server-side DISTINCT via supabase-js — fetches every game/
  // comic row's platforms/genre/series across all users and dedupes in JS
  // instead (distinctTrackedSeries). Same tradeoff refresh-master-sets and
  // lib/seriesCrowdsource.js already make for very similar queries; fine
  // at this app's scale. `title` no longer needed here — see the module
  // comment above, games are tracked by platform/genre now, not by title.
  const { data: rows, error } = await admin
    .from('games')
    .select('item_type, series, platforms, genre')
    .in('item_type', ['game', 'comic']);

  if (error) {
    console.error('refresh-upcoming-releases: failed to load tracked series', error);
    await notifyCronFailure('refresh-upcoming-releases', error);
    await recordCronRun(admin, 'refresh-upcoming-releases', 'error');
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const series = distinctTrackedSeries(rows || []);

  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let refreshed = 0;
  let skippedFresh = 0;
  let skippedNotFound = 0;
  let failed = 0;
  let processed = 0;

  for (const { itemType, kind, value, key } of series) {
    if (processed >= MAX_SERIES_PER_RUN) break;

    // Fixed (Sep 2026 — found while investigating why real cached data
    // still wasn't showing up for a real account even after the
    // separate CRON_SECRET-never-set incident was fixed, see
    // CHANGELOG.md): `key` is built straight from this raw, as-typed
    // title/series/platform/genre string ("Super Mario Land", "PS5"), but
    // a cache row is keyed by the *resolved* franchise/series/platform/
    // genre ("Mario", `game_platform:167`) — those are almost never the
    // same string, so checking `key` directly against
    // upcoming_release_cache here always missed, and every run re-hit
    // IGDB/Comic Vine for every raw value even when its resolved target
    // had just been refreshed a moment earlier via a different raw value.
    // Go through upcoming_release_aliases (raw_key -> resolved_key,
    // populated below every time a value resolves successfully) first —
    // a value with no alias yet has never resolved before, so there's
    // nothing to skip.
    const { data: existingAlias } = await admin
      .from('upcoming_release_aliases')
      .select('resolved_key')
      .eq('raw_key', key)
      .maybeSingle();
    if (existingAlias?.resolved_key) {
      const { data: existing } = await admin
        .from('upcoming_release_cache')
        .select('refreshed_at')
        .eq('series_key', existingAlias.resolved_key)
        .maybeSingle();
      if (existing?.refreshed_at && existing.refreshed_at > staleBefore) {
        skippedFresh += 1;
        continue;
      }
    }

    processed += 1;
    try {
      // Every fetch function below returns the same { seriesName, entries,
      // error } shape (games also return `id`, the resolved IGDB
      // platform/genre id — see lib/igdbUpcomingByInterest.js) so the rest
      // of this loop doesn't need to branch on itemType/kind again after
      // this point.
      let result;
      if (itemType === 'comic') {
        result = await getUpcomingComicIssues(value);
      } else if (kind === 'platform') {
        result = await getUpcomingGamesForPlatform(value);
      } else {
        result = await getUpcomingGamesForGenre(value);
      }

      if (result.error) {
        // Doesn't count as a failure — a title/series/platform/genre with
        // no resolvable match on the external side is a real, expected
        // outcome, not a fetch error (see module comment).
        skippedNotFound += 1;
        continue;
      }

      const seriesName = result.seriesName || value;
      // Only entries with a real release date are worth caching — an
      // entry with no releaseDate can never pass
      // flattenUpcomingEntries's own filter on the read side anyway (see
      // lib/upcomingReleases.js), so there's no reason to store it.
      const entries = (result.entries || []).filter((e) => e?.releaseDate);

      // Re-derive the key from what actually resolved rather than
      // trusting `key` blindly — cheap safety net in case a normalization
      // helper ever drifts from what was used to look this row up (it
      // shouldn't, since both come from the same function, but a
      // mismatched key here would silently orphan a cache row no page
      // ever reads). Comics resolve by name (buildSeriesKey, unchanged);
      // games resolve by the real IGDB id lib/igdbUpcomingByInterest.js
      // returned (buildResolvedInterestKey) — two different raw platform
      // strings ("PS5", "PlayStation 5") that resolve to the same id
      // correctly collapse onto the same cache row this way.
      const resolvedKey =
        itemType === 'comic'
          ? buildSeriesKey('comic', seriesName) || key
          : buildResolvedInterestKey(kind, result.id) || key;

      const { error: upsertError } = await admin.from('upcoming_release_cache').upsert(
        {
          series_key: resolvedKey,
          item_type: itemType,
          series_name: seriesName || value,
          entries,
          refreshed_at: new Date().toISOString(),
        },
        { onConflict: 'series_key' }
      );
      if (upsertError) {
        console.error(`refresh-upcoming-releases: failed to cache ${key}`, upsertError);
        failed += 1;
      } else {
        refreshed += 1;
        // Record which resolved cache row this raw value actually
        // belongs to — see the alias comment above and CHANGELOG.md.
        // Best-effort: a failure here doesn't touch the cache row itself
        // (still correct), it just means this exact raw value gets
        // looked up (and possibly re-fetched from scratch) again next
        // time instead of resolving instantly through the alias.
        const { error: aliasError } = await admin.from('upcoming_release_aliases').upsert(
          { raw_key: key, resolved_key: resolvedKey, updated_at: new Date().toISOString() },
          { onConflict: 'raw_key' }
        );
        if (aliasError) {
          console.error(`refresh-upcoming-releases: failed to record alias ${key} -> ${resolvedKey}`, aliasError);
        }
      }
    } catch (e) {
      console.error(`refresh-upcoming-releases: failed to build cache for ${key}`, e);
      failed += 1;
    }
  }

  await recordCronRun(admin, 'refresh-upcoming-releases', 'success');
  return NextResponse.json({
    totalSeries: series.length,
    refreshed,
    skippedFresh,
    skippedNotFound,
    failed,
  });
}
