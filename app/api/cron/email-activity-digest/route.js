import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { buildActivityDigest } from '@/lib/activityDigest';
import { sendEmail } from '@/lib/resend';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';
import { SITE_URL } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Opt-in weekly activity digest (see ROADMAP.md "Notification digest
// emails") — your own week (items added/completed/rated, trophies
// earned) plus a summary of what the public collectors you follow have
// been up to, in one email instead of needing to remember to check
// /feed. profiles.email_activity_digest_enabled (see
// activity-digest-migration.sql), off by default. Runs weekly (see
// vercel.json's crons entry).
//
// One email per opted-in account, built via lib/activityDigest.js so
// this can never quietly drift from what /feed itself would show for the
// same week. Skips sending (not counted as a failure) for a genuinely
// quiet week — nothing of your own and nothing from anyone you follow —
// rather than deliver an empty "nothing happened" email. A single
// account's failure is logged and counted, not treated as a whole-job
// failure, same per-item-vs-job-level split price-drop-check/
// email-data-backup already use.
async function sendOneDigest(admin, profileId) {
  const digest = await buildActivityDigest(admin, profileId);
  if (!digest.hasAnything) return { skipped: true };

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileId);
  const email = userData?.user?.email;
  if (userError || !email) return { skipped: true };

  const ownLines = [];
  if (digest.ownCounts.added) ownLines.push(`added <strong>${digest.ownCounts.added}</strong> item${digest.ownCounts.added === 1 ? '' : 's'}`);
  if (digest.ownCounts.completed) ownLines.push(`completed <strong>${digest.ownCounts.completed}</strong> item${digest.ownCounts.completed === 1 ? '' : 's'}`);
  if (digest.ownCounts.rated) ownLines.push(`rated <strong>${digest.ownCounts.rated}</strong> item${digest.ownCounts.rated === 1 ? '' : 's'}`);
  if (digest.ownCounts.trophy) ownLines.push(`earned <strong>${digest.ownCounts.trophy}</strong> trophy${digest.ownCounts.trophy === 1 ? '' : 's'}`);

  const ownHtml = ownLines.length
    ? `<p>This week you ${ownLines.join(', ')}.</p>`
    : '';
  const ownText = ownLines.length ? `This week you ${ownLines.join(', ')}.` : '';

  const friendRows = digest.friendEvents
    .map((e) => `${e.name} ${e.verb} <strong>${e.subject}</strong>`)
    .slice(0, 10);
  const friendHtml = friendRows.length
    ? `<p><strong>From collectors you follow:</strong><br>${friendRows.join('<br>')}</p>`
    : '';
  const friendText = friendRows.length ? `From collectors you follow:\n${friendRows.map((r) => r.replace(/<\/?strong>/g, '')).join('\n')}` : '';

  const subjectBits = [];
  if (digest.ownTotal > 0) subjectBits.push(`you: ${digest.ownTotal} update${digest.ownTotal === 1 ? '' : 's'}`);
  if (digest.friendEvents.length > 0) subjectBits.push(`friends: ${digest.friendEvents.length} update${digest.friendEvents.length === 1 ? '' : 's'}`);

  await sendEmail({
    to: email,
    subject: `Your Shelf Life week — ${subjectBits.join(', ')}`,
    html: `
      ${ownHtml}
      ${friendHtml}
      <p><a href="${SITE_URL}/feed">See the full feed</a> · <a href="${SITE_URL}/dashboard?settingsTab=data">turn this email off</a></p>
    `,
    text: `${ownText}\n\n${friendText}\n\nSee the full feed: ${SITE_URL}/feed\nTurn this email off: ${SITE_URL}/dashboard?settingsTab=data`,
  });
  return { sent: true };
}

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
    await notifyCronFailure('email-activity-digest', e);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id')
    .eq('email_activity_digest_enabled', true);

  if (error) {
    console.error('email-activity-digest: failed to load opted-in profiles', error);
    await notifyCronFailure('email-activity-digest', error);
    await recordCronRun(admin, 'email-activity-digest', 'error');
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of profiles || []) {
    try {
      const result = await sendOneDigest(admin, p.id);
      if (result.sent) sent += 1;
      else skipped += 1;
    } catch (e) {
      failed += 1;
      console.error('email-activity-digest: failed for profile', p.id, e);
    }
  }

  await recordCronRun(admin, 'email-activity-digest', 'success');
  return NextResponse.json({ total: (profiles || []).length, sent, skipped, failed });
}
