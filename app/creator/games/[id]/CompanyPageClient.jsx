'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import SeriesGrid from '@/components/SeriesGrid';
import { goToBestListing } from '@/lib/externalListings';

// Client half of a Games creator page (app/creator/games/[id]/page.js
// does the real IGDB + Supabase lookups server-side and hands the
// results down as plain props) — same split CreatorPageClient.jsx
// (app/creator/comics/[id]) and BookCreatorPageClient.jsx (app/creator/
// books/[name]) both use, for the same reason: SeriesGrid's click
// handling and the owned-keys Set need a client boundary.
//
// No per-entry platform info on `entries` (unlike the Full release
// catalogue, which is scoped to one already-known platform) — a
// company's whole catalogue can span many platforms per title, so a
// missing entry's price check searches by title alone rather than
// guessing a platform to tack on; buildPriceQuery (lib/marketPrice.js)
// already treats a missing `platforms` array as optional, not required.
//
// `ownedKeys` arrives as a plain array, not a Set — Sets don't survive
// server->client prop serialization, same reason every other creator
// page's client component documents.
export default function CompanyPageClient({ name, logo, entries, ownedKeys, truncated, signedIn, currency }) {
  const ownedKeysSet = useMemo(() => new Set(ownedKeys || []), [ownedKeys]);

  function handleSelectMissing(entry) {
    goToBestListing({ item_type: 'game', title: entry.rawTitle || entry.label }, currency);
  }

  return (
    <div>
      <div className="profile-header" style={{ marginTop: 0 }}>
        <div className="avatar">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={name} />
          ) : (
            (name || '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{name}</div>
          <div className="profile-username">
            {entries.length} title{entries.length === 1 ? '' : 's'} on file
          </div>
        </div>
      </div>

      {truncated && (
        <p className="sub" style={{ marginBottom: 16 }}>
          This is a lot of ground to cover — this list may not show every title.
        </p>
      )}

      {!signedIn && (
        <p className="sub" style={{ marginBottom: 16 }}>
          <Link href="/login">Log in</Link> to see what you already own highlighted below, and to click any
          missing title to check its price.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon-badge"><Building2 aria-hidden="true" /></span>
          <div>IGDB doesn&apos;t have any developer or publisher credits on file for {name}.</div>
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
