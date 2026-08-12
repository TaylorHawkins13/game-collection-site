import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { GRACE_PERIOD_HOURS } from '@/lib/accountDeletion';

// Requests deletion of the caller's own account — and only their own.
// The user id comes from their own verified session
// (supabase.auth.getUser()), never from anything in the request body,
// so there's no way to point this at someone else's account.
//
// This does NOT delete anything immediately. It just timestamps the
// request (profiles.deletion_requested_at) — the actual, irreversible
// cleanup (wiping Storage files, then deleting the auth.users row,
// which cascades through every table that references profiles(id) on
// delete cascade per supabase-schema.sql) happens later, in
// app/api/cron/process-account-deletions, once GRACE_PERIOD_HOURS has
// passed. That gap exists so someone who changes their mind (or
// clicked it by accident, or forgot they still wanted something off
// their collection first) can sign back in and cancel — see the
// "Danger zone" banner logic in app/dashboard/DashboardClient.jsx.
// Every other delete on the site already gets some kind of undo window
// (items get 6 seconds); the one truly irreversible action on the
// whole site deserves at least this much.
//
// This exists specifically to satisfy Apple's App Store Guideline
// 5.1.1(v), which requires apps that support account creation to also
// offer *actual* in-app account deletion, not just deactivation. A
// bounded grace period before the delete actually executes is still
// real, timely, self-service deletion — it doesn't require ongoing
// action from anyone to complete, unlike a "please email us" flow.
//
// Built and compiles clean, but — like everything else in this sandbox
// that needs a live Supabase project — could not be exercised against
// real data here (no live credentials). Test this for real against a
// disposable test account: request deletion, confirm the banner and
// Cancel option show up on sign-in, and confirm (either by adjusting
// GRACE_PERIOD_HOURS temporarily or waiting it out) that the cron job
// actually finishes the job and the account, its items, and its
// Storage files are all really gone afterward.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  if (!viewer) {
    return NextResponse.json({ error: 'You need to be signed in to do that.' }, { status: 401 });
  }

  // The existing "users can update their own profile" RLS policy
  // already scopes this to the caller's own row — no admin client
  // needed for a plain timestamp write.
  const { error } = await supabase
    .from('profiles')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', viewer.id);

  if (error) {
    console.error('Account deletion request failed', error);
    return NextResponse.json(
      { error: "Couldn't schedule your account for deletion — try again, or contact support if it keeps failing." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, graceHours: GRACE_PERIOD_HOURS });
}
