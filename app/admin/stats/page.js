import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { getSiteStats } from '@/lib/siteStats';
import { isAdminViewer } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Site stats — Shelf Life',
};

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
  let cronRuns = [];
  try {
    // Shared with the weekly-stats-digest cron (see lib/siteStats.js) so
    // this page and the emailed version can never quietly show different
    // numbers.
    ({ stats, topCollectors, cronRuns } = await getSiteStats());
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

          {/* Visibility layer for each scheduled Vercel Cron job — see
              lib/cronHeartbeat.js. Just "did this run recently and how
              did it go," not real monitoring: a job that stops firing
              entirely (not just erroring) won't show up any differently
              here, since nothing calls recordCronRun() if the job never
              runs at all. See ROADMAP.md's "External cron watchdog"
              entry for the piece that actually closes that gap. */}
          <h2 className="home-section-heading" style={{ marginTop: 32 }}>
            Cron jobs
          </h2>
          <div className="home-articles">
            {cronRuns.map((job) => (
              <div
                key={job.name}
                className="home-whatsnew-row"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
              >
                <span>
                  {job.label} <span className="sub">({job.schedule})</span>
                </span>
                <span className="sub">
                  {job.run
                    ? `Last ran ${new Date(job.run.last_run_at).toLocaleString()} — ${job.run.last_status}${
                        job.run.last_success_at
                          ? `, last success ${new Date(job.run.last_success_at).toLocaleString()}`
                          : ''
                      }`
                    : 'Never run yet'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
