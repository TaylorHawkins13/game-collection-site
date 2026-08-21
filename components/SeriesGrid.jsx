'use client';

import { useEffect, useState } from 'react';

// Pure display component for the "Series" feature — a small cover grid,
// greyed out unless the entry's normalized key is in `ownedKeys`. Reused
// by GameModal (your own item, comparing against your collection) and
// SeriesModal (read-only, comparing against whichever profile you're
// looking at). `data` is the normalizeSeriesResponse() shape from
// lib/seriesLookup.js: { seriesName, entries: [{id, cover, label,
// matchKey}] }.
//
// `onSelectMissing`, when passed, makes every not-owned entry clickable —
// GameModal, ItemDetailModal, and SeriesModal (when `isOwnProfile`) all
// wire this to open one real listing tab for that entry: eBay if it has
// any, CeX otherwise (see lib/externalListings.js). Callers that don't
// pass it leave those grids exactly as before — greyed-out but inert.
//
// Renders in batches instead of the full entries array at once — see
// ROADMAP.md "SeriesGrid has no pagination/windowing for very large
// master sets." Pokémon sets (100-250 cards) never stressed this, but
// the comic master set's flat 300-issue cap got removed in favor of a
// real time budget (see CHANGELOG.md), so a genuinely long-running comic
// (1000+ issues) can now hand this a proportionally huge entries array.
// A plain "show more" button was chosen over virtualization/windowing —
// no new dependency, and it matches how ImportCsvModal already previews
// "first 8, then N more" elsewhere in this codebase.
const INITIAL_COUNT = 100;
const PAGE_STEP = 100;

export default function SeriesGrid({ data, ownedKeys, ownerLabel, onSelectMissing }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // Resets the "show more" progress whenever the underlying series
  // changes — neither call site remounts this component via `key` when
  // its own selected item changes (GameModal, ItemDetailModal), so
  // without this a stale visibleCount from a previous, larger series
  // could leave a smaller one's grid looking like it's missing entries
  // that were actually just never re-shown.
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [data?.seriesName]);

  if (!data) return null;
  const ownedCount = data.entries.filter((e) => ownedKeys.has(e.matchKey)).length;
  const visibleEntries = data.entries.slice(0, visibleCount);
  const remaining = data.entries.length - visibleEntries.length;

  return (
    <div className="franchise-panel">
      <div className="sub" style={{ marginBottom: 8 }}>
        {data.seriesName} — {ownedCount} of {data.entries.length}{' '}
        {ownerLabel ? `in ${ownerLabel}'s collection` : 'in the collection'}
      </div>
      <div className="franchise-grid">
        {visibleEntries.map((e) => {
          const owned = ownedKeys.has(e.matchKey);
          const clickable = !owned && !!onSelectMissing;
          const content = (
            <>
              {e.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.cover} alt={e.label} />
              ) : (
                <div className="franchise-item-placeholder">{(e.label || '?').replace('#', '').slice(0, 1)}</div>
              )}
              <div className="franchise-item-name">{e.label}</div>
            </>
          );
          if (clickable) {
            return (
              <button
                key={e.id}
                type="button"
                className="franchise-item missing-clickable"
                title={`${e.label} — not in the collection yet. Checks eBay, opens CeX if there's nothing there.`}
                onClick={() => onSelectMissing(e)}
              >
                {content}
              </button>
            );
          }
          return (
            <div key={e.id} className={`franchise-item${owned ? ' owned' : ''}`} title={e.label}>
              {content}
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 10 }}
          onClick={() => setVisibleCount((c) => c + PAGE_STEP)}
        >
          Show {Math.min(PAGE_STEP, remaining)} more ({remaining} left)
        </button>
      )}
    </div>
  );
}
