'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

const TYPES = [
  { key: 'bug', label: 'Bug report' },
  { key: 'issue', label: 'Something’s not working right' },
  { key: 'suggestion', label: 'Feature suggestion' },
];

export default function FeedbackForm() {
  const [type, setType] = useState('suggestion');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const pathname = usePathname();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!message.trim()) {
      setError('Give a few details before sending.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email, message, pageUrl: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send that, try again in a bit.");
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <form className="form-card">
        <h1>Thanks!</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          That's been sent over. If you left an email, I'll follow up if I have questions or once it's fixed/shipped.
        </p>
      </form>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h1>Feedback</h1>
      <p className="sub">
        Found a bug, hit a snag, or have an idea for something Shelf Life should do? This goes straight to Taylor
        — no account needed.
      </p>

      <div className="field">
        <label htmlFor="feedback-type">What's this about?</label>
        <select id="feedback-type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="feedback-details">Details</label>
        <textarea
          id="feedback-details"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder={
            type === 'bug'
              ? "What happened, and what did you expect instead? Which page were you on?"
              : type === 'issue'
              ? 'What seemed off?'
              : "What would you like to see?"
          }
          required
        />
      </div>

      <div className="field">
        <label htmlFor="feedback-email">Your email (optional, if you want a reply)</label>
        <input id="feedback-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>

      {error && <div className="error-text">{error}</div>}

      <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
        {submitting ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
