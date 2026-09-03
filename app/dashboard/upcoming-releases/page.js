import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { distinctTrackedSeries, flattenUpcomingEntries, groupEntriesByMonth } from '@/lib/upcomingReleases';
import UpcomingReleasesClient from './UpcomingReleasesClient';

export const metadata = {
  title: 'Upcoming Releases — Shelf Life',
};

// ROADMAP.md "Pull list / upcoming-release calendar with spend
// forecasting" — a calendar of what's still coming, sourced from
// upcoming_release_cache (see supabase-schema.sql and
// app/api/cron/refresh-upcoming-releases), plus a running this-week/
// this-month spend total from prices the viewer types in themselves —
// see UpcomingReleasesClient.jsx for why that has to be manual (neither
// IGDB nor Comic Vine expose real price/MSRP data for something that
// hasn't released yet). Named/labeled "Upcoming Releases" in the UI
// (Sep 2026) rather than "Pull List" — clearer to anyone not already
// familiar with comic-shop pull-list terminology, though the underlying
// ROADMAP.md line, DB table, and cron job name all still use "pull
// list"/"upcoming release" interchangeably from when this was built.
//
// What decides what shows up differs by type (Sep 2026 redesign — see
// CHANGELOG.md, "Upcoming Releases now recommends by genre/platform, not
// just exact franchise matches," and lib/upcomingReleases.js's module
// comment for the full reasoning): a comic still has to match an exact
// series the signed-in user owns something from. A game no longer does —
// it shows up if it's an upcoming, currently-hyped release on a platform
// or in a genre this user's own collection already touches, whether or
// not it has anything to do with a specific franchise they own.
//
// Server/client split mirrors app/dashboard/catalogue/page.js: this does
// the narrow data fetch + resolution server-side, UpcomingReleasesClient
// handles all the interactive display.
export default async function UpcomingReleasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: profile }, { data: games }] = await Promise.all([
    supabase.from('profiles').select('currency').eq('id', user.id).single(),
    supabase
      .from('games')
      .select('item_type, series, platforms, genre')
      .eq('user_id', user.id)
      .in('item_type', ['game', 'comic']),
  ]);

  const series = distinctTrackedSeries(games || []);
  const groups = await loadUpcomingGroups(series);

  return <UpcomingReleasesClient groups={groups} currency={profile?.currency || 'USD'} />;
}

// Best-effort read of upcoming_release_cache, same pattern
// app/api/pokemon-master-set/route.js's loadCachedDetail already
// establishes: a missing SUPABASE_SERVICE_ROLE_KEY or a query error just
// means an empty calendar rather than a broken page — the cron
// populating this cache is a background optimization, not something this
// page can hard-depend on being fully warm.
//
// Fixed (Sep 2026 — this page still showed nothing for a real account
// even after the separate CRON_SECRET-never-set incident was fixed, see
// CHANGELOG.md): a cache row is keyed by whatever actually *resolved* on
// IGDB/Comic Vine's side, not by the raw value a signed-in user's own
// collection produced — a comic series typed as "Batman" tracks as
// `comic:batman` but its cache row might be keyed by a slightly different
// resolved series name; a platform typed as "PS5" (see
// lib/upcomingReleases.js's module comment for why games resolve by
// platform/genre, not title, since the redesign below) tracks as
// `game_platform_name:ps5` but its cache row is the resolved
// `game_platform:167`. Those essentially never match directly, so this
// used to come back empty for almost every real value. Now resolves each
// of the viewer's raw keys through upcoming_release_aliases first (built
// up by the cron as it processes them — see that table's migration
// comment and the cron route), then still checks the raw keys directly
// too, which covers a raw value that happens to already equal its own
// resolved key and any cache row written before this fix shipped.
async function loadUpcomingGroups(series) {
  if (series.length === 0) return [];

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const keys = series.map((s) => s.key);
  const { data: aliasRows } = await admin
    .from('upcoming_release_aliases')
    .select('resolved_key')
    .in('raw_key', keys);

  const lookupKeys = Array.from(new Set([...keys, ...(aliasRows || []).map((a) => a.resolved_key)]));

  const { data: cacheRows, error } = await admin
    .from('upcoming_release_cache')
    .select('item_type, series_name, entries')
    .in('series_key', lookupKeys);
  if (error || !cacheRows) return [];

  return groupEntriesByMonth(flattenUpcomingEntries(cacheRows));
}
