'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { announceToast } from '@/lib/toast';
import { SITE_URL } from '@/lib/siteUrl';

// ROADMAP.md "Public read-only API / personal access tokens." Listing
// and revoking both go straight through the browser Supabase client —
// api_tokens' own RLS policies (api-tokens-migration.sql) already scope
// both to the signed-in owner, the same pattern PasskeyManager.jsx uses
// for passkey_credentials, so there's no reason to put a server route in
// front of either. Creation is the one exception (see handleCreate) —
// generating the actual secret has to happen server-side.
export default function ApiTokensClient({ initialTokens }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [justCreated, setJustCreated] = useState(null); // { token, name } — shown exactly once
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  async function handleCreate(e) {
    e.preventDefault();
    const label = name.trim();
    if (!label) return;
    setCreating(true);
    setJustCreated(null);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create token.');
      setJustCreated({ token: data.token, name: label });
      setTokens((list) => [data.created, ...list]);
      setName('');
    } catch (err) {
      announceToast(err.message || 'Could not create token.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id) {
    setRemovingId(id);
    const { error } = await supabase.from('api_tokens').delete().eq('id', id);
    setRemovingId(null);
    if (error) {
      announceToast('Could not revoke that token.');
      return;
    }
    setTokens((list) => list.filter((t) => t.id !== id));
    announceToast('Token revoked.', 'success');
  }

  async function copyToken() {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      announceToast("Couldn't copy — select and copy it manually.");
    }
  }

  return (
    <main className="container">
      <div className="profile-header" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--fs-5xl)', margin: '0 0 4px' }}>API Access</h1>
          <p className="sub" style={{ margin: 0 }}>
            Personal access tokens let a script, spreadsheet, or your own dashboard pull your collection directly — a
            read-only mirror of what you can already see about your own items, nothing new.
          </p>
        </div>
      </div>

      {justCreated && (
        <div className="form-card" style={{ margin: '20px 0', maxWidth: 'none', borderColor: 'var(--accent)' }}>
          <strong>"{justCreated.name}" created — copy it now.</strong>
          <p className="sub" style={{ margin: '4px 0 12px' }}>
            This is the only time the full token is shown. If you lose it, revoke this one and create a new one —
            there's no way to reveal it again.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code
              style={{
                flex: 1,
                display: 'block',
                padding: '10px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 'var(--fs-base)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {justCreated.token}
            </code>
            <button type="button" className="btn-primary" onClick={copyToken}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="form-card" style={{ margin: '20px 0', maxWidth: 'none' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', margin: '0 0 12px' }}>Your tokens</h2>
        {tokens.length === 0 ? (
          <p className="sub" style={{ margin: '0 0 12px' }}>No tokens yet — create one below to get started.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
            {tokens.map((t) => (
              <li
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>{t.name}</div>
                  <div className="sub" style={{ margin: 0 }}>
                    <code>{t.token_prefix}…</code> · created {new Date(t.created_at).toLocaleDateString()}
                    {t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleDateString()}` : ' · never used yet'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => handleRevoke(t.id)}
                  disabled={removingId === t.id}
                >
                  {removingId === t.id ? 'Revoking…' : 'Revoke'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What's this for? (e.g. 'My spreadsheet')"
            maxLength={60}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : '+ Create token'}
          </button>
        </form>
      </div>

      <div className="form-card" style={{ margin: '20px 0', maxWidth: 'none' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', margin: '0 0 12px' }}>How to use it</h2>
        <p className="sub" style={{ margin: '0 0 10px' }}>
          Send the token as a bearer token in the Authorization header. Two read-only endpoints, both scoped to
          whichever account the token belongs to:
        </p>
        <pre
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 'var(--fs-base)',
            overflowX: 'auto',
            margin: '0 0 10px',
          }}
        >{`curl -H "Authorization: Bearer sl_live_..." \\
  ${SITE_URL}/api/v1/me

curl -H "Authorization: Bearer sl_live_..." \\
  ${SITE_URL}/api/v1/collection

# optional filters:
curl -H "Authorization: Bearer sl_live_..." \\
  "${SITE_URL}/api/v1/collection?type=video_game&ownership=owned"`}</pre>
        <p className="sub" style={{ margin: 0 }}>
          Rate limited to 60 requests/minute per token. Revoking a token above takes effect immediately.
        </p>
      </div>
    </main>
  );
}
