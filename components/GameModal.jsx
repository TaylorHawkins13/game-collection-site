'use client';

import { useEffect, useState } from 'react';
import ChipInput from './ChipInput';
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
  media_kind: 'book',
};

export default function GameModal({ game, currency, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [rawgResults, setRawgResults] = useState([]);
  const [rawgHint, setRawgHint] = useState('');
  const [searching, setSearching] = useState(false);

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
        media_kind: game.media_kind || 'book',
      });
    } else {
      setForm(EMPTY);
    }
    setRawgResults([]);
    setRawgHint('');
    setSaveError('');
  }, [game]);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  const isGame = form.item_type === 'game';
  const isComic = form.item_type === 'comic';
  const isCard = form.item_type === 'trading_card';
  const isVinyl = form.item_type === 'vinyl';
  const isMedia = form.item_type === 'media';

  const genrePlaceholder = isComic
    ? 'e.g. Superhero'
    : isCard
    ? 'e.g. Sports, TCG'
    : isVinyl
    ? 'e.g. Rock, Jazz'
    : isMedia
    ? 'e.g. Fiction, Sci-Fi'
    : 'e.g. RPG';

  const mediaCreatorLabel = form.media_kind === 'dvd' ? 'Director' : form.media_kind === 'cd' ? 'Artist' : 'Author';

  async function rawgSearch() {
    if (!form.title.trim()) return;
    const apiKey = process.env.NEXT_PUBLIC_RAWG_API_KEY;
    if (!apiKey) {
      setRawgHint('Auto-fill is not configured on this site (no RAWG API key set).');
      return;
    }
    setSearching(true);
    setRawgHint('Searching…');
    try {
      const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(apiKey)}&search=${encodeURIComponent(form.title.trim())}&page_size=8`;
      const res = await fetch(url);
      const data = await res.json();
      const list = data.results || [];
      setRawgResults(list);
      setRawgHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No results found.');
    } catch {
      setRawgHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function applyRawgResult(item) {
    set('title', item.name || form.title);
    set('cover', item.background_image || form.cover);
    set('genre', (item.genres || []).map((g) => g.name).join(', '));
    if (form.platforms.length === 0) {
      set('platforms', (item.platforms || []).map((p) => p.platform.name));
    }
    setRawgResults([]);
    setRawgHint(`Filled from RAWG: ${item.name}`);
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
      publisher: isComic || isCard || isVinyl || isMedia ? form.publisher : '',
      writer: isComic || isMedia ? form.writer : '',
      artist: isComic || isVinyl ? form.artist : '',
      grade: isComic || isCard ? form.grade : '',
      is_variant: isComic || isCard ? form.is_variant : false,
      variant_notes: isComic || isCard ? form.variant_notes : '',
      format: isVinyl || isMedia ? form.format : '',
      edition: isVinyl || isMedia ? form.edition : '',
      card_set: isCard ? form.card_set : '',
      card_number: isCard ? form.card_number : '',
      player_name: isCard ? form.player_name : '',
      media_kind: isMedia ? form.media_kind : '',
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
          {isGame ? 'Fill in the details, or search RAWG to auto-fill cover art & info.' : 'Fill in the details.'}
        </div>

        <div className="field">
          <label>Type</label>
          <select value={form.item_type} onChange={(e) => set('item_type', e.target.value)}>
            <option value="game">Video Game</option>
            <option value="comic">Comic</option>
            <option value="trading_card">Trading Card</option>
            <option value="vinyl">Vinyl Record</option>
            <option value="media">Book / DVD / CD</option>
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
              <button type="button" className="btn-ghost" onClick={rawgSearch} disabled={searching}>
                Search
              </button>
            )}
          </div>
          {isGame && rawgHint && <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{rawgHint}</div>}
          {isGame && rawgResults.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: 'var(--card)' }}>
              {rawgResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => applyRawgResult(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  {r.background_image && (
                    <img src={r.background_image} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div className="sub" style={{ margin: 0 }}>{r.released || '—'}</div>
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

        {isMedia && (
          <>
            <div className="field">
              <label>Kind</label>
              <select value={form.media_kind} onChange={(e) => set('media_kind', e.target.value)}>
                <option value="book">Book</option>
                <option value="dvd">DVD / Blu-ray</option>
                <option value="cd">CD</option>
              </select>
            </div>
            <div className="row2">
              <div className="field">
                <label>{mediaCreatorLabel}</label>
                <input type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} />
              </div>
              <div className="field">
                <label>Publisher / studio / label</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Format</label>
                <input type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder="e.g. Hardcover, Blu-ray, CD" />
              </div>
              <div className="field">
                <label>Edition</label>
                <input type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. Director's Cut, 2nd edition" />
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
            <input type="text" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </div>
        </div>

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
