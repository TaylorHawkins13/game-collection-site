import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { RP_ID, RP_NAME } from '@/lib/webauthnConfig';
import { checkWebauthnRateLimit } from '@/lib/webauthnRateLimit';

// Step 1 of "add a passkey": generates a random challenge + registration
// options for the browser's navigator.credentials.create() call. Requires
// an existing signed-in session — this is for adding a passkey to an
// account you're already logged into (via Settings), not for creating a
// brand-new account.
export async function POST(req) {
  // Being signed-in-only already rules out the account-enumeration angle
  // login-options doesn't have, but nothing stopped a signed-in session
  // from hammering this for cheap challenge generation either — same
  // shared budget as the sign-in routes. See ROADMAP.md "WebAuthn/passkey
  // API routes have no rate limiting".
  const { limited } = await checkWebauthnRateLimit(req);
  if (limited) {
    return NextResponse.json({ error: 'Too many attempts — wait a few minutes and try again.' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('passkey_credentials')
    .select('credential_id, transports')
    .eq('user_id', user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    // UTF-8 bytes of the Supabase user id — stable per user, well under
    // WebAuthn's 64-byte userHandle limit, and simple to reason about
    // (no manual hex/UUID byte-packing needed).
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.email || user.id,
    attestationType: 'none',
    // Stops someone registering the same physical authenticator twice
    // for one account.
    excludeCredentials: (existing || []).map((c) => ({
      id: c.credential_id,
      transports: c.transports || undefined,
    })),
    authenticatorSelection: {
      // Required for Face ID/Touch ID (platform authenticators) to
      // create a "discoverable" credential — without this, sign-in
      // can't work usernameless later, which is the whole point.
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  // The challenge has to be checked against what the browser actually
  // signed, so it's stashed in a short-lived httpOnly cookie between
  // this request and register-verify — never sent to the client as
  // readable data, never stored server-side beyond this one round trip.
  (await cookies()).set('webauthn_challenge', options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  return NextResponse.json(options);
}
