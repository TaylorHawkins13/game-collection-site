'use client';

import { useEffect, useState } from 'react';
import ChipInput from './ChipInput';
import BarcodeScanner from './BarcodeScanner';
import { currencySymbol } from '@/lib/currency';

const EMPTY = {
  item_type: 'game',
  title: '',
  platforms: [],
  genre: '',
  barcode: '',
  tags: [],
  cover: '',
  ownership: 'owned',
  condition: '',
  price: '',
  purchase_date: '',
  play_status: 'backlog',
  rating: 0,
  notes: '',
  series: '',
  issue_number: '',
  publisher: '',
  writer: '',
  artist: '',
  grade: '',
  is_variant: false,
  variant_notes: '',
  format: '',
  edition: '',
  card_set: '',
  card_number: '',
  player_name: '',
};

export default function GameModal({ game, currency, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchHint, setSearchHint] = useState('');
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (game) {
      setForm({
        item_type: game.item_type || 'game',
        title: game.title || '',
        platforms: game.platforms || [],
        genre: game.genre || '',
        barcode: game.barcode || '',
        tags: game.tags || [],
        cover: game.cover || '',
        ownership: game.ownership || 'owned',
        condition: game.condition || '',
        price: game.price ?? '',
        purchase_date: game.purchase_date || '',
        play_status: game.play_status || 'backlog',
        rating: game.rating || 0,
        notes: game.notes || '',
        series: game.series || '',
        issue_number: game.issue_number || '',
        publisher: game.publisher || '',
        writer: game.writer || '',
        artist: game.artist || '',
        grade: game.grade || '',
        is_variant: game.is_variant || false,
        variant_notes: game.variant_notes || '',
        format: game.format || '',
        edition: game.edition || '',
        card_set: game.card_set || '',
        card_number: game.card_number || '',
        player_name: game.player_name || '',
      });
    } else {
      setForm(EMPTY);
    }
    setSearchResults([]);
    setSearchHint('');
    setSaveError('');
  }, [game]);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  const isGame = form.item_type === 'game';
  const isComic = form.item_type === 'comic';
  const isCard = form.item_type === 'trading_card';
  const isVinyl = form.item_type === 'vinyl';
  const isBook = form.item_type === 'book';
  const isDvd = form.item_type === 'dvd';
  const isCd = form.item_type === 'cd';
  const isMediaLike = isBook || isDvd || isCd;

  const genrePlaceholder = isComic
    ? 'e.g. Superhero'
    : isCard
    ? 'e.g. Sports, TCG'
    : isVinyl
    ? 'e.g. Rock, Jazz'
    : isDvd
    ? 'e.g. Action, Drama'
    : isCd
    ? 'e.g. Rock, Hip-Hop'
    : isBook
    ? 'e.g. Fiction, Sci-Fi'
    : 'e.g. RPG';

  const mediaCreatorLabel = isDvd ? 'Director' : isCd ? 'Artist' : 'Author';
  const mediaPublisherLabel = isDvd ? 'Studio' : isCd ? 'Label' : 'Publisher';
  const mediaFormatPlaceholder = isDvd
    ? 'e.g. DVD, Blu-ray, 4K'
    : isCd
    ? 'e.g. CD, Digipak, Box Set'
    : 'e.g. Hardcover, Paperback, eBook';
  const mediaEditionPlaceholder = isDvd
    ? "e.g. Director's Cut, Extended"
    : isCd
    ? 'e.g. Deluxe Edition, Remaster'
    : 'e.g. 2nd Edition, Anniversary Edition';

  async function gameSearch() {
    if (!form.title.trim()) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/igdb-search?q=${encodeURIComponent(form.title.trim())}`);
      const data = await res.json();
      if (data.error === 'not_configured') {
        setSearchHint('Auto-fill is not configured on this site (no IGDB credentials set).');
        setSearchResults([]);
        return;
      }
      if (data.error) {
        setSearchHint('Search failed — try again in a moment.');
        setSearchResults([]);
        return;
      }
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No results found.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function applySearchResult(item) {
    set('title', item.name || form.title);
    set('cover', item.cover || form.cover);
    set('genre', (item.genres || []).join(', '));
    if (form.platforms.length === 0) {
      set('platforms', item.platforms || []);
    }
    setSearchResults([]);
    setSearchHint(`Filled from IGDB: ${item.name}`);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError('');
    const result = await onSave({
      ...form,
      title: form.title.trim(),
      price: form.price === '' ? null : parseFloat(form.price),
      purchase_date: form.purchase_date || null,
      // keep the fields that don't apply to this type cleared out
      platforms: isGame ? form.platforms : [],
      play_status: isGame ? form.play_status : 'backlog',
      condition: isComic ? '' : form.condition,
      series: isComic ? form.series : '',
      issue_number: isComic ? form.issue_number : '',
      publisher: isComic || isCard || isVinyl || isMediaLike ? form.publisher : '',
      writer: isComic || isMediaLike ? form.writer : '',
      artist: isComic || isVinyl ? form.artist : '',
      grade: isComic || isCard ? form.grade : '',
      is_variant: isComic || isCard ? form.is_variant : false,
      variant_notes: isComic || isCard ? form.variant_notes : '',
      format: isVinyl || isMediaLike ? form.format : '',
      edition: isVinyl || isMediaLike ? form.edition : '',
      card_set: isCard ? form.card_set : '',
      card_number: isCard ? form.card_number : '',
      player_name: isCard ? form.player_name : '',
    });
    setSaving(false);
    if (result?.error) {
      setSaveError(result.error);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{game ? 'Edit Item' : 'Add Item'}</h2>
        <div className="sub">
          {isGame ? 'Fill in the details, or search to auto-fill cover art & info.' : 'Fill in the details.'}
        </div>

        <div className="field">
          <label>Type</label>
          <select value={form.item_type} onChange={(e) => set('item_type', e.target.value)}>
            <option value="game">Video Game</option>
            <option value="comic">Comic</option>
            <option value="trading_card">Trading Card</option>
            <option value="vinyl">Vinyl Record</option>
            <option value="book">Book</option>
            <option value="dvd">DVD / Blu-ray</option>
            <option value="cd">CD</option>
          </select>
        </div>

        <div className="field">
          <label>Title</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={isComic ? 'e.g. Amazing Spider-Man' : isGame ? 'e.g. Chrono Trigger' : 'Title'}
              style={{ flex: 1 }}
            />
            {isGame && (
              <button type="button" className="btn-ghost" onClick={gameSearch} disabled={searching}>
                Search
              </button>
            )}
          </div>
          {isGame && searchHint && <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{searchHint}</div>}
          {isGame && searchResults.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: 'var(--card)' }}>
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => applySearchResult(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  {r.thumb && (
                    <img src={r.thumb} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div className="sub" style={{ margin: 0 }}>{r.year || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isGame && (
          <div className="field">
            <label>Platforms</label>
            <ChipInput value={form.platforms} onChange={(v) => set('platforms', v)} placeholder="Type a platform, press Enter" />
          </div>
        )}

        {isComic && (
          <>
            <div className="row2">
              <div className="field">
                <label>Series</label>
                <input type="text" value={form.series} onChange={(e) => set('series', e.target.value)} placeholder="e.g. Amazing Spider-Man" />
              </div>
              <div className="field">
                <label>Issue number</label>
                <input type="text" value={form.issue_number} onChange={(e) => set('issue_number', e.target.value)} placeholder="e.g. #300" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Publisher</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Marvel" />
              </div>
              <div className="field">
                <label>Grade</label>
                <input type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. 9.8 or Near Mint" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Writer</label>
                <input type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} />
              </div>
              <div className="field">
                <label>Artist</label>
                <input type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_variant}
                  onChange={(e) => set('is_variant', e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                This is a variant cover
              </label>
            </div>
            {form.is_variant && (
              <div className="field">
                <label>Variant details</label>
                <input
                  type="text"
                  value={form.variant_notes}
                  onChange={(e) => set('variant_notes', e.target.value)}
                  placeholder="e.g. 1:25 incentive, foil cover, retailer exclusive"
                />
              </div>
            )}
          </>
        )}

        {isCard && (
          <>
            <div className="row2">
              <div className="field">
                <label>Set / expansion</label>
                <input type="text" value={form.card_set} onChange={(e) => set('card_set', e.target.value)} placeholder="e.g. 2023 Topps Chrome" />
              </div>
              <div className="field">
                <label>Card number</label>
                <input type="text" value={form.card_number} onChange={(e) => set('card_number', e.target.value)} placeholder="e.g. #150" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Player / character</label>
                <input type="text" value={form.player_name} onChange={(e) => set('player_name', e.target.value)} />
              </div>
              <div className="field">
                <label>Manufacturer / brand</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Topps, Panini, Pokémon" />
              </div>
            </div>
            <div className="field">
              <label>Grade</label>
              <input type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. PSA 10, Raw" />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_variant}
                  onChange={(e) => set('is_variant', e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                This is a parallel / insert / special version
              </label>
            </div>
            {form.is_variant && (
              <div className="field">
                <label>Details</label>
                <input
                  type="text"
                  value={form.variant_notes}
                  onChange={(e) => set('variant_notes', e.target.value)}
                  placeholder="e.g. Gold refractor /50, silver prizm"
                />
              </div>
            )}
          </>
        )}

        {isVinyl && (
          <>
            <div className="row2">
              <div className="field">
                <label>Artist</label>
                <input type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} />
              </div>
              <div className="field">
                <label>Label</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Sub Pop" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Format</label>
                <input type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder='e.g. LP, 7", box set' />
              </div>
              <div className="field">
                <label>Edition / pressing</label>
                <input type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. 1st pressing, 180g reissue" />
              </div>
            </div>
          </>
        )}

        {isMediaLike && (
          <>
            <div className="row2">
              <div className="field">
                <label>{mediaCreatorLabel}</label>
                <input type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} />
              </div>
              <div className="field">
                <label>{mediaPublisherLabel}</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Format</label>
                <input type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder={mediaFormatPlaceholder} />
              </div>
              <div className="field">
                <label>Edition</label>
                <input type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder={mediaEditionPlaceholder} />
              </div>
            </div>
          </>
        )}

        <div className="row2">
          <div className="field">
            <label>Genre</label>
            <input type="text" value={form.genre} onChange={(e) => set('genre', e.target.value)} placeholder={genrePlaceholder} />
          </div>
          <div className="field">
            <label>Barcode / UPC</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-ghost" onClick={() => setScanning(true)}>
                Scan
              </button>
            </div>
          </div>
        </div>

        {scanning && (
          <BarcodeScanner
            onDetected={(code) => {
              set('barcode', code);
              setScanning(false);
            }}
            onClose={() => setScanning(false)}
          />
        )}

        <div className="field">
          <label>Tags</label>
          <ChipInput value={form.tags} onChange={(v) => set('tags', v)} placeholder="Type a tag, press Enter" />
        </div>

        <div className="field">
          <label>Cover image URL</label>
          <input type="url" value={form.cover} onChange={(e) => set('cover', e.target.value)} placeholder="https://…" />
        </div>

        <div className="row2">
          <div className="field">
            <label>Ownership status</label>
            <select value={form.ownership} onChange={(e) => set('ownership', e.target.value)}>
              <option value="owned">Owned</option>
              <option value="wishlist">Wishlist</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          {!isComic && (
            <div className="field">
              <label>Condition</label>
              <select value={form.condition} onChange={(e) => set('condition', e.target.value)}>
                <option value="">—</option>
                <option value="sealed">Sealed</option>
                <option value="mint">Mint</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          )}
        </div>

        <div className="row2">
          <div className="field">
            <label>Purchase price ({currencySymbol(currency)})</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="field">
            <label>Purchase date</label>
            <input type="date" value={form.purchase_date || ''} onChange={(e) => set('purchase_date', e.target.value)} />
          </div>
        </div>

        <div className="row2">
          {isGame && (
            <div className="field">
              <label>Play status</label>
              <select value={form.play_status} onChange={(e) => set('play_status', e.target.value)}>
                <option value="backlog">Backlog</option>
                <option value="playing">Playing</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
          )}
          <div className="field">
            <label>Rating</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={n <= form.rating ? 'filled' : ''}
                  onClick={() => set('rating', n === form.rating ? 0 : n)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering…" />
        </div>

        {saveError && <div className="error-text">Couldn't save: {saveError}</div>}

        <div className="modal-actions">
          {game ? (
            <button className="btn-danger" type="button" onClick={() => onDelete(game.id)}>
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="right">
            <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn-primary" type="button" onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
