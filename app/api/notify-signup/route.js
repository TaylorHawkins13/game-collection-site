import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend';

// Fired once, client-side, right after a successful signup (see
// app/signup/page.js) — same "best-effort notification on top of an
// already-durable record" shape as /api/feedback: the account is already
// created in Supabase before this ever runs, so a failed or skipped
// notification here never loses anything, it just means Taylor doesn't
// get pinged about that one signup.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 40) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 320) : '';

  if (!username && !email) {
    return NextResponse.json({ error: 'Nothing to notify about.' }, { status: 400 });
  }

  try {
    await sendEmail({
      to: process.env.SIGNUP_NOTIFY_EMAIL || process.env.ADMIN_EMAIL,
      subject: `New Shelf Life signup: ${username || email}`,
      text: [
        username ? `Username: ${username}` : null,
        email ? `Email: ${email}` : null,
        username ? `Profile: https://shelflife.site/u/${username}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (e) {
    // Swallow errors on purpose — this endpoint's only job is a
    // best-effort ping, never something the signup flow should block or
    // error out on.
    console.error('Signup notification email failed', e);
  }

  return NextResponse.json({ ok: true });
}
