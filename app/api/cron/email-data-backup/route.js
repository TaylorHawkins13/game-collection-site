import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { buildAccountBackup } from '@/lib/accountBackup';
import { sendEmail } from '@/lib/resend';
import { notifyCronFailure } from '@/lib/cronAlert';
import { recordCronRun } from '@/lib/cronHeartbeat';
import { SITE_URL } from '@/lib/siteUrl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Opt-in monthly email backup (see ROADMAP.md "Opt-in automatic backup of
// exports") — "Download my data" and "Export CSV" in Settings > Data
// already exist but are manual, on-demand; this sends the same two files
// automatically, once a month, to anyone who's turned it on
// (profiles.email_backup_enabled — see email-backup-migration.sql).
// Runs on the 1st of the month (see vercel.json's crons entry).
//
// One email per opted-in account, each with the CSV export (collection
// items) and the JSON export ("Download my data" — profile, comments,
// follows, activity, trophies) attached directly, built via
// lib/accountBackup.js so this can never quietly drift from what the two
// manual buttons produce. A single account's failure (a bad attachment,
// a bounced address) is logged and counted, not treated as a whole-job
// failure — notifyCronFailure/recordCronRun('error') is reserved for the
// initial query failing, same split price-drop-check uses between a
// per-item failure and a job-level one.
//
// Fine at today's scale doing one admin.auth.admin.getUserById() lookup
// per opted-in account (profiles has no email column, see
// lib/supabaseAdmin.js) — same caveat the newsletter send already
// documents: would need real pagination/batching well before this list
// gets into the thousands.
async function sendOneBackup(admin, profileId) {
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileId);
  const email = userData?.user?.email;
  if (userError || !email) return { skipped: true };

  const backup = await buildAccountBackup(admin, profileId, email);
  const stamp = new Date().toISOString().slice(0, 10);

  await sendEmail({
    to: email,
    subject: `Your Shelf Life data backup — ${stamp}`,
    html: `
      <p>Here's your monthly Shelf Life backup: ${backup.itemCount} collection item${backup.itemCount === 1 ? '' : 's'} (CSV, re-importable as-is) plus everything else about your account — profile, comments, follows, activity, and trophies (JSON).</p>
      <p>This is the same thing "Export CSV" and "Download my data" give you on demand in <a href="${SITE_URL}/dashboard?settingsTab=data">Settings &gt; Data</a>, where you can also turn this monthly email off.</p>
    `,
    text: `Here's your monthly Shelf Life backup: ${backup.itemCount} collection item(s) (CSV) plus everything else about your account (JSON). Same as "Export CSV"/"Download my data" in Settings > Data, where you can also turn this monthly email off.`,
    attachments: [
      { filename: `shelf-life-export-${stamp}.csv`, content: Buffer.from(backup.csv, 'utf-8').toString('base64') },
      { filename: 'shelf-life-data-export.json', content: Buffer.from(backup.json, 'utf-8').toString('base64') },
    ],
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
    await notifyCronFailure('email-data-backup', e);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { data: profiles, error } = await admin.from('profiles').select('id').eq('email_backup_enabled', true);

  if (error) {
    console.error('email-data-backup: failed to load opted-in profiles', error);
    await notifyCronFailure('email-data-backup', error);
    await recordCronRun(admin, 'email-data-backup', 'error');
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const p of profiles || []) {
    try {
      const result = await sendOneBackup(admin, p.id);
      if (result.sent) sent += 1;
    } catch (e) {
      failed += 1;
      console.error('email-data-backup: failed for profile', p.id, e);
    }
  }

  await recordCronRun(admin, 'email-data-backup', 'success');
  return NextResponse.json({ total: (profiles || []).length, sent, failed });
}
