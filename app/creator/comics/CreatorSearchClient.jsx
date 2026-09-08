'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Debounce/race-guard shape mirrors CatalogueClient.jsx's own live-search
// effect (app/dashboard/catalogue/CatalogueClient.jsx) — a requestIdRef
// guard against a slow earlier response landing after a faster later one
// and clobbering it with stale results, same risk any debounced-typeahead
// search against a live API carries.
const DEBOUNCE_MS = 400;

export default function CreatorSearchClient() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/comic-creator-search?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        if (requestId !== requestIdRef.current) return; // a newer keystroke already superseded this
        if (!res.ok || data.error) {
          setError(
            data.error === 'not_configured'
              ? "Creator search isn't set up on this site yet."
              : "Couldn't search right now — try again in a moment."
          );
          setResults([]);
        } else {
          setError('');
          setResults(data.items || []);
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        setError("Couldn't search right now — try again in a moment.");
        setResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <div className="field" style={{ maxWidth: 420 }}>
        <input
          type="text"
          placeholder="Writer or artist name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && <div className="sub" style={{ marginTop: 12 }}>Searching…</div>}
      {!loading && error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
      {!loading && !error && searched && results.length === 0 && (
        <div className="sub" style={{ marginTop: 12 }}>No creators found for "{query.trim()}".</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map((r) => (
            <Link href={`/creator/comics/${r.id}`} key={r.id} className="feed-item" style={{ textDecoration: 'none' }}>
              <div className="avatar feed-item-avatar">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" />
                ) : (
                  (r.name || '?').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="feed-item-body">
                <div className="feed-item-name">{r.name}</div>
                <div className="sub feed-item-time">
                  {r.issueCount > 0 ? `${r.issueCount} issue${r.issueCount === 1 ? '' : 's'} on file` : 'Comic Vine profile'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
