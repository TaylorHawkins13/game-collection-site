import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { RP_ID } from '@/lib/webauthnConfig';

// No account/email needed up front — allowCredentials is left empty on
// purpose ("usernameless"/discoverable flow), so the OS shows a picker
// of whichever passkeys it already has saved for this site rather than
// making someone type their email first. This is what lets a single
// "Sign in with Face ID" button work the way Face ID normally does.
export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
  });

  cookies().set('webauthn_challenge', options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  return NextResponse.json(options);
}
