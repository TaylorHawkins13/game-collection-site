'use client';

import { useState } from 'react';
import StarRating from '@/components/StarRating';

function submitterName(row) {
  return row.profile?.display_name || row.profile?.username || 'Unknown';
}

export default function AdminArticlesClient({ submissions: initial }) {
  const [submissions, setSubmissions] = useState(initial);
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const pending = submissions.filter((s) => s.status === 'pending');
  const decided = submissions.filter((s) => s.status !== 'pending');

  async function act(id, action) {
    setError('');
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That failed.');
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: action === 'approve' ? 'approved' : 'rejected' } : s))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container">
      <div className="home-hub-greeting">
        <h1>Article submissions</h1>
        <p className="sub">
          {pending.length} pending. Approving a submission publishes it immediately at /articles under the
          submitter's name.
        </p>
      </div>

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {pending.length === 0 ? (
        <p className="sub">Nothing waiting on review.</p>
      ) : (
        <div className="article-list">
          {pending.map((s) => (
            <div className="article-card" key={s.id} style={{ cursor: 'default' }}>
              <div className="article-card-meta">
                <span className="category-pill">{s.type === 'review' ? 'Review' : 'Article'}</span>
                <span className="sub">
                  {submitterName(s)} &middot; {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
              <h2 className="article-card-title">{s.title}</h2>
              <p className="article-card-dek">{s.dek}</p>
              {s.type === 'review' && s.rating != null && (
                <div className="article-card-rating">
                  <StarRating value={s.rating} size={16} />
                </div>
              )}

              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                {expanded === s.id ? 'Hide full text' : 'Read full text'}
              </button>
              {expanded === s.id && (
                <div className="article-body" style={{ marginTop: 12 }}>
                  {s.body.split(/\n\s*\n/).map((p, i) => (
                    <p key={i}>{p.trim()}</p>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === s.id}
                  onClick={() => act(s.id, 'approve')}
                >
                  {busyId === s.id ? 'Working…' : 'Approve & publish'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busyId === s.id}
                  onClick={() => act(s.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="home-articles" style={{ marginTop: 40 }}>
          <h2 className="home-section-heading">Already decided</h2>
          {decided.map((s) => (
            <div className="home-whatsnew-row" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{s.title} <span className="sub">— {submitterName(s)}</span></span>
              <span className={`submission-status submission-status-${s.status}`}>
                {s.status === 'approved' ? 'Published' : 'Rejected'}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
