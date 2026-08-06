'use client';

import { useState } from 'react';

export default function NewsletterForm({ optedInCount }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  async function handleSend() {
    setConfirming(false);
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed.');
      setResult({ ok: true, count: data.count });
      setSubject('');
      setBody('');
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  const canSend = subject.trim() && body.trim() && optedInCount > 0;

  return (
    <main className="container">
      <form
        className="form-card"
        style={{ maxWidth: 560 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) setConfirming(true);
        }}
      >
        <h1>New-feature newsletter</h1>
        <p className="sub">
          {optedInCount} collector{optedInCount === 1 ? '' : 's'} opted in. This sends once, right now, to
          everyone opted in — review before hitting send, there's no draft/schedule step.
        </p>

        <div className="field">
          <label>Subject</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's new on Shelf Life" />
        </div>
        <div className="field">
          <label>Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Plain text — one or two things that shipped, and why they matter."
          />
        </div>

        {result?.ok && (
          <div className="success-text">Sent to {result.count} recipient{result.count === 1 ? '' : 's'}.</div>
        )}
        {result && !result.ok && <div className="error-text">{result.error}</div>}

        {!confirming ? (
          <button className="btn-primary" type="submit" disabled={!canSend || sending} style={{ width: '100%', marginTop: 8 }}>
            {optedInCount === 0 ? 'No one opted in yet' : 'Review & send'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSend} disabled={sending} style={{ flex: 1 }}>
              {sending ? 'Sending…' : `Send to ${optedInCount} now`}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
