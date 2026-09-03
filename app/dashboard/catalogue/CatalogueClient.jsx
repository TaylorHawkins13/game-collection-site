'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CONSOLES } from '@/lib/consoleList';
import { normalizeTitle } from '@/lib/duplicateCheck';
import { ownedTitleKeysForPlatform } from '@/lib/platformCatalogueMatch';

const PAGE_SIZE = 100;

// "Full physical-release catalogue per console" (ROADMAP.md) — pick a
// platform, see every main-release game IGDB has for it, greyed out
// except what's already logged for that system. Reuses SeriesGrid's
// `.franchise-*` CSS wholesale (same "grid of covers, greyscale unless
// owned" look already established for series/master-set views) rather
// than inventing new styling for what's visually the same idea — see
// app/globals.css's `.catalogue-grid` modifier, which just lifts the
// height cap SeriesGrid's small in-modal version needs.
//
// Unlike SeriesGrid, this doesn't fetch everything up front — a real
// platform's catalog (even restricted to main-game releases) can run
// into the thousands, and IGDB itself caps a single request at 500 rows —
// so pagination here is real offset/limit paging against the API on
// every "Show more", not a client-side slice of one big fetched array.
export default function CatalogueClient({ ownedGames, ownedPlatformIds }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlatform = searchParams.get('platform') || '';

  const [platformInput, setPlatformInput] = useState(initialPlatform);
  const [activePlatform, setActivePlatform] = useState(initialPlatform);
  const [resolvedName, setResolvedName] = useState('');
  const [resolvedId, setResolvedId] = useState(null);
  const [titleQuery, setTitleQuery] = useState('');
  const [games, setGames] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Guards against a slow earlier request (e.g. the initial platform
  // load) resolving after a newer one (a fast follow-up search keystroke)
  // and clobbering its results — same stale-response race every other
  // debounced search box in this codebase has to guard against.
  const requestIdRef = useRef(0);

  const ownedKeys = useMemo(
    () => ownedTitleKeysForPlatform(ownedGames, ownedPlatformIds, resolvedId, resolvedName || activePlatform),
    [ownedGames, ownedPlatformIds, resolvedId, resolvedName, activePlatform]
  );

  const fetchPage = useCallback(async (platformName, search, nextOffset, append) => {
    if (!platformName.trim()) return;
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        platform: platformName,
        offset: String(nextOffset),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/igdb-platform-catalogue?${params.toString()}`);
      const data = await res.json();
      if (myRequestId !== requestIdRef.current) return;

      if (data.error === 'not_configured') {
        setError("Game lookup isn't set up on this deployment yet (needs an IGDB API key — see README.md).");
        setGames([]);
        setHasMore(false);
        setResolvedId(null);
        return;
      }
      if (data.error === 'platform_not_found') {
        setError(`Couldn't find a platform matching "${platformName}" — try its full name, e.g. "PlayStation 2".`);
        setGames([]);
        setHasMore(false);
        setResolvedId(null);
        return;
      }
      if (data.error) {
        setError('Something went wrong looking that up — try again in a moment.');
        setGames([]);
        setHasMore(false);
        setResolvedId(null);
        return;
      }

      setResolvedName(data.platformName || platformName);
      setResolvedId(data.platformId ?? null);
      setGames((prev) => (append ? [...prev, ...data.games] : data.games));
      setHasMore(!!data.hasMore);
      setOffset(nextOffset);
    } catch {
      if (myRequestId === requestIdRef.current) {
        setError('Something went wrong looking that up — try again in a moment.');
      }
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // Auto-loads when the page is reached with ?platform= already set (the
  // "Browse by system" tile's "See full release list" link below).
  useEffect(() => {
    if (initialPlatform.trim()) {
      fetchPage(initialPlatform, '', 0, false);
    }
    // Intentionally only on mount — changing platform/search afterward is
    // handled by handlePlatformSubmit / the debounced search effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced title search within the current platform, same 400ms/reset-
  // to-first-page pattern the rest of the app's live-filter inputs use.
  useEffect(() => {
    if (!activePlatform.trim()) return;
    const timer = setTimeout(() => {
      fetchPage(activePlatform, titleQuery, 0, false);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleQuery]);

  function handlePlatformSubmit(e) {
    e.preventDefault();
    const next = platformInput.trim();
    if (!next) return;
    setActivePlatform(next);
    setTitleQuery('');
    router.replace(`/dashboard/catalogue?platform=${encodeURIComponent(next)}`);
    fetchPage(next, '', 0, false);
  }

  function handleShowMore() {
    fetchPage(activePlatform, titleQuery, offset + PAGE_SIZE, true);
  }

  const ownedCount = useMemo(
    () => games.filter((g) => ownedKeys.has(normalizeTitle(g.name))).length,
    [games, ownedKeys]
  );

  return (
    <main className="container" style={{ maxWidth: 820 }}>
      <div className="profile-header" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--fs-5xl)', margin: '0 0 4px' }}>Full release catalogue</h1>
          <p className="sub" style={{ margin: 0 }}>
            Pick a platform to see every main-release game IGDB has for it, greyed out except what you've logged for
            that system — useful for spotting real gaps in a platform you're actively completing.
          </p>
        </div>
      </div>

      <div className="form-card" style={{ marginTop: 16 }}>
        <form onSubmit={handlePlatformSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            list="catalogue-platform-options"
            value={platformInput}
            onChange={(e) => setPlatformInput(e.target.value)}
            placeholder="e.g. PlayStation 2"
            style={{ flex: '1 1 220px' }}
          />
          <datalist id="catalogue-platform-options">
            {CONSOLES.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
          <button type="submit" className="btn-primary" disabled={loading || !platformInput.trim()}>
            Browse
          </button>
        </form>

        {activePlatform && (
          <>
            <input
              type="text"
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              placeholder={`Search titles on ${resolvedName || activePlatform}…`}
              style={{ width: '100%', marginTop: 12 }}
            />

            {error && (
              <div className="sub" style={{ color: 'var(--danger)', marginTop: 12 }}>
                {error}
              </div>
            )}

            {!error && games.length > 0 && (
              <div className="sub" style={{ marginTop: 12 }}>
                {resolvedName || activePlatform} — {ownedCount} of {games.length}
                {hasMore ? '+' : ''} logged in your collection
              </div>
            )}

            {!error && !loading && games.length === 0 && (
              <div className="sub" style={{ marginTop: 12 }}>
                No results{titleQuery ? ` for "${titleQuery}"` : ''} on {resolvedName || activePlatform}.
              </div>
            )}

            <div className="franchise-grid catalogue-grid" style={{ marginTop: 12 }}>
              {games.map((g) => {
                const owned = ownedKeys.has(normalizeTitle(g.name));
                return (
                  <div key={g.id} className={`franchise-item${owned ? ' owned' : ''}`} title={g.name}>
                    {g.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.cover}
                        alt={g.name}
                        onError={(evt) => {
                          const placeholder = document.createElement('div');
                          placeholder.className = 'franchise-item-placeholder';
                          placeholder.textContent = (g.name || '?').slice(0, 1);
                          evt.currentTarget.replaceWith(placeholder);
                        }}
                      />
                    ) : (
                      <div className="franchise-item-placeholder">{(g.name || '?').slice(0, 1)}</div>
                    )}
                    <div className="franchise-item-name">
                      {g.name}
                      {g.year ? ` (${g.year})` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: 12 }}
                onClick={handleShowMore}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Show more'}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
