'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import SeriesGrid from '@/components/SeriesGrid';
import { openBestListingTab } from '@/lib/externalListings';

// Client half of a creator page (app/creator/comics/[id]/page.js does the
// real Comic Vine + Supabase lookups server-side and hands the results
// down as plain props). Kept separate from the server component only
// because SeriesGrid's click handling and the owned-keys Set need a
// client boundary — everything here is otherwise just rendering.
//
// `ownedKeys` arrives as a plain array, not a Set: Sets don't survive
// server→client prop serialization (Next.js RSC payload only carries
// JSON-safe values), so page.js spreads the Set from
// ownedComicKeysBySeriesAndIssue() into an array before passing it down,
// and this component converts it back to a Set for SeriesGrid's O(1)
// `.has()` lookups per grid cell.
export default function CreatorPageClient({ name, image, entries, ownedKeys, truncated, signedIn, currency }) {
  const ownedKeysSet = useMemo(() => new Set(ownedKeys || []), [ownedKeys]);

  // Not prefillFromSeriesEntry() — that helper assumes one shared series
  // name for the whole grid (true for every other SeriesGrid caller,
  // which each render exactly one series/set), but a creator page's grid
  // spans every series that creator's ever worked on, with each entry
  // carrying its own `series`/`number` (see getComicCreatorWorks in
  // lib/comicVineCreatorLookup.js). buildPriceQuery (lib/marketPrice.js)
  // only needs title/issue_number/item_type off the object, so building
  // one directly per-entry here is simpler than trying to bend the
  // shared-series helper to fit.
  function handleSelectMissing(entry) {
    openBestListingTab({ item_type: 'comic', title: entry.series, issue_number: entry.number }, currency);
  }

  return (
    <div>
      <div className="profile-header" style={{ marginTop: 0 }}>
        <div className="avatar">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={name} />
          ) : (
            (name || '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{name}</div>
          <div className="profile-username">
            {entries.length} issue{entries.length === 1 ? '' : 's'} on file
          </div>
        </div>
      </div>

      {truncated && (
        <p className="sub" style={{ marginBottom: 16 }}>
          This is a lot of ground to cover — this list may not show every credit.
        </p>
      )}

      {!signedIn && (
        <p className="sub" style={{ marginBottom: 16 }}>
          <Link href="/login">Log in</Link> to see what you already own highlighted below, and to click any
          missing issue to check its price.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <div>Comic Vine doesn&apos;t have any issue credits on file for {name}.</div>
        </div>
      ) : (
        <SeriesGrid
          data={{ seriesName: name, entries }}
          ownedKeys={ownedKeysSet}
          onSelectMissing={signedIn ? handleSelectMissing : undefined}
        />
      )}
    </div>
  );
}
