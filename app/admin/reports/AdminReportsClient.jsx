'use client';

import { useState } from 'react';
import Link from 'next/link';

function reporterName(row) {
  return row.reporter?.display_name || row.reporter?.username || 'Unknown';
}

function TargetPreview({ report }) {
  const { target_type: type, target } = report;
  if (!target) {
    return <p className="sub" style={{ margin: 0 }}>{type === 'comment' ? 'Comment' : 'Profile'} no longer exists.</p>;
  }
  if (type === 'profile') {
    return (
      <p style={{ margin: 0 }}>
        <Link href={`/u/${target.username}`}>{target.display_name || target.username}</Link>
        <span className="sub"> — @{target.username}</span>
      </p>
    );
  }
  // Comment
  const authorName = target.author?.display_name || target.author?.username || 'Someone';
  return (
    <div>
      <p className="sub" style={{ margin: '0 0 4px' }}>
        Comment by {target.author?.username ? <Link href={`/u/${target.author.username}`}>{authorName}</Link> : authorName}
      </p>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>&ldquo;{target.body}&rdquo;</p>
    </div>
  );
}

export default function AdminReportsClient({ reports: initial, configured }) {
  const [reports, setReports] = useState(initial);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const open = reports.filter((r) => r.status === 'open');
  const handled = reports.filter((r) => r.status !== 'open');

  async function act(id, action) {
    setError('');
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That failed.');
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: action, reviewed_at: new Date().toISOString() } : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container">
      <div className="home-hub-greeting">
        <h1>Reports</h1>
        <p className="sub">{open.length} open. Filed via the "Report" link on comments and public profiles.</p>
      </div>

      {!configured ? (
        <p className="sub">
          Needs <code>SUPABASE_SERVICE_ROLE_KEY</code> set (see README step 7) — same requirement as the other admin
          pages.
        </p>
      ) : (
        <>
          {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

          {open.length === 0 ? (
            <p className="sub">Nothing open right now.</p>
          ) : (
            <div className="article-list">
              {open.map((r) => (
                <div className="article-card" key={r.id} style={{ cursor: 'default' }}>
                  <div className="article-card-meta">
                    <span className="category-pill">{r.target_type === 'comment' ? 'Comment' : 'Profile'}</span>
                    <span className="sub">
                      Reported by {reporterName(r)} &middot; {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <TargetPreview report={r} />
                  </div>
                  {r.reason && <p className="sub" style={{ marginTop: 10 }}>Reason: {r.reason}</p>}

                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, 'actioned')}
                    >
                      {busyId === r.id ? 'Working…' : 'Mark actioned'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, 'reviewed')}
                    >
                      Dismiss (reviewed, no action)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {handled.length > 0 && (
            <div className="home-articles" style={{ marginTop: 40 }}>
              <h2 className="home-section-heading">Already handled</h2>
              {handled.map((r) => (
                <div className="home-whatsnew-row" key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>
                    {r.target_type === 'comment' ? 'Comment' : 'Profile'} reported by {reporterName(r)}
                  </span>
                  <span className={`submission-status submission-status-${r.status === 'actioned' ? 'approved' : 'rejected'}`}>
                    {r.status === 'actioned' ? 'Actioned' : 'Reviewed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
