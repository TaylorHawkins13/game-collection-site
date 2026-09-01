import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { RP_ID } from '@/lib/webauthnConfig';
import { checkWebauthnRateLimit } from '@/lib/webauthnRateLimit';

// No account/email needed up front — allowCredentials is left empty on
// purpose ("usernameless"/discoverable flow), so the OS shows a picker
// of whichever passkeys it already has saved for this site rather than
// making someone type their email first. This is what lets a single
// "Sign in with Face ID" button work the way Face ID normally does.
export async function POST(req) {
  // See ROADMAP.md "WebAuthn/passkey API routes have no rate limiting" —
  // this route mints a fresh challenge on every call with no signed-in
  // user to key on, so it's checked by IP via a dedicated table rather
  // than the trigger-based pattern comments/articles use.
  const { limited } = await checkWebauthnRateLimit(req);
  if (limited) {
    return NextResponse.json({ error: 'Too many attempts — wait a few minutes and try again.' }, { status: 429 });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
  });

  (await cookies()).set('webauthn_challenge', options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  return NextResponse.json(options);
}
