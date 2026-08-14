'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useModalA11y from '@/lib/useModalA11y';
import useSeriesLookup from '@/lib/useSeriesLookup';
import { seriesQueryValueFor, ownedKeysFor, prefillFromSeriesEntry } from '@/lib/seriesLookup';
import SeriesGrid from './SeriesGrid';

// Read-only counterpart to the "Series" section in GameModal — opened by
// tapping a game/comic/card/Funko Pop on a public profile (your own or
// someone else's). There's nothing to edit here, so it's its own small
// modal rather than reusing GameModal: just the series grid, compared
// against whichever profile's collection was passed in as `items` (not
// necessarily the viewer's own — clicking a game on someone else's shelf
// shows their completion, not yours). The parent should mount this with
// `key={item.id}` so switching items remounts fresh rather than showing
// stale data while the new lookup is still loading.
//
// `isOwnProfile` gates the same "click a missing entry to check its eBay
// price" flow GameModal has (see ROADMAP.md "Full series view") — only
// makes sense here when `items` is your own collection, since "missing
// from `items`" only means "missing from your own collection" in that
// case. On someone else's shelf it just means missing from theirs, which
// says nothing about whether you already have it. There's no Add Item
// form on a profile page to open in place, so this hands off to
// /dashboard via a query-string deep link instead — the same pattern the
// collectible detail page's "Add to your shelf" link already uses for
// ?add=1.
export default function SeriesModal({ item, items, ownerLabel, isOwnProfile, onClose }) {
  const modalRef = useModalA11y(onClose);
  const router = useRouter();
  const series = useSeriesLookup();

  useEffect(() => {
    series.load(item.item_type, seriesQueryValueFor(item));
    // Runs once per mount (parent remounts this via `key` on item
    // change) — see the component comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownedKeys = ownedKeysFor(items, item.item_type);

  function handleSelectMissing(entry) {
    const prefill = prefillFromSeriesEntry(item.item_type, series.data.seriesName, entry);
    const params = new URLSearchParams({ addFromSeries: '1', ...prefill });
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="series-modal-title">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h2 id="series-modal-title" style={{ margin: 0 }}>{item.title}</h2>
          <button type="button" className="btn-ghost" style={{ flexShrink: 0 }} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sub">Series completion</div>
        {series.loading && <div className="sub">Looking up the series…</div>}
        {series.error && <div className="sub">{series.error}</div>}
        {series.data && (
          <SeriesGrid
            data={series.data}
            ownedKeys={ownedKeys}
            ownerLabel={ownerLabel}
            onSelectMissing={isOwnProfile ? handleSelectMissing : undefined}
          />
        )}
      </div>
    </div>
  );
}
