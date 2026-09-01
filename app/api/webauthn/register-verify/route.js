import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { RP_ID, EXPECTED_ORIGIN } from '@/lib/webauthnConfig';
import { checkWebauthnRateLimit } from '@/lib/webauthnRateLimit';

// Step 2 of "add a passkey": verifies the browser's response to the
// options from register-options, and — only if that verification
// genuinely passes — stores the new credential.
export async function POST(req) {
  // Same shared budget as the other three WebAuthn routes — see
  // lib/webauthnRateLimit.js and ROADMAP.md "WebAuthn/passkey API routes
  // have no rate limiting".
  const { limited } = await checkWebauthnRateLimit(req);
  if (limited) {
    return NextResponse.json({ error: 'Too many attempts — wait a few minutes and try again.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const expectedChallenge = (await cookies()).get('webauthn_challenge')?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Registration expired — try again.' }, { status: 400 });
  }

  const body = await req.json();
  const { nickname } = body;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Verification failed.' }, { status: 400 });
  }

  (await cookies()).delete('webauthn_challenge');

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Could not verify passkey.' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // service-role client, not the session-scoped one — see
  // passkey-migration.sql for why normal users have no insert policy
  // on this table (a verified-server-side write is the whole point).
  const admin = createAdminClient();
  const { error: insertError } = await admin.from('passkey_credentials').insert({
    user_id: user.id,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || null,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    nickname: nickname || null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ verified: true });
}
