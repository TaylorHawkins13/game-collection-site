import { NextResponse } from 'next/server';
import { getSiteStats } from '@/lib/siteStats';
import { sendEmail } from '@/lib/resend';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';
import { SITE_URL } from '@/lib/siteUrl';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Runs weekly, Sunday morning (see vercel.json's crons entry) and pushes
// the same numbers /admin/stats shows on demand straight to Taylor's
// inbox — closes the "pull, not push" gap flagged in ROADMAP.md: nobody
// gets pinged when the numbers are worth a look, it just sat there until
// someone remembered to visit a private URL. Reuses lib/siteStats.js's
// getSiteStats() so the page and this email can never quietly show
// different numbers.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // Only for the heartbeat table below — getSiteStats() creates its own
  // separate admin client internally for the actual stats queries.
  // Best-effort: if this fails, the digest itself still runs fine, it
  // just won't show up on /admin/stats' "Cron jobs" section.
  let admin = null;
  try {
    admin = createAdminClient();
  } catch {
    // no-op
  }

  let stats, topCollectors;
  try {
    ({ stats, topCollectors } = await getSiteStats());
  } catch (e) {
    console.error('weekly-stats-digest: failed to load stats', e);
    await notifyCronFailure('weekly-stats-digest', e);
    if (admin) await recordCronRun(admin, 'weekly-stats-digest', 'error');
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const topRows = topCollectors
    .map((c, i) => `${i + 1}. ${c.display_name || c.username} — ${c.count} events`)
    .join('<br>');

  const html = `
    <p>This week's Shelf Life numbers:</p>
    <ul>
      <li><strong>${stats.totalUsers}</strong> total users (<strong>${stats.publicProfiles}</strong> public)</li>
      <li><strong>${stats.signups7d}</strong> new this week (${stats.signups30d} this month)</li>
      <li><strong>${stats.totalItems}</strong> items logged</li>
      <li><strong>${stats.activity7d}</strong> activity events (7d)</li>
    </ul>
    ${topCollectors.length ? `<p><strong>Most active public collectors (30 days):</strong><br>${topRows}</p>` : ''}
    <p><a href="${SITE_URL}/admin/stats">See the full stats page</a></p>
  `;

  try {
    await sendEmail({
      to: adminEmail,
      subject: `Shelf Life weekly stats: ${stats.totalUsers} users, ${stats.signups7d} new this week`,
      html,
    });
  } catch (e) {
    // Deliberately doesn't call notifyCronFailure here — that would just
    // route through the same (apparently broken) send path this call
    // just failed on.
    console.error('weekly-stats-digest: send failed', e);
    if (admin) await recordCronRun(admin, 'weekly-stats-digest', 'error');
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  if (admin) await recordCronRun(admin, 'weekly-stats-digest', 'success');
  return NextResponse.json({ sent: true });
}
