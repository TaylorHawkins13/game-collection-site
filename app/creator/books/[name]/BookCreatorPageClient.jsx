'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import SeriesGrid from '@/components/SeriesGrid';
import { goToBestListing } from '@/lib/externalListings';

// Client half of a Books creator page (app/creator/books/[name]/page.js
// does the real Open Library + Supabase lookups server-side and hands the
// results down as plain props) — same split CreatorPageClient.jsx
// (app/creator/comics/[id]) uses and for the same reason: SeriesGrid's
// click handling and the owned-keys Set need a client boundary.
//
// No `image`/`truncated` props the Comics version takes: Open Library's
// author search doesn't return a portrait the way Comic Vine's person
// resource does (getAuthorBibliography() only ever returns per-work
// covers, see lib/openLibraryAuthorLookup.js), and it's two fixed,
// non-paginated calls rather than comicVineCreatorLookup's open-ended
// issue-credits walk, so there's nothing here that can get cut short.
//
// `ownedKeys` arrives as a plain array, not a Set — Sets don't survive
// server->client prop serialization, same reason CreatorPageClient.jsx
// documents.
export default function BookCreatorPageClient({ name, entries, ownedKeys, signedIn, currency }) {
  const ownedKeysSet = useMemo(() => new Set(ownedKeys || []), [ownedKeys]);

  function handleSelectMissing(entry) {
    goToBestListing({ item_type: 'book', title: entry.rawTitle || entry.label }, currency);
  }

  return (
    <div>
      <div className="profile-header" style={{ marginTop: 0 }}>
        <div className="avatar">{(name || '?').slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{name}</div>
          <div className="profile-username">
            {entries.length} title{entries.length === 1 ? '' : 's'} on file
          </div>
        </div>
      </div>

      {!signedIn && (
        <p className="sub" style={{ marginBottom: 16 }}>
          <Link href="/login">Log in</Link> to see what you already own highlighted below, and to click any
          missing title to check its price.
        </p>
      )}

      {/* getAuthorBibliography() (lib/openLibraryAuthorLookup.js) already
          errors out with 'no_series' before ever handing back an empty
          entries array — unlike Comics' getComicCreatorWorks, which can
          legitimately return entries: [] for a real creator with zero
          issue credits on file. page.js's result.error branch already
          covers "nothing on file for that name," so entries here is
          guaranteed non-empty. */}
      <SeriesGrid
        data={{ seriesName: name, entries }}
        ownedKeys={ownedKeysSet}
        onSelectMissing={signedIn ? handleSelectMissing : undefined}
      />
    </div>
  );
}
