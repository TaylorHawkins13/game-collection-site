import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { distinctTrackedSeries, flattenUpcomingEntries, groupEntriesByMonth } from '@/lib/upcomingReleases';
import UpcomingReleasesClient from './UpcomingReleasesClient';

export const metadata = {
  title: 'Upcoming Releases — Shelf Life',
};

// ROADMAP.md "Pull list / upcoming-release calendar with spend
// forecasting" — a calendar of what's still coming for the game
// franchises and comic series the signed-in user already owns something
// from, sourced from upcoming_release_cache (see supabase-schema.sql and
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
    supabase.from('games').select('item_type, title, series').eq('user_id', user.id).in('item_type', ['game', 'comic']),
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
// CHANGELOG.md): a cache row is keyed by the *resolved* franchise/series
// name the cron got back from IGDB/Comic Vine, not by whatever title the
// owner actually typed in — owning "Super Mario Land" tracks as
// `game:super mario land`, but its cache row is `game:mario`. Those
// essentially never match directly, so this used to come back empty for
// almost every real title. Now resolves each of the viewer's raw keys
// through upcoming_release_aliases first (built up by the cron as it
// processes titles — see that table's migration comment and the cron
// route), then still checks the raw keys directly too, which covers a
// title that happens to already equal its own franchise/series name and
// any cache row written before this fix shipped.
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
