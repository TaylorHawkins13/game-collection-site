import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { GRACE_PERIOD_HOURS, performAccountDeletion } from '@/lib/accountDeletion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Runs daily (see vercel.json's crons entry) and finishes off any
// account whose GRACE_PERIOD_HOURS window has actually expired since it
// was requested via app/api/account/delete. Needs the service-role
// client — a cron job has no signed-in user, so this is one of a
// deliberately small number of places in the codebase that bypasses
// RLS; see lib/supabaseAdmin.js.
//
// Irreversible per account processed here: this is the real deletion
// (Storage wipe + auth.users delete → cascades through everything), not
// a preview. Anyone who wanted to back out had the full grace period
// (and a Cancel button, on sign-in) to do it before their row showed up
// in this query.
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
  } catch {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const cutoff = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000).toISOString();
  const { data: expired, error } = await admin
    .from('profiles')
    .select('id, username')
    .not('deletion_requested_at', 'is', null)
    .lte('deletion_requested_at', cutoff);

  if (error) {
    console.error('process-account-deletions: failed to load pending deletions', error);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  let deleted = 0;
  let failed = 0;
  for (const row of expired || []) {
    const { error: deleteError } = await performAccountDeletion(admin, row.id);
    if (deleteError) {
      failed += 1;
      console.error(`process-account-deletions: failed to delete account ${row.id} (${row.username})`, deleteError);
    } else {
      deleted += 1;
    }
  }

  return NextResponse.json({ total: (expired || []).length, deleted, failed });
}
