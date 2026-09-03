'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import useModalA11y from '@/lib/useModalA11y';

const BATCH_SIZE = 100;

const ERROR_MESSAGES = {
  not_configured: "Discogs import isn't set up on this site yet.",
  not_found: "Couldn't find a Discogs member with that username.",
  query_failed: "Couldn't reach Discogs — try again in a moment.",
  no_username: 'Type a Discogs username first.',
};

const ITEM_TYPE_LABELS = { vinyl: 'Vinyl', cd: 'CD' };

// Same overall shape as SteamImportModal.jsx (username-style lookup,
// picklist, batched insert), with one real structural difference: Steam
// import already knows whose library to fetch (the signed-in user's own
// saved SteamID64, set up once via "Log in with Steam"), so it loads
// straight into the picklist. Discogs has no equivalent per-app login
// flow to build here (see lib/discogsImport.js) — it just reads whatever
// public collection sits at a typed username, the same way visiting
// discogs.com/user/<name> would — so this starts with a plain username
// field instead of loading automatically.
export default function DiscogsImportModal({ userId, existingReleaseIds, onClose, onImported }) {
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importError, setImportError] = useState('');
  const [done, setDone] = useState(false);
  const modalRef = useModalA11y(onClose);

  async function handleLookup(e) {
    e.preventDefault();
    const name = username.trim();
    if (!name || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/discogs-collection?username=${encodeURIComponent(name)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setError(ERROR_MESSAGES[data.error] || "Couldn't load that collection.");
        setItems([]);
      } else {
        const newItems = (data.items || []).filter((it) => !existingReleaseIds.has(it.releaseId));
        newItems.sort((a, b) => a.title.localeCompare(b.title));
        setItems(newItems);
        setSelected(new Set(newItems.map((it) => it.releaseId)));
      }
    } catch {
      setError(ERROR_MESSAGES.query_failed);
      setItems([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? items.filter((it) => it.title.toLowerCase().includes(q) || it.artist.toLowerCase().includes(q))
      : items;
  }, [items, search]);

  function toggle(releaseId) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(releaseId)) next.delete(releaseId);
      else next.add(releaseId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((s) => new Set([...s, ...visible.map((it) => it.releaseId)]));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleImport() {
    const toImport = items.filter((it) => selected.has(it.releaseId));
    if (toImport.length === 0) return;
    setImporting(true);
    setImportError('');
    setProgress({ done: 0, total: toImport.length });
    const inserted = [];
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE).map((it) => ({
        title: it.title,
        item_type: it.itemType,
        artist: it.artist,
        publisher: it.label, // "label" is this app's vinyl/CD equivalent of publisher — see supabase-schema.sql
        format: it.format,
        ownership: 'owned',
        copy_type: 'physical',
        cover: it.cover,
        discogs_release_id: it.releaseId,
        user_id: userId,
      }));
      const { data, error: insertError } = await supabase.from('games').insert(batch).select();
      if (insertError) {
        setImportError(`Import stopped partway through: ${insertError.message}`);
        break;
      }
      if (data) inserted.push(...data);
      setProgress({ done: Math.min(i + BATCH_SIZE, toImport.length), total: toImport.length });
    }
    setImporting(false);
    setDone(true);
    if (inserted.length) onImported(inserted);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="discogs-import-modal-title">
        <h2 id="discogs-import-modal-title">Import from Discogs</h2>

        {!searched && !loading && (
          <form onSubmit={handleLookup}>
            <div className="sub" style={{ marginTop: 4, marginBottom: 10 }}>
              Type a Discogs username to pull in their Vinyl and CDs — works for any public collection, same as
              visiting their profile on discogs.com. Make sure your Discogs collection&apos;s privacy is set to
              Public first (Settings → Privacy on discogs.com) if you&apos;re importing your own.
            </div>
            <div className="field">
              <input
                type="text"
                placeholder="Discogs username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <div />
              <div className="right">
                <button className="btn-ghost" type="button" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={!username.trim()}>
                  Find collection
                </button>
              </div>
            </div>
          </form>
        )}

        {loading && <div className="sub">Loading that collection…</div>}

        {searched && !loading && error && (
          <>
            <div className="error-text">{error}</div>
            <div className="modal-actions">
              <div />
              <div className="right">
                <button className="btn-ghost" type="button" onClick={onClose}>
                  Close
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setSearched(false);
                    setError('');
                  }}
                >
                  Try another username
                </button>
              </div>
            </div>
          </>
        )}

        {searched && !loading && !error && items.length === 0 && !done && (
          <>
            <div className="sub">
              No new Vinyl or CDs found for <strong>{username}</strong>. If you were expecting some, make sure their
              Discogs collection privacy is set to <strong>Public</strong> — Discogs can&apos;t tell a genuinely
              empty collection apart from a hidden one — and everything already in your Shelf Life collection is
              skipped automatically. Other formats (Cassette, digital files, box sets) aren&apos;t imported — Shelf
              Life only has a place for Vinyl and CD today.
            </div>
            <div className="modal-actions">
              <div />
              <div className="right">
                <button className="btn-ghost" type="button" onClick={onClose}>
                  Close
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setSearched(false);
                    setError('');
                  }}
                >
                  Try another username
                </button>
              </div>
            </div>
          </>
        )}

        {searched && !loading && !error && items.length > 0 && !done && (
          <>
            <div className="sub" style={{ marginTop: 4 }}>
              {items.length} new item{items.length === 1 ? '' : 's'} found — pick which ones to add.
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={importing}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <button type="button" className="btn-ghost" onClick={selectAllVisible} disabled={importing}>
                Select all
              </button>
              <button type="button" className="btn-ghost" onClick={selectNone} disabled={importing}>
                Select none
              </button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 280, overflowY: 'auto' }}>
              {visible.map((it) => (
                <label
                  key={it.releaseId}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.releaseId)}
                    onChange={() => toggle(it.releaseId)}
                    style={{ width: 'auto' }}
                    disabled={importing}
                  />
                  <span style={{ flex: 1, fontSize: 'var(--fs-md)' }}>
                    {it.title}
                    {it.artist ? ` — ${it.artist}` : ''}
                  </span>
                  <span className="sub" style={{ margin: 0 }}>
                    {ITEM_TYPE_LABELS[it.itemType]}
                    {it.year ? ` · ${it.year}` : ''}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {importing && (
          // aria-live so a screen reader announces each batch as it completes —
          // same reasoning as SteamImportModal's progress readout.
          <div className="sub" style={{ marginTop: 8 }} role="status" aria-live="polite">
            Importing… {progress.done}/{progress.total}
          </div>
        )}

        {importError && <div className="error-text">{importError}</div>}
        {done && !importError && <div className="success-text">Imported successfully.</div>}

        {searched && !loading && !error && items.length > 0 && (
          <div className="modal-actions">
            <div />
            <div className="right">
              <button className="btn-ghost" type="button" onClick={onClose} disabled={importing}>
                {done ? 'Close' : 'Cancel'}
              </button>
              {!done && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing}
                >
                  {importing ? 'Importing…' : `Import ${selected.size || ''} item${selected.size === 1 ? '' : 's'}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
