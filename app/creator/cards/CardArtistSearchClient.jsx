'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Same debounce/race-guard shape as app/creator/comics/CreatorSearchClient.jsx
// (itself mirroring CatalogueClient.jsx's live-search effect) — a
// requestIdRef guard against a slow earlier response landing after a
// faster later one and clobbering it with stale results.
const DEBOUNCE_MS = 400;

// No avatar/image here (unlike the comics creator search) — neither
// Scryfall's artist-names catalog nor TCGdex's illustrators catalog
// carries a portrait or a work count, just the bare name, so each result
// row is plainer than comics' — name plus which game it's from.
export default function CardArtistSearchClient() {
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
        const res = await fetch(`/api/card-creator-search?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        if (requestId !== requestIdRef.current) return;
        if (!res.ok || data.error) {
          setError("Couldn't search right now — try again in a moment.");
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
          placeholder="Illustrator name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading && <div className="sub" style={{ marginTop: 12 }}>Searching…</div>}
      {!loading && error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
      {!loading && !error && searched && results.length === 0 && (
        <div className="sub" style={{ marginTop: 12 }}>No illustrators found for "{query.trim()}".</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map((r) => (
            <Link
              href={`/creator/cards/${r.game}/${encodeURIComponent(r.name)}`}
              key={`${r.game}-${r.name}`}
              className="feed-item"
              style={{ textDecoration: 'none' }}
            >
              <div className="avatar feed-item-avatar">{(r.name || '?').slice(0, 1).toUpperCase()}</div>
              <div className="feed-item-body">
                <div className="feed-item-name">{r.name}</div>
                <div className="sub feed-item-time">{r.gameLabel}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
