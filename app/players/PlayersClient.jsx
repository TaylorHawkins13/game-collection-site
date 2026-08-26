'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import ProfileCard from '@/components/ProfileCard';
import CollectibleCard from '@/components/CollectibleCard';

// Turns raw `games` rows (one per collector's own copy — see the RLS
// policy on that table, which already scopes this to public collectors'
// items plus the viewer's own) into one tile per distinct title+type,
// with a count of how many rows matched. Case-insensitive dedupe key so
// "Zelda" and "zelda" collapse into the same result.
// Fixed (Aug 2026 — closes the "Aggregate community rating shown per
// item" item flagged in ROADMAP.md): the collectible detail page already
// computed an avg rating (lib/collectibleDetail.js), but you had to click
// into a title to see it — nothing showed a crowd rating at a glance on
// the browse/search tile itself, the way Backloggd does. Same "only
// rated (>0) rows count" rule buildCollectibleDetail already uses, so
// the two don't drift into showing different numbers for the same title.
function dedupeCollectibles(rows) {
  const byKey = new Map();
  rows.forEach((r) => {
    const key = `${r.item_type}::${r.title.trim().toLowerCase()}`;
    const rating = Number(r.rating) || 0;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.cover && r.cover) existing.cover = r.cover;
      if (rating > 0) {
        existing.ratingSum += rating;
        existing.ratingCount += 1;
      }
    } else {
      byKey.set(key, {
        title: r.title.trim(),
        item_type: r.item_type,
        cover: r.cover,
        count: 1,
        ratingSum: rating > 0 ? rating : 0,
        ratingCount: rating > 0 ? 1 : 0,
      });
    }
  });
  return [...byKey.values()]
    .map((c) => ({ ...c, avgRating: c.ratingCount > 0 ? c.ratingSum / c.ratingCount : null }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export default function PlayersClient() {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [collectibles, setCollectibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  async function loadDefault() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(24);
    setResults(data || []);
    setCollectibles([]);
    setLoading(false);
  }

  useEffect(() => {
    loadDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      setHasSearched(false);
      loadDefault();
      return;
    }
    setLoading(true);
    setHasSearched(true);
    const [{ data: profileRows }, { data: itemRows }, igdbRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio')
        .eq('is_public', true)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .order('username', { ascending: true })
        .limit(40),
      // No explicit public/owner filter needed — the games table's own
      // RLS policy (readable if the profile is public, or it's yours)
      // already scopes this the same way the community-suggestions
      // search in GameModal.jsx relies on.
      supabase
        .from('games')
        .select('title, item_type, cover, rating')
        .ilike('title', `%${q}%`)
        .limit(150),
      // Same IGDB auto-fill search GameModal's "Search" button uses when
      // adding an item — reused here so a title nobody's logged yet still
      // turns up as a result instead of only ever surfacing already-owned
      // titles. Best-effort: if IGDB isn't configured on this deployment,
      // this just quietly contributes nothing.
      fetch(`/api/igdb-search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .catch(() => ({ results: [] })),
    ]);

    const localCollectibles = dedupeCollectibles(itemRows || []);
    const knownKeys = new Set(localCollectibles.map((c) => `${c.item_type}::${c.title.toLowerCase()}`));
    const uncollected = (igdbRes?.results || [])
      .filter((g) => g.name && !knownKeys.has(`game::${g.name.trim().toLowerCase()}`))
      .map((g) => ({ title: g.name.trim(), item_type: 'game', cover: g.thumb || g.cover || '', count: 0, avgRating: null }));

    setResults(profileRows || []);
    setCollectibles([...localCollectibles, ...uncollected].slice(0, 40));
    setLoading(false);
  }

  const noResults = results.length === 0 && collectibles.length === 0;

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Search</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Search public collectors by username or name, or a title anyone's logged in their collection.
      </p>

      <form onSubmit={runSearch} className="toolbar" style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search collectors or titles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <div className="sub">Loading…</div>
      ) : hasSearched && noResults ? (
        <div className="empty-state">
          <div>No collectors or collectibles found.</div>
        </div>
      ) : !hasSearched && results.length === 0 ? (
        <div className="empty-state">
          <div>No public collectors yet.</div>
        </div>
      ) : (
        <>
          {hasSearched && collectibles.length > 0 && (
            <>
              <div className="sub" style={{ marginBottom: 12 }}>Collectibles</div>
              <div className="grid" style={{ marginBottom: 32 }}>
                {collectibles.map((c) => (
                  <CollectibleCard key={`${c.item_type}::${c.title}`} item={c} />
                ))}
              </div>
            </>
          )}

          {!hasSearched && <div className="sub" style={{ marginBottom: 12 }}>Recently joined:</div>}
          {hasSearched && results.length > 0 && (
            <div className="sub" style={{ marginBottom: 12 }}>Collectors</div>
          )}
          {results.length > 0 && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {results.map((p) => (
                <ProfileCard key={p.id} profile={p} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
