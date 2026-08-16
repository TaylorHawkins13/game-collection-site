'use client';

import { useMemo, useState } from 'react';
import { shapeMosaic, modeLabel, titleColor, availableYears, availableTypes, TYPE_LABELS } from '@/lib/mosaicData';
import { currencySymbol, formatMoney } from '@/lib/currency';
import ShareProfileButton from '@/components/ShareProfileButton';
import GameCard from '@/components/GameCard';
import { announceToast } from '@/lib/toast';
import { attachHorizontalWheelScroll } from '@/lib/useHorizontalWheelScroll';

const MODE_TABS = [
  { key: 'all', label: 'Whole Shelf' },
  { key: 'showcase', label: 'Showcase' },
  { key: 'custom', label: 'Custom' },
  { key: 'type', label: 'By Type' },
  { key: 'year', label: 'By Year' },
  { key: 'top', label: 'Most Valuable' },
];

function Tile({ item, isShowcase, currency, failed, onFail, onHover }) {
  const value = item.market_price || item.price || 0;
  const showPlaceholder = !item.cover || failed;

  return (
    <div
      className="mosaic-tile"
      onMouseEnter={() => onHover(item)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item)}
      onBlur={() => onHover(null)}
      tabIndex={0}
    >
      {showPlaceholder ? (
        <div className="mosaic-tile-placeholder" style={{ background: titleColor(item.title) }}>
          {(item.title || '?').slice(0, 1).toUpperCase()}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.cover} alt={item.title} className="mosaic-tile-cover" onError={() => onFail(item.cover)} />
      )}
      <div className="mosaic-tile-shade" />
      {isShowcase && <div className="mosaic-badge mosaic-badge-star" />}
      {value > 0 && (
        <div className="mosaic-badge mosaic-badge-price">
          {currencySymbol(currency)}
          {Math.round(value)}
        </div>
      )}
    </div>
  );
}

export default function MosaicClient({ username, displayName, currency, items }) {
  const [mode, setMode] = useState('all');
  const [type, setType] = useState('');
  const [year, setYear] = useState('');
  const [failedCovers, setFailedCovers] = useState(() => new Set());
  const [hovered, setHovered] = useState(null);
  const [downloading, setDownloading] = useState(false);
  // Custom-selection mode: a hand-picked subset instead of a computed
  // rule. `picking` toggles the item-picker view in place of the mosaic
  // itself — opens automatically the first time Custom is selected (empty
  // set), and can be reopened any time via "Edit selection" to change
  // picks without losing them.
  const [customIds, setCustomIds] = useState(() => new Set());
  const [picking, setPicking] = useState(false);
  const [pickSearch, setPickSearch] = useState('');

  const types = useMemo(() => availableTypes(items), [items]);
  const years = useMemo(() => availableYears(items), [items]);

  const effectiveType = type || types[0] || '';
  const effectiveYear = year || (years[0] ? String(years[0]) : '');

  const { rows, totalItems, shownItems } = useMemo(
    () => shapeMosaic(items, { mode, type: effectiveType, year: effectiveYear, selectedIds: customIds, perRowCap: 10 }),
    [items, mode, effectiveType, effectiveYear, customIds]
  );

  function selectMode(key) {
    setMode(key);
    if (key === 'custom' && customIds.size === 0) setPicking(true);
  }

  function toggleCustomItem(id) {
    setCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pickMatches = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => (i.title || '').toLowerCase().includes(q));
  }, [items, pickSearch]);

  function handleFail(url) {
    setFailedCovers((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }

  const params = new URLSearchParams({ mode });
  if (mode === 'type' && effectiveType) params.set('type', effectiveType);
  if (mode === 'year' && effectiveYear) params.set('year', effectiveYear);
  if (mode === 'custom') params.set('ids', [...customIds].join(','));
  const imageUrl = `/u/${username}/mosaic-image?${params.toString()}`;
  const fileName = `shelf-life-${username}-mosaic.png`;
  const customEmpty = mode === 'custom' && customIds.size === 0;

  // A plain `<a href download>` pointing at a route (rather than a blob:
  // URL) is what this used to be, and it's unreliable on mobile — iOS
  // Safari in particular mostly ignores the `download` attribute for a
  // real navigation and just opens the PNG full-screen instead of saving
  // it, which reads as "nothing happened." Fetching the image ourselves
  // and handing it off as a blob fixes both mobile cases properly:
  // the native Share sheet (with a real "Save Image" option) where the
  // Web Share API supports files, and a same-origin blob: URL — which
  // *does* reliably trigger a save, unlike a cross-navigation one —
  // everywhere else, including desktop.
  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error('fetch_failed');
      const blob = await res.blob();

      const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: 'image/png' }) : null;
      if (file && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Shelf Life mosaic' });
          return;
        } catch (err) {
          // AbortError just means the user closed the share sheet.
          if (err?.name === 'AbortError') return;
          // Otherwise fall through to the blob-link download below.
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      announceToast("Couldn't download the mosaic — try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mosaic-wrap">
      <div className="mosaic-toolbar">
        <div className="mosaic-tabs">
          {MODE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`profile-tab${mode === t.key ? ' active' : ''}`}
              onClick={() => selectMode(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'type' && types.length > 0 && (
          <select value={effectiveType} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] || t}
              </option>
            ))}
          </select>
        )}
        {mode === 'year' && years.length > 0 && (
          <select value={effectiveYear} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {mode === 'custom' && !picking && (
          <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>
            Edit selection ({customIds.size})
          </button>
        )}

        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn-ghost"
          onClick={handleDownload}
          disabled={downloading || customEmpty || picking}
          style={{ whiteSpace: 'nowrap' }}
        >
          {downloading ? 'Preparing…' : 'Download PNG'}
        </button>
        {!customEmpty && !picking && (
          <ShareProfileButton
            username={username}
            path={`/u/${username}/mosaic`}
            text={`Check out ${displayName || username}'s shelf mosaic on Shelf Life.`}
            label="Share mosaic"
          />
        )}
      </div>

      {mode === 'custom' && picking ? (
        <div className="mosaic-picker">
          <div className="field" style={{ margin: '0 0 12px' }}>
            <label htmlFor="mosaic-pick-search">Choose items for this mosaic</label>
            <input
              id="mosaic-pick-search"
              type="text"
              placeholder="Search your collection…"
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
            />
          </div>
          {pickMatches.length === 0 ? (
            <div className="empty-state">
              <div>No matches.</div>
            </div>
          ) : (
            <div className="grid">
              {pickMatches.map((item) => (
                <GameCard
                  key={item.id}
                  game={item}
                  currency={currency}
                  selectMode
                  selected={customIds.has(item.id)}
                  onToggleSelect={toggleCustomItem}
                />
              ))}
            </div>
          )}
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <div className="sub" style={{ margin: 0 }}>{customIds.size} selected</div>
            <div className="right">
              <button type="button" className="btn-primary" onClick={() => setPicking(false)} disabled={customIds.size === 0}>
                Show mosaic
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mosaic-sub">
          {modeLabel(mode, { type: effectiveType, year: effectiveYear })} · {shownItems} of {totalItems} items shown
        </div>
      )}

      {!picking && hovered && (
        <div className="mosaic-hover-info">
          <strong>{hovered.title}</strong>
          <span>{TYPE_LABELS[hovered.item_type] || hovered.item_type}</span>
          {(hovered.market_price || hovered.price) > 0 && (
            <span>{formatMoney(hovered.market_price || hovered.price, currency)}</span>
          )}
        </div>
      )}

      {picking ? null : rows.length === 0 ? (
        <div className="empty-state">
          <div>{customEmpty ? 'Pick a few items above to build your mosaic.' : 'Nothing to show for this view yet.'}</div>
        </div>
      ) : (
        <div className="mosaic-shelf-unit">
          {rows.map((row, i) => (
            <div className="mosaic-row" key={i}>
              <div className="mosaic-row-label">
                {row.label} · {row.items.length}
              </div>
              <div className="mosaic-row-items" ref={attachHorizontalWheelScroll}>
                {row.items.map((item) => (
                  <Tile
                    key={item.id}
                    item={item}
                    currency={currency}
                    failed={failedCovers.has(item.cover)}
                    onFail={handleFail}
                    onHover={setHovered}
                    isShowcase={item.showcase_order != null}
                  />
                ))}
                {row.overflow > 0 && <div className="mosaic-tile mosaic-tile-overflow">+{row.overflow}</div>}
              </div>
              <div className="mosaic-plank" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
