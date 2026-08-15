import { createAdminClient } from '@/lib/supabaseAdmin';
import { CRON_JOBS } from '@/lib/cronHeartbeat';

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Shared by /admin/stats (the pull version — a private page Taylor has to
// remember to visit) and the weekly-stats-digest cron (the push version,
// emailed automatically every Sunday) — one set of queries so the two
// never quietly drift apart from each other. Throws on any Supabase/config
// failure (most likely SUPABASE_SERVICE_ROLE_KEY not being set); it's up
// to each caller to decide what that means for them — the page falls back
// to a "needs SUPABASE_SERVICE_ROLE_KEY" message, the cron alerts Taylor
// via lib/cronAlert.js instead.
export async function getSiteStats() {
  // Admin client — these counts need to include private profiles too
  // (site-wide totals, not "what's visible to this viewer"), same
  // reasoning /admin/newsletter's counts already use.
  const admin = createAdminClient();
  const sevenDaysAgo = daysAgoIso(7);
  const thirtyDaysAgo = daysAgoIso(30);

  const [
    { count: totalUsers },
    { count: publicProfiles },
    { count: signups7d },
    { count: signups30d },
    { count: totalItems },
    { count: activity7d },
    { data: recentActivity },
    { data: publicProfilesList },
    { data: cronRunRows },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_public', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    admin.from('games').select('*', { count: 'exact', head: true }),
    admin.from('activity_events').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    admin.from('activity_events').select('user_id').gte('created_at', thirtyDaysAgo),
    admin.from('profiles').select('id, username, display_name').eq('is_public', true),
    admin.from('cron_runs').select('*'),
  ]);

  const stats = {
    totalUsers: totalUsers || 0,
    publicProfiles: publicProfiles || 0,
    signups7d: signups7d || 0,
    signups30d: signups30d || 0,
    totalItems: totalItems || 0,
    activity7d: activity7d || 0,
  };

  // "Most active" is aggregated here in JS rather than a SQL group-by —
  // at Shelf Life's current scale this is a handful of rows, and it
  // avoids needing a new view/migration just for this. Public profiles
  // only, same privacy rule the real leaderboard already applies (a
  // private collector's activity never surfaces here or in the digest
  // email).
  const publicIds = new Set((publicProfilesList || []).map((p) => p.id));
  const counts = new Map();
  for (const row of recentActivity || []) {
    if (!publicIds.has(row.user_id)) continue;
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
  }
  const profileById = new Map((publicProfilesList || []).map((p) => [p.id, p]));
  const topCollectors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ ...profileById.get(id), count }));

  // Left-join-style against the known job list (lib/cronHeartbeat.js) so
  // a job that's never run yet still shows up as "Never run yet" instead
  // of silently missing from the list entirely.
  const runsByJob = new Map((cronRunRows || []).map((r) => [r.job_name, r]));
  const cronRuns = CRON_JOBS.map((job) => ({ ...job, run: runsByJob.get(job.name) || null }));

  return { stats, topCollectors, cronRuns };
}
