'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

const BATCH_SIZE = 100;

const ERROR_MESSAGES = {
  not_connected: 'Connect your Steam account first (Profile settings → Connected accounts).',
  not_configured: "Steam import isn't set up on this site yet.",
  fetch_failed: "Couldn't reach Steam — try again in a moment.",
};

export default function SteamImportModal({ userId, existingAppIds, onClose, onImported }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [games, setGames] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importError, setImportError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/steam-games')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) {
          setError(ERROR_MESSAGES[data.error] || "Couldn't load your Steam library.");
          return;
        }
        const newGames = (data.games || []).filter((g) => !existingAppIds.has(g.appid));
        newGames.sort((a, b) => a.name.localeCompare(b.name));
        setGames(newGames);
        setSelected(new Set(newGames.map((g) => g.appid)));
      })
      .catch(() => {
        if (active) setError(ERROR_MESSAGES.fetch_failed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? games.filter((g) => g.name.toLowerCase().includes(q)) : games;
  }, [games, search]);

  function toggle(appid) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(appid)) next.delete(appid);
      else next.add(appid);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((s) => new Set([...s, ...visible.map((g) => g.appid)]));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleImport() {
    const toImport = games.filter((g) => selected.has(g.appid));
    if (toImport.length === 0) return;
    setImporting(true);
    setImportError('');
    setProgress({ done: 0, total: toImport.length });
    const inserted = [];
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE).map((g) => ({
        title: g.name,
        item_type: 'game',
        platforms: ['PC'],
        ownership: 'owned',
        copy_type: 'digital',
        cover: g.cover,
        steam_appid: g.appid,
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
      <div className="modal">
        <h2>Import from Steam</h2>

        {loading && <div className="sub">Loading your Steam library…</div>}

        {!loading && error && (
          <>
            <div className="error-text">{error}</div>
          </>
        )}

        {!loading && !error && games.length === 0 && !done && (
          <div className="sub">
            No new games found. If you were expecting some, make sure your Steam profile's{' '}
            <strong>Game details</strong> privacy setting is set to <strong>Public</strong> — go to your Steam
            profile → Edit Profile → Privacy Settings — otherwise Steam won't hand over your library, and
            everything else already in your collection is skipped automatically.
          </div>
        )}

        {!loading && !error && games.length > 0 && !done && (
          <>
            <div className="sub" style={{ marginTop: 4 }}>
              {games.length} new game{games.length === 1 ? '' : 's'} found — pick which ones to add.
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
              {visible.map((g) => (
                <label
                  key={g.appid}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.appid)}
                    onChange={() => toggle(g.appid)}
                    style={{ width: 'auto' }}
                    disabled={importing}
                  />
                  <span style={{ flex: 1, fontSize: 13.5 }}>{g.name}</span>
                  {g.playtime_forever > 0 && (
                    <span className="sub" style={{ margin: 0 }}>{Math.round(g.playtime_forever / 60)} hrs</span>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        {importing && (
          <div className="sub" style={{ marginTop: 8 }}>
            Importing… {progress.done}/{progress.total}
          </div>
        )}

        {importError && <div className="error-text">{importError}</div>}
        {done && !importError && <div className="success-text">Imported successfully.</div>}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={onClose} disabled={importing}>
              {done ? 'Close' : 'Cancel'}
            </button>
            {!loading && !error && games.length > 0 && !done && (
              <button
                className="btn-primary"
                type="button"
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
              >
                {importing ? 'Importing…' : `Import ${selected.size || ''} game${selected.size === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
