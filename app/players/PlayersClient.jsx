'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import ProfileCard from '@/components/ProfileCard';

export default function PlayersClient() {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
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
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('is_public', true)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .order('username', { ascending: true })
      .limit(40);
    setResults(data || []);
    setLoading(false);
  }

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Find Collectors</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Search public profiles by username or display name.
      </p>

      <form onSubmit={runSearch} className="toolbar" style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search by username or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <div className="sub">Loading…</div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <div>{hasSearched ? 'No collectors found.' : 'No public collectors yet.'}</div>
        </div>
      ) : (
        <>
          {!hasSearched && <div className="sub" style={{ marginBottom: 12 }}>Recently joined:</div>}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {results.map((p) => (
              <ProfileCard key={p.id} profile={p} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
