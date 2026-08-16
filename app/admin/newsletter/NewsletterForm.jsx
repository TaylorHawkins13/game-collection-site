'use client';

import { useState } from 'react';

export default function NewsletterForm({ optedInCount, totalCount }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  // Off by default — the normal path stays opted-in-only. This is an
  // explicit, deliberate override for a one-off announcement (see the
  // route's comment), not something to leave ticked as a habit.
  const [sendToAll, setSendToAll] = useState(false);
  // Off by default — plain text is the normal, simple path. Turn this on
  // only when pasting a full HTML email (images, formatting) rather than
  // a quick text update.
  const [isHtml, setIsHtml] = useState(false);

  const recipientCount = sendToAll ? totalCount : optedInCount;

  async function handleSend() {
    setConfirming(false);
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, sendToAll, isHtml }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed.');
      setResult({ ok: true, count: data.count });
      setSubject('');
      setBody('');
      setSendToAll(false);
      setIsHtml(false);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  }

  const canSend = subject.trim() && body.trim() && recipientCount > 0;

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
          {optedInCount} collector{optedInCount === 1 ? '' : 's'} opted in, {totalCount} account{totalCount === 1 ? '' : 's'} total.
          This sends once, right now — review before hitting send, there's no draft/schedule step.
        </p>

        <div className="field">
          <label htmlFor="newsletter-subject">Subject</label>
          <input id="newsletter-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's new on Shelf Life" />
        </div>
        <div className="field">
          <label htmlFor="newsletter-body">Body</label>
          <textarea
            id="newsletter-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={
              isHtml
                ? 'Paste the full HTML email here.'
                : "Plain text — one or two things that shipped, and why they matter."
            }
          />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={isHtml}
              onChange={(e) => setIsHtml(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            This body is HTML (images/formatting)
          </label>
          <p className="sub" style={{ margin: '4px 0 0' }}>
            Off sends the box above as plain text (the normal case). On treats it as a full HTML email
            instead — for something with images or real formatting.
          </p>
        </div>

        {isHtml && body.trim() && (
          <div className="field">
            <label>Preview</label>
            <div
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#fff', maxHeight: 420, overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </div>
        )}

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={sendToAll}
              onChange={(e) => setSendToAll(e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Send to everyone, not just opted-in ({totalCount} total)
          </label>
          <p className="sub" style={{ margin: '4px 0 0' }}>
            For a one-off announcement, not a habit — leave this off for routine updates so it only ever
            reaches people who actually asked for them.
          </p>
        </div>

        {result?.ok && (
          <div className="success-text">Sent to {result.count} recipient{result.count === 1 ? '' : 's'}.</div>
        )}
        {result && !result.ok && <div className="error-text">{result.error}</div>}

        {!confirming ? (
          <button className="btn-primary" type="submit" disabled={!canSend || sending} style={{ width: '100%', marginTop: 8 }}>
            {recipientCount === 0 ? 'No one to send to' : 'Review & send'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSend} disabled={sending} style={{ flex: 1 }}>
              {sending
                ? 'Sending…'
                : sendToAll
                ? `Send to all ${recipientCount} now`
                : `Send to ${recipientCount} now`}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
