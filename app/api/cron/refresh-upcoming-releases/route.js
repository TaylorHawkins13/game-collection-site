import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getFranchiseGames } from '@/lib/igdbSearch';
import { getUpcomingComicIssues } from '@/lib/comicVineSeriesLookup';
import { distinctTrackedSeries, buildSeriesKey } from '@/lib/upcomingReleases';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs weekly (see vercel.json's crons entry) and pre-fetches real
// upcoming-release data — from IGDB for games, Comic Vine for comics —
// for every franchise/series someone here actually owns an item from.
// See upcoming_release_cache in supabase-schema.sql and
// lib/upcomingReleases.js's module comment for the full reasoning.
// Closes ROADMAP.md's "Pull list / upcoming-release calendar with spend
// forecasting": once a series has a fresh cache row,
// /dashboard/pull-list can show real upcoming dates for it without
// hitting either external API on a live page load. Modeled closely on
// refresh-master-sets/route.js — same shape, same tradeoffs, applied to
// a different cache table.
//
// Only refreshes series someone here has actually logged an item from
// (distinct game titles / comic series values across ALL users, not
// per-account — see distinctTrackedSeries) rather than trying to
// pre-populate every franchise either API knows about, which would be
// almost entirely wasted calls. A title/series that doesn't resolve to a
// real IGDB franchise/collection or Comic Vine volume (a one-off indie
// game with no franchise tag, a free-typed series name with a typo) is
// just skipped, same as a live lookup hitting `no_franchise`/`no_series`
// would.
//
// Capped at MAX_SERIES_PER_RUN fresh/stale series per run, and skips
// anything refreshed within STALE_AFTER_DAYS — same spread-coverage-
// across-multiple-runs tradeoff refresh-master-sets already makes, for
// the same reason (real external-API calls, real per-request time). A
// newly-tracked series might take a couple of weekly runs to get its
// first cache row; the pull-list page just shows nothing for that series
// until then, which is a reasonable gap for a feature that's inherently
// "here's what's coming," not something anyone depends on being
// instantly live the moment they log a new item.
const MAX_SERIES_PER_RUN = 8;
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

  // No clean server-side DISTINCT via supabase-js — fetches every owned
  // game/comic row's title/series across all users and dedupes in JS
  // instead. Same tradeoff refresh-master-sets and
  // lib/seriesCrowdsource.js already make for very similar queries; fine
  // at this app's scale.
  const { data: rows, error } = await admin
    .from('games')
    .select('item_type, title, series')
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

  for (const { itemType, value, key } of series) {
    if (processed >= MAX_SERIES_PER_RUN) break;

    const { data: existing } = await admin
      .from('upcoming_release_cache')
      .select('refreshed_at')
      .eq('series_key', key)
      .maybeSingle();
    if (existing?.refreshed_at && existing.refreshed_at > staleBefore) {
      skippedFresh += 1;
      continue;
    }

    processed += 1;
    try {
      const result =
        itemType === 'game' ? await getFranchiseGames(value) : await getUpcomingComicIssues(value);

      if (result.error) {
        // Doesn't count as a failure — a title/series with no
        // resolvable franchise/volume on the external side is a real,
        // expected outcome, not a fetch error (see module comment).
        skippedNotFound += 1;
        continue;
      }

      const seriesName = itemType === 'game' ? result.franchiseName : result.seriesName;
      // Only entries with a real release date are worth caching — an
      // entry with no releaseDate can never pass
      // flattenUpcomingEntries's own filter on the read side anyway (see
      // lib/upcomingReleases.js), so there's no reason to store it.
      const rawEntries = itemType === 'game' ? result.games : result.entries;
      const entries = (rawEntries || []).filter((e) => e?.releaseDate);

      // Re-derive the key from the resolved series name rather than
      // trusting `key` blindly — cheap safety net in case
      // buildSeriesKey's normalization ever drifts from what was used to
      // look this row up (it shouldn't, since both come from the same
      // function, but a mismatched key here would silently orphan a
      // cache row no page ever reads).
      const resolvedKey = buildSeriesKey(itemType, seriesName || value) || key;

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
