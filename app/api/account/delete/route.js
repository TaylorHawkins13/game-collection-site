import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { GRACE_PERIOD_HOURS } from '@/lib/accountDeletion';
import { sendEmail } from '@/lib/resend';
import { SITE_URL } from '@/lib/siteUrl';

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
  const supabase = await createClient();
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

  // Best-effort, same pattern as every other notification email on the
  // site — the request above is already durably saved, so a failed send
  // here shouldn't turn a successful request into an error response. This
  // closes a real gap flagged in ROADMAP.md: until now, the in-app banner
  // was the *only* signal that a deletion request went through — someone
  // who requested this by mistake (or on someone else's behalf) and
  // doesn't happen to sign back in within the grace period had no other
  // way to find out or cancel.
  const deletionDate = new Date(Date.now() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  try {
    await sendEmail({
      to: viewer.email,
      subject: 'Your Shelf Life account is scheduled for deletion',
      text: [
        `We received a request to delete your Shelf Life account (${viewer.email}).`,
        '',
        `Unless you cancel, everything will be permanently deleted on ${deletionDate.toLocaleString('en-US', {
          dateStyle: 'long',
          timeStyle: 'short',
        })} — about ${GRACE_PERIOD_HOURS} hours from now.`,
        '',
        'Didn’t request this, or changed your mind? Sign back in before then and click "Cancel deletion" in the Danger zone section of your dashboard:',
        `${SITE_URL}/dashboard`,
        '',
        'If you don’t recognize this request at all, it’s worth signing in to cancel it and changing your password.',
      ].join('\n'),
    });
  } catch (e) {
    console.error('Account deletion confirmation email failed (deletion was still scheduled)', e);
  }

  return NextResponse.json({ ok: true, graceHours: GRACE_PERIOD_HOURS });
}
