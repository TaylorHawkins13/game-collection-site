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
async function loadUpcomingGroups(series) {
  if (series.length === 0) return [];

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const keys = series.map((s) => s.key);
  const { data: cacheRows, error } = await admin
    .from('upcoming_release_cache')
    .select('item_type, series_name, entries')
    .in('series_key', keys);
  if (error || !cacheRows) return [];

  return groupEntriesByMonth(flattenUpcomingEntries(cacheRows));
}
