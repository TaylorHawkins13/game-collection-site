'use client';

import { useMemo } from 'react';
import { titleColor, CATEGORY_ORDER, TYPE_LABELS, TYPE_COLORS, TYPE_MONOGRAMS } from '@/lib/mosaicData';
import { attachHorizontalWheelScroll } from '@/lib/useHorizontalWheelScroll';

const TILES_PER_ROW = 14;

// The dashboard's "segmented shelf" — the visual-identity flagship
// discussed in chat and tracked under ROADMAP.md's High priority section
// ("Visual identity tailored to what someone actually collects"). Instead
// of one generic dashboard shell for every account, this renders one
// shelf row per collectible type someone actually owns and has enabled
// (see the Collecting settings tab), each in that type's own accent
// color/icon (lib/mosaicData.js's TYPE_COLORS/TYPE_MONOGRAMS) with real cover
// art from their own collection — a comic-heavy account and a vinyl-heavy
// account should not look the same. This is the multi-type answer too
// (see ROADMAP.md): rather than trying to blend several types' colors
// into one muddy hybrid, or picking a single "winner" type to represent
// the whole account, every enabled type just gets its own zone. Reuses
// the shelf-mosaic feature's existing tile/placeholder conventions
// (real cover art, or a stable titleColor()-based letter tile when
// there's no usable cover) rather than inventing a new visual language,
// but is deliberately its own, lighter component — the full mosaic
// (app/u/[username]/mosaic) is a whole dedicated poster page, this is a
// compact hero meant to sit at the top of a page that has other things
// to do below it.
export default function ShelfIdentityHero({ items, enabledTypes, onSelectType, onSelectItem }) {
  const rows = useMemo(() => {
    const owned = (items || []).filter((i) => i.ownership === 'owned');
    const allowedTypes = enabledTypes && enabledTypes.length > 0 ? enabledTypes : CATEGORY_ORDER;
    return CATEGORY_ORDER.filter((t) => allowedTypes.includes(t))
      .map((type) => {
        const typeItems = owned
          .filter((i) => i.item_type === type)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { type, items: typeItems };
      })
      .filter((row) => row.items.length > 0);
  }, [items, enabledTypes]);

  // Nothing owned yet in any enabled type (a brand-new account, or one
  // where every owned item's type has since been disabled in Collecting
  // preferences) — nothing to show a shelf of yet. WelcomePanel already
  // covers the true empty-collection case; this just declines to render
  // rather than showing an empty shelf frame with nothing on it.
  if (rows.length === 0) return null;

  return (
    <div className="shelf-hero">
      {rows.map(({ type, items: typeItems }) => {
        const shown = typeItems.slice(0, TILES_PER_ROW);
        const overflow = typeItems.length - shown.length;
        const color = TYPE_COLORS[type];
        return (
          <div className="shelf-hero-row" key={type} style={{ '--tile-color': color }}>
            <button type="button" className="shelf-hero-row-header" onClick={() => onSelectType && onSelectType(type)}>
              <span className="shelf-hero-icon" aria-hidden="true">
                {TYPE_MONOGRAMS[type]}
              </span>
              <span className="shelf-hero-label">{TYPE_LABELS[type]}</span>
              <span className="shelf-hero-count">{typeItems.length}</span>
            </button>
            <div className="shelf-hero-items" ref={attachHorizontalWheelScroll}>
              {shown.map((item) => (
                <ShelfTile key={item.id} item={item} onClick={() => onSelectItem && onSelectItem(item)} />
              ))}
              {overflow > 0 && (
                <button
                  type="button"
                  className="shelf-hero-tile shelf-hero-tile-overflow"
                  onClick={() => onSelectType && onSelectType(type)}
                >
                  +{overflow}
                </button>
              )}
            </div>
            <div className="shelf-hero-plank" />
          </div>
        );
      })}
    </div>
  );
}

function ShelfTile({ item, onClick }) {
  return (
    <button type="button" className="shelf-hero-tile" onClick={onClick} aria-label={item.title}>
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.cover}
          alt=""
          className="shelf-hero-tile-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      <div className="shelf-hero-tile-placeholder" style={{ background: titleColor(item.title), display: item.cover ? 'none' : 'flex' }}>
        {(item.title || '?').slice(0, 1).toUpperCase()}
      </div>
    </button>
  );
}
