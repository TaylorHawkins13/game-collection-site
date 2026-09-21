'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Debounce/race-guard shape mirrors CreatorSearchClient.jsx
// (app/creator/comics) exactly — same live-search-against-a-real-API
// pattern, just pointed at /api/igdb-company-search instead of
// /api/comic-creator-search. A requestIdRef guard against a slow earlier
// response landing after a faster later one and clobbering it with stale
// results, same risk any debounced-typeahead search carries.
const DEBOUNCE_MS = 400;

export default function CompanySearchClient() {
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
        const res = await fetch(`/api/igdb-company-search?q=${encodeURIComponent(q)}`);
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
          placeholder="Developer or publisher name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && <div className="sub" style={{ marginTop: 12 }}>Searching…</div>}
      {!loading && error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
      {!loading && !error && searched && results.length === 0 && (
        <div className="sub" style={{ marginTop: 12 }}>No companies found for "{query.trim()}".</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map((r) => (
            <Link href={`/creator/games/${r.id}`} key={r.id} className="feed-item" style={{ textDecoration: 'none' }}>
              <div className="avatar feed-item-avatar">
                {r.logo ? (
                  <Image src={r.logo} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
                ) : (
                  (r.name || '?').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="feed-item-body">
                <div className="feed-item-name">{r.name}</div>
                <div className="sub feed-item-time">IGDB company profile</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
