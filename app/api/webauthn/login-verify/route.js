import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { RP_ID, EXPECTED_ORIGIN } from '@/lib/webauthnConfig';
import { checkWebauthnRateLimit } from '@/lib/webauthnRateLimit';

// Verifies a passkey sign-in attempt and, if it's genuinely valid, mints
// a real Supabase session for whoever that credential belongs to.
//
// The tricky part: Supabase has no native "log in with a raw verified
// credential" API — auth methods are all password/OAuth/magic-link/OTP.
// The workaround used here (flagged up front in ROADMAP.md/CHANGELOG.md
// as the one part of this feature that genuinely needs real-device
// testing, not just a code read-through): once WebAuthn verification
// passes server-side, use the service-role client to generate a magic
// link for that user's email via supabase.auth.admin.generateLink(),
// then hand the resulting token back to the browser so it can redeem it
// itself via supabase.auth.verifyOtp() — that last step is what
// actually writes the session cookie, and it has to happen client-side
// since only the browser's Supabase client can do that write. No email
// is actually sent; generateLink() just mints the token, it doesn't
// deliver it anywhere on its own.
export async function POST(req) {
  // Same shared IP-based budget as login-options — see
  // lib/webauthnRateLimit.js and ROADMAP.md "WebAuthn/passkey API routes
  // have no rate limiting". A failed lookup below ("Passkey not
  // recognized") is exactly the cheap-probe case that budget exists for.
  const { limited } = await checkWebauthnRateLimit(req);
  if (limited) {
    return NextResponse.json({ error: 'Too many attempts — wait a few minutes and try again.' }, { status: 429 });
  }

  const expectedChallenge = (await cookies()).get('webauthn_challenge')?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Sign-in expired — try again.' }, { status: 400 });
  }

  const body = await req.json();
  const credentialId = body?.response?.id;
  if (!credentialId) {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: stored, error: lookupError } = await admin
    .from('passkey_credentials')
    .select('*')
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (lookupError || !stored) {
    (await cookies()).delete('webauthn_challenge');
    return NextResponse.json({ error: 'Passkey not recognized.' }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: stored.credential_id,
        publicKey: isoBase64URL.toBuffer(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports || undefined,
      },
    });
  } catch (err) {
    (await cookies()).delete('webauthn_challenge');
    return NextResponse.json({ error: err.message || 'Verification failed.' }, { status: 400 });
  }

  (await cookies()).delete('webauthn_challenge');

  if (!verification.verified) {
    return NextResponse.json({ error: 'Could not verify passkey.' }, { status: 400 });
  }

  // Keep the replay-attack counter current, and note when this
  // credential was actually last used (shown in Settings so someone
  // can tell a stale/forgotten passkey from one they use regularly).
  await admin
    .from('passkey_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', stored.id);

  const { data: userData, error: userLookupError } = await admin.auth.admin.getUserById(stored.user_id);
  if (userLookupError || !userData?.user?.email) {
    return NextResponse.json({ error: 'Could not look up account.' }, { status: 500 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Could not sign in — try again.' }, { status: 500 });
  }

  // Only the short-lived one-time token goes back to the browser — not
  // the full action_link (which embeds the redirect URL and more than
  // the client actually needs) and nothing that could be replayed after
  // this one exchange.
  return NextResponse.json({ tokenHash: linkData.properties.hashed_token });
}
