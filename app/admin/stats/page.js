import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isAdminViewer } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Site stats — Shelf Life',
};

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Private, unlinked admin page — same gating pattern as /admin/articles
// and /admin/newsletter (404 rather than a "not authorized" screen, so a
// non-admin visitor who guesses the URL can't even confirm an admin area
// exists here). Closes a real gap flagged in ROADMAP.md: until now, the
// only admin-facing pages were the article-review queue and the
// newsletter composer — nothing that just showed the numbers, even
// though this is a real launched product now, not friends and family
// checking in casually.
export default async function AdminStatsPage() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) redirect('/login');
  if (!isAdminViewer(viewer)) notFound();

  let stats = null;
  let topCollectors = [];
  try {
    // Admin client — the counts need to include private profiles too
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
    ] = await Promise.all([
      admin.from('profiles').select('*', { count: 'exact', head: true }),
      admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_public', true),
      admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      admin.from('games').select('*', { count: 'exact', head: true }),
      admin.from('activity_events').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      admin.from('activity_events').select('user_id').gte('created_at', thirtyDaysAgo),
      admin.from('profiles').select('id, username, display_name').eq('is_public', true),
    ]);

    stats = {
      totalUsers: totalUsers || 0,
      publicProfiles: publicProfiles || 0,
      signups7d: signups7d || 0,
      signups30d: signups30d || 0,
      totalItems: totalItems || 0,
      activity7d: activity7d || 0,
    };

    // "Most active" is aggregated here in JS rather than a SQL group-by —
    // at Shelf Life's current scale this is a handful of rows, and it
    // avoids needing a new view/migration just for one admin page. Public
    // profiles only, same privacy rule the real leaderboard already
    // applies (a private collector's activity never surfaces here).
    const publicIds = new Set((publicProfilesList || []).map((p) => p.id));
    const counts = new Map();
    for (const row of recentActivity || []) {
      if (!publicIds.has(row.user_id)) continue;
      counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
    }
    const profileById = new Map((publicProfilesList || []).map((p) => [p.id, p]));
    topCollectors = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ ...profileById.get(id), count }));
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set yet — let the page render anyway
    // so the setup note is visible instead of a hard crash, same pattern
    // as /admin/articles and /admin/newsletter.
  }

  return (
    <main className="container">
      <div className="home-hub-greeting">
        <h1>Site stats</h1>
        <p className="sub">
          A rough at-a-glance read on how Shelf Life is doing — not a full analytics suite, just the numbers that
          already live in the database.
        </p>
      </div>

      {!stats ? (
        <p className="sub">
          Needs <code>SUPABASE_SERVICE_ROLE_KEY</code> set (see README step 7) — same requirement as the newsletter
          and article-review admin pages.
        </p>
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat">
              <div className="num">{stats.totalUsers}</div>
              <div className="label">Total users</div>
            </div>
            <div className="stat">
              <div className="num">{stats.publicProfiles}</div>
              <div className="label">Public profiles</div>
            </div>
            <div className="stat">
              <div className="num">{stats.signups7d}</div>
              <div className="label">New this week</div>
            </div>
            <div className="stat">
              <div className="num">{stats.signups30d}</div>
              <div className="label">New this month</div>
            </div>
            <div className="stat">
              <div className="num">{stats.totalItems}</div>
              <div className="label">Items logged</div>
            </div>
            <div className="stat">
              <div className="num">{stats.activity7d}</div>
              <div className="label">Activity events (7d)</div>
            </div>
          </div>

          <h2 className="home-section-heading" style={{ marginTop: 32 }}>
            Most active public collectors (30 days)
          </h2>
          {topCollectors.length === 0 ? (
            <p className="sub">Not enough recent activity yet to rank anyone.</p>
          ) : (
            <div className="home-articles">
              {topCollectors.map((c, i) => (
                <div
                  key={c.id}
                  className="home-whatsnew-row"
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
                >
                  <span>
                    {i + 1}. <Link href={`/u/${c.username}`}>{c.display_name || c.username}</Link>
                  </span>
                  <span className="sub">{c.count} events</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
