'use client';

import { useMemo, useState } from 'react';
import { shapeMosaic, modeLabel, titleColor, availableYears, availableTypes, computeAccents, TYPE_LABELS } from '@/lib/mosaicData';
import { currencySymbol, formatMoney } from '@/lib/currency';
import ShareProfileButton from '@/components/ShareProfileButton';

const MODE_TABS = [
  { key: 'all', label: 'Whole Shelf' },
  { key: 'showcase', label: 'Showcase' },
  { key: 'type', label: 'By Type' },
  { key: 'year', label: 'By Year' },
  { key: 'top', label: 'Most Valuable' },
];

function Tile({ item, isShowcase, isTopValue, currency, failed, onFail, onHover }) {
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
      {isShowcase && <div className="mosaic-badge mosaic-badge-star">★</div>}
      {isTopValue && value > 0 && (
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

  const types = useMemo(() => availableTypes(items), [items]);
  const years = useMemo(() => availableYears(items), [items]);

  const effectiveType = type || types[0] || '';
  const effectiveYear = year || (years[0] ? String(years[0]) : '');

  const { rows, totalItems, shownItems } = useMemo(
    () => shapeMosaic(items, { mode, type: effectiveType, year: effectiveYear, perRowCap: 10 }),
    [items, mode, effectiveType, effectiveYear]
  );

  const topValueIds = useMemo(() => computeAccents(rows.flatMap((r) => r.items)).topValueIds, [rows]);

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
  const imageUrl = `/u/${username}/mosaic-image?${params.toString()}`;

  return (
    <div className="mosaic-wrap">
      <div className="mosaic-toolbar">
        <div className="mosaic-tabs">
          {MODE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`profile-tab${mode === t.key ? ' active' : ''}`}
              onClick={() => setMode(t.key)}
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

        <div style={{ flex: 1 }} />
        <a href={imageUrl} download className="btn-ghost" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Download PNG
        </a>
        <ShareProfileButton
          username={username}
          path={`/u/${username}/mosaic`}
          text={`Check out ${displayName || username}'s shelf mosaic on Shelf Life.`}
          label="Share mosaic"
        />
      </div>

      <div className="mosaic-sub">
        {modeLabel(mode, { type: effectiveType, year: effectiveYear })} · {shownItems} of {totalItems} items shown
      </div>

      {hovered && (
        <div className="mosaic-hover-info">
          <strong>{hovered.title}</strong>
          <span>{TYPE_LABELS[hovered.item_type] || hovered.item_type}</span>
          {(hovered.market_price || hovered.price) > 0 && (
            <span>{formatMoney(hovered.market_price || hovered.price, currency)}</span>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty-state">
          <div>Nothing to show for this view yet.</div>
        </div>
      ) : (
        rows.map((row) => (
          <div className="mosaic-row" key={row.type}>
            <div className="mosaic-row-label">
              {row.label} · {row.total}
            </div>
            <div className="mosaic-row-items">
              {row.items.map((item) => (
                <Tile
                  key={item.id}
                  item={item}
                  currency={currency}
                  failed={failedCovers.has(item.cover)}
                  onFail={handleFail}
                  onHover={setHovered}
                  isShowcase={item.showcase_order != null}
                  isTopValue={topValueIds.has(item.id)}
                />
              ))}
              {row.overflow > 0 && <div className="mosaic-tile mosaic-tile-overflow">+{row.overflow}</div>}
            </div>
            <div className="mosaic-plank" />
          </div>
        ))
      )}
    </div>
  );
}
