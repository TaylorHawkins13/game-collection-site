'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { findPossibleDuplicates } from '@/lib/duplicateCheck';
import { searchConsoles } from '@/lib/consoleList';
import { currencySymbol } from '@/lib/currency';

// "Quick add (search)" — a way to bulk-add items entirely in-app, with no
// spreadsheet and no barcode scanner needed: search the same auto-fill
// databases the single-item Add form already uses (IGDB, TCGdex/Scryfall,
// Comic Vine, Open Library, iTunes, MusicBrainz, or the local consoles
// list), pick a result, and it joins a batch instead of saving immediately.
// Search again for the next title, then add the whole batch at once. This
// is now the app's one bulk/quick-add path other than CSV import — it
// superseded "Scan multiple" (barcode-camera-driven, one insert per scan),
// which was removed once search-based auto-fill covered the same need
// with better coverage than a UPC database (see CHANGELOG.md). Field-
// mapping per result kind mirrors GameModal.jsx's applySearchResult()
// exactly, just building a full row object instead of calling set() on
// live form state. Each queued row also gets its own inline ownership/
// condition/completeness-or-price controls — fields no search source
// ever returns, so without them every batch-added item would silently
// land as "Owned," no condition, no price/completeness, with no chance
// to correct that before it saves.
const BATCH_SIZE = 100;

// Same platform-visibility gap as GameModal's own search dropdown: an
// IGDB game result's `platforms` array is what actually ends up in the
// saved item's Platforms field if you click it, but with nothing shown
// but a title and a year, there was no way to tell which platform(s) a
// given result covers before clicking — awkward for a title re-released
// across a decade of hardware. Capped at 3 named platforms plus a "+N
// more" tail rather than an unbounded list, since some long-running
// titles carry a dozen-plus platform tags.
function resultMeta(r) {
  if (r.platforms && r.platforms.length) {
    const shown = r.platforms.slice(0, 3).join(', ');
    const extra = r.platforms.length > 3 ? ` +${r.platforms.length - 3} more` : '';
    return [r.year, shown + extra].filter(Boolean).join(' · ');
  }
  return r.subtitle || r.year || '—';
}

const TYPE_OPTIONS = [
  { value: 'game', label: 'Video games' },
  { value: 'comic', label: 'Comics' },
  { value: 'trading_card', label: 'Trading cards' },
  { value: 'book', label: 'Books' },
  { value: 'dvd', label: 'DVDs / Blu-rays' },
  { value: 'vhs', label: 'VHS' },
  { value: 'cd', label: 'CDs' },
  { value: 'vinyl', label: 'Vinyl' },
  { value: 'console', label: 'Consoles' },
];

// Funko Pops have no live search backend (see ROADMAP.md — no free,
// actively-maintained per-line database exists), so they're left out of
// this list the same way GameModal's own Search button never shows for
// that type either.
const SEARCH_ENDPOINT = {
  game: '/api/igdb-search',
  trading_card: '/api/card-search',
  book: '/api/book-search',
  dvd: '/api/movie-search',
  vhs: '/api/movie-search',
  cd: '/api/music-search',
  vinyl: '/api/music-search',
  comic: '/api/comic-search',
};

export default function BulkSearchAddModal({ userId, currency, existingItems, onClose, onItemsAdded }) {
  const supabase = createClient();
  const [itemType, setItemType] = useState('game');
  const [started, setStarted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchHint, setSearchHint] = useState('');
  // { key, title, cover, row }[] — reviewed and removable before commit.
  const [queue, setQueue] = useState([]);
  // { title, cover, row, matchTitle } while a picked result looks like
  // something already in the collection OR already sitting in the queue.
  const [pendingDuplicate, setPendingDuplicate] = useState(null);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  async function runSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchHint('Searching…');
    setResults([]);
    try {
      if (itemType === 'console') {
        const list = searchConsoles(q).map((c) => ({
          kind: 'console',
          id: c.name,
          name: c.name,
          manufacturer: c.manufacturer,
          genre: c.genre,
          subtitle: c.manufacturer,
        }));
        setResults(list);
        setSearchHint(
          list.length ? `${list.length} result(s) — click one to add to the batch` : 'Not in the common-consoles list — try a different name.'
        );
        return;
      }
      const res = await fetch(`${SEARCH_ENDPOINT[itemType]}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error === 'not_configured') {
        setSearchHint('Auto-fill is not configured on this site.');
        return;
      }
      if (data.error) {
        setSearchHint('Search failed — try again in a moment.');
        return;
      }
      const list = data.results || [];
      setResults(list);
      setSearchHint(list.length ? `${list.length} result(s) — click one to add to the batch` : 'No matches found.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  async function buildRow(result) {
    const base = {
      user_id: userId,
      item_type: itemType,
      title: result.name || query,
      cover: result.cover || result.thumb || '',
      // None of these are ever returned by any search source — they're the
      // fields someone actually wants to set per item before it saves, not
      // auto-filled ones. Editable per row in the queue below (see
      // updateQueueField) before committing; not pulled from `result` at
      // all here since there's nothing to pull. Completeness only actually
      // shows in the queue UI for games/consoles (same gate GameModal's own
      // form uses), but every row gets the key regardless — same "always
      // present in the row shape, only conditionally rendered" pattern
      // GameModal's own save payload already follows.
      ownership: 'owned',
      condition: '',
      price: '',
      completeness: '',
    };
    if (result.kind === 'card') {
      return { ...base, card_set: result.set || '', card_number: result.number || '', publisher: result.publisher || '', player_name: result.player_name || '' };
    }
    if (result.kind === 'book') {
      return { ...base, writer: result.creator || '', publisher: result.publisher || '' };
    }
    if (result.kind === 'movie') {
      return { ...base, writer: result.creator || '', publisher: result.publisher || '', genre: result.genre || '' };
    }
    if (result.kind === 'console') {
      return { ...base, publisher: result.manufacturer || '', genre: result.genre || '' };
    }
    if (result.kind === 'music') {
      const row = { ...base, publisher: result.label || '', format: result.format || '' };
      if (itemType === 'vinyl') row.artist = result.artist || '';
      else row.writer = result.artist || '';
      return row;
    }
    if (result.kind === 'comic') {
      const row = { ...base, title: result.series || result.name || query, series: result.series || '', issue_number: result.issue_number || '' };
      try {
        const detailRes = await fetch(`/api/comic-detail?id=${encodeURIComponent(result.id)}`);
        const detail = await detailRes.json();
        if (detail.writer) row.writer = detail.writer;
        if (detail.artist) row.artist = detail.artist;
        if (detail.publisher) row.publisher = detail.publisher;
      } catch {
        // Writer/artist/publisher just stay blank, fillable by hand later —
        // same fallback the single-item form's comic search already has.
      }
      return row;
    }
    // game (default)
    return { ...base, genre: (result.genres || []).join(', '), platforms: result.platforms || [] };
  }

  async function selectResult(result) {
    setResults([]);
    setQuery('');
    setSearchHint('Adding…');
    const row = await buildRow(result);
    // Checked against the real collection AND everything already queued
    // this session — same "duplicate within the same batch" rule CSV
    // import uses, so searching (and re-picking) the same title twice
    // in one sitting gets caught too, not just repeats of what's already
    // saved.
    const matches = findPossibleDuplicates(row.title, itemType, [...(existingItems || []), ...queue.map((q) => q.row)]);
    setSearchHint('');
    if (matches.length) {
      setPendingDuplicate({ title: row.title, cover: row.cover, row, matchTitle: matches[0].title });
      return;
    }
    addToQueue(row);
  }

  function addToQueue(row) {
    setQueue((q) => [...q, { key: `${Date.now()}-${q.length}`, title: row.title, cover: row.cover, row }]);
  }

  function confirmAddDuplicate() {
    if (!pendingDuplicate) return;
    addToQueue(pendingDuplicate.row);
    setPendingDuplicate(null);
  }

  function skipDuplicate() {
    setPendingDuplicate(null);
  }

  function removeFromQueue(key) {
    setQueue((q) => q.filter((item) => item.key !== key));
  }

  // Lets ownership/condition/price be corrected per queued item before
  // commit — same fields GameModal's own form exposes for every type,
  // just inline here instead of behind a full form per item.
  function updateQueueField(key, field, value) {
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, row: { ...item.row, [field]: value } } : item)));
  }

  async function commitQueue() {
    if (queue.length === 0 || adding) return;
    setAdding(true);
    setError('');
    setProgress({ done: 0, total: queue.length });
    // Same '' → null convention GameModal's own save uses for price — an
    // empty numeric-column string fails the insert outright rather than
    // just meaning "no price set" the way it does for a text column.
    const rows = queue.map((q) => ({ ...q.row, price: q.row.price === '' ? null : parseFloat(q.row.price) }));
    const inserted = [];
    let hadError = false;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error: insertError } = await supabase.from('games').insert(batch).select();
      if (insertError) {
        setError(`Stopped partway through: ${insertError.message} — whatever was added below is safe, try the rest again.`);
        hadError = true;
        break;
      }
      if (data) inserted.push(...data);
      setProgress({ done: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
    }
    setAdding(false);
    if (inserted.length) {
      onItemsAdded(inserted);
      // Drop only the ones that actually made it in (insert order matches
      // queue order) so a partial failure leaves the remainder in place
      // to retry, instead of silently losing track of what's still
      // pending.
      setQueue((q) => q.slice(inserted.length));
    }
    if (!hadError) onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2>Quick add (search)</h2>
        <div className="sub">
          {started
            ? 'Search a title, pick the right result, repeat — then add everything at once. No spreadsheet, no barcode needed.'
            : "Pick what you're adding, then start searching."}
        </div>

        {!started ? (
          <>
            <div className="field">
              <label htmlFor="bulk-search-item-type">Item type</label>
              <select id="bulk-search-item-type" value={itemType} onChange={(e) => setItemType(e.target.value)}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <div />
              <div className="right">
                <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
                <button className="btn-primary" type="button" onClick={() => setStarted(true)}>Start searching</button>
              </div>
            </div>
          </>
        ) : (
          <>
            {pendingDuplicate ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span className="sub" style={{ margin: 0 }}>
                  You might already have this: <strong>{pendingDuplicate.title}</strong> looks like &ldquo;{pendingDuplicate.matchTitle}&rdquo;
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" type="button" onClick={skipDuplicate}>Skip</button>
                  <button className="btn-primary" type="button" onClick={confirmAddDuplicate}>Add anyway</button>
                </div>
              </div>
            ) : (
              <form onSubmit={runSearch}>
                <label htmlFor="bulk-search-query" className="sub" style={{ display: 'block', marginBottom: 4 }}>
                  Search a title
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="bulk-search-query"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Chrono Trigger"
                    autoFocus
                    disabled={adding}
                  />
                  <button type="submit" className="btn-ghost" disabled={searching || adding}>Search</button>
                </div>
              </form>
            )}

            {searchHint && !pendingDuplicate && (
              <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{searchHint}</div>
            )}

            {!pendingDuplicate && results.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', background: 'var(--card)' }}>
                {results.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => selectResult(r)}
                    style={{ display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    {(r.thumb || r.cover) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumb || r.cover} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                      <div className="sub" style={{ margin: 0 }}>{resultMeta(r)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div className="sub" style={{ margin: '0 0 6px' }}>
                {queue.length === 0 ? 'Nothing queued yet.' : `${queue.length} item${queue.length === 1 ? '' : 's'} ready to add`}
              </div>
              {queue.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {queue.map((item) => (
                    <div key={item.key} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {item.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.cover} alt="" style={{ width: 26, height: 34, objectFit: 'cover', borderRadius: 3 }} />
                        )}
                        <div style={{ flex: 1, fontSize: 13 }}>{item.title}</div>
                        <button
                          type="button"
                          className="btn-ghost"
                          aria-label={`Remove ${item.title} from the batch`}
                          onClick={() => removeFromQueue(item.key)}
                          disabled={adding}
                          style={{ padding: '2px 8px' }}
                        >
                          ×
                        </button>
                      </div>
                      {/* Ownership/condition, plus either Completeness or Price
                          depending on item type — the fields no search source
                          fills in, so they need a place to be set (or left as
                          the "Owned"/blank defaults) before this row commits.
                          Completeness replaces Price for games/consoles (same
                          isGame||isConsole gate GameModal's own form uses for
                          that field) since it's the more useful thing to set
                          right away for those two types; Price still applies
                          to everything else. Deliberately just these fields,
                          not every field the full Add form has — Platforms
                          already comes back from search for games, and
                          anything else is still reachable afterward via Edit
                          on the saved item. */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingLeft: item.cover ? 36 : 0 }}>
                        <select
                          aria-label={`Ownership for ${item.title}`}
                          value={item.row.ownership}
                          onChange={(e) => updateQueueField(item.key, 'ownership', e.target.value)}
                          disabled={adding}
                          style={{ fontSize: 12, padding: '3px 6px' }}
                        >
                          <option value="owned">Owned</option>
                          <option value="wishlist">Wishlist</option>
                          <option value="sold">Sold</option>
                        </select>
                        {itemType !== 'comic' && (
                          <select
                            aria-label={`Condition for ${item.title}`}
                            value={item.row.condition}
                            onChange={(e) => updateQueueField(item.key, 'condition', e.target.value)}
                            disabled={adding}
                            style={{ fontSize: 12, padding: '3px 6px' }}
                          >
                            <option value="">Condition —</option>
                            <option value="sealed">Sealed</option>
                            <option value="mint">Mint</option>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="poor">Poor</option>
                          </select>
                        )}
                        {itemType === 'game' || itemType === 'console' ? (
                          <select
                            aria-label={`Completeness for ${item.title}`}
                            value={item.row.completeness}
                            onChange={(e) => updateQueueField(item.key, 'completeness', e.target.value)}
                            disabled={adding}
                            style={{ fontSize: 12, padding: '3px 6px' }}
                          >
                            <option value="">Completeness —</option>
                            <option value="loose">{itemType === 'console' ? 'Loose (unit only)' : 'Loose (cart/disc only)'}</option>
                            <option value="no_manual">CIB minus manual</option>
                            <option value="cib">CIB (complete in box)</option>
                            <option value="box_only">Box only</option>
                          </select>
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            aria-label={`Purchase price for ${item.title}, in ${currencySymbol(currency)}`}
                            placeholder={`Price (${currencySymbol(currency)})`}
                            value={item.row.price}
                            onChange={(e) => updateQueueField(item.key, 'price', e.target.value)}
                            disabled={adding}
                            style={{ fontSize: 12, padding: '3px 6px', width: 90 }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="sub" style={{ color: '#e5484d', marginTop: 8 }}>{error}</div>}
            {adding && progress && (
              <div className="sub" style={{ marginTop: 8 }} role="status" aria-live="polite">
                Adding… {progress.done}/{progress.total}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={onClose} disabled={adding}>
                {queue.length > 0 ? 'Cancel (discards batch)' : 'Close'}
              </button>
              <button className="btn-primary" type="button" onClick={commitQueue} disabled={queue.length === 0 || adding}>
                {adding ? 'Adding…' : `Add ${queue.length || ''} item${queue.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
