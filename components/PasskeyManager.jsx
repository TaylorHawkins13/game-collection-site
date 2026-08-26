'use client';

import { useEffect, useState } from 'react';
import { startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { createClient } from '@/lib/supabaseClient';
import { announceToast } from '@/lib/toast';

// A guess at a friendly device label for a newly-added passkey — purely
// cosmetic (shown in the list so multiple passkeys are distinguishable),
// never relied on for anything security-relevant. Falls back to a
// generic label on browsers that don't expose enough of the user-agent
// to guess from.
function guessDeviceLabel() {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android device';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'This device';
}

export default function PasskeyManager() {
  const [supported, setSupported] = useState(null);
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('passkey_credentials')
        .select('id, nickname, created_at, last_used_at, device_type')
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setPasskeys(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    setAdding(true);
    try {
      const optionsRes = await fetch('/api/webauthn/register-options', { method: 'POST' });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error || 'Could not start passkey setup.');

      // Opens the OS's own Face ID/Touch ID/security-key prompt —
      // there's nothing to build UI for here, the browser owns this
      // entire step.
      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attResp, nickname: guessDeviceLabel() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Could not save passkey.');
      }

      announceToast('Passkey added.', 'success');
      const { data } = await supabase
        .from('passkey_credentials')
        .select('id, nickname, created_at, last_used_at, device_type')
        .order('created_at', { ascending: false });
      setPasskeys(data || []);
    } catch (err) {
      // NotAllowedError covers both "user cancelled the prompt" and a
      // couple of genuine failure modes the WebAuthn spec lumps
      // together — either way there's nothing actionable to say beyond
      // "didn't go through," so this doesn't try to guess which.
      if (err.name !== 'NotAllowedError') {
        announceToast(err.message || 'Could not add passkey.');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id) {
    setRemovingId(id);
    const { error } = await supabase.from('passkey_credentials').delete().eq('id', id);
    setRemovingId(null);
    if (error) {
      announceToast('Could not remove passkey.');
      return;
    }
    setPasskeys((list) => list.filter((p) => p.id !== id));
  }

  // Nothing to show while still checking support, and nothing to show
  // (not even an explanation) on a browser/device that genuinely can't
  // do this — same "just don't offer it" pattern used anywhere else on
  // the site a feature depends on something the visitor's setup may not
  // have.
  if (supported === null || supported === false) return null;

  return (
    <div>
      {loading ? (
        <p className="sub" style={{ margin: 0 }}>Loading…</p>
      ) : passkeys.length === 0 ? (
        <p className="sub" style={{ margin: '0 0 8px' }}>
          No passkeys yet — add one to sign in with Face ID, Touch ID, or your device's screen lock instead of typing your password.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px' }}>
          {passkeys.map((p) => (
            <li
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.nickname || 'Passkey'}</div>
                <div className="sub" style={{ margin: 0 }}>
                  Added {new Date(p.created_at).toLocaleDateString()}
                  {p.last_used_at ? ` · last used ${new Date(p.last_used_at).toLocaleDateString()}` : ' · never used yet'}
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleRemove(p.id)}
                disabled={removingId === p.id}
              >
                {removingId === p.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-ghost" onClick={handleAdd} disabled={adding}>
        {adding ? 'Waiting for Face ID / Touch ID…' : '+ Add a passkey'}
      </button>
    </div>
  );
}
