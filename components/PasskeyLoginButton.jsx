'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { createClient } from '@/lib/supabaseClient';

export default function PasskeyLoginButton() {
  const [supported, setSupported] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const webauthnOk = browserSupportsWebAuthn();
      const platformOk = webauthnOk && (await platformAuthenticatorIsAvailable().catch(() => false));
      if (!cancelled) setSupported(webauthnOk && platformOk);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleClick() {
    setError('');
    setBusy(true);
    try {
      const optionsRes = await fetch('/api/webauthn/login-options', { method: 'POST' });
      if (!optionsRes.ok) throw new Error('Could not start sign-in.');
      const options = await optionsRes.json();

      // No email typed in first — the OS shows whatever passkeys it
      // already has saved for this site and lets the person pick.
      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.tokenHash) {
        throw new Error(verifyData.error || 'Could not sign in with that passkey.');
      }

      // This is the step that actually writes the session — see the
      // long comment in app/api/webauthn/login-verify/route.js for why
      // it has to happen here, client-side, rather than on the server.
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.tokenHash,
        type: 'magiclink',
      });
      if (otpError) throw new Error(otpError.message);

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Could not sign in with a passkey.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (supported === null || supported === false) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn-ghost" style={{ width: '100%' }} onClick={handleClick} disabled={busy}>
        {busy ? 'Waiting for Face ID / Touch ID…' : 'Sign in with a passkey'}
      </button>
      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
