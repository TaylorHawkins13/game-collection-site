'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import SeriesGrid from '@/components/SeriesGrid';
import { goToBestListing } from '@/lib/externalListings';

// Client half of a card-illustrator creator page — same split as
// app/creator/comics/[id]/CreatorPageClient.jsx, for the same reason
// (SeriesGrid's click handling and the owned-keys Set need a client
// boundary). No portrait image here — neither Scryfall's nor TCGdex's
// artist catalog carries one, unlike Comic Vine's person resource.
//
// `ownedKeys` arrives as a plain array (Sets don't survive server→client
// RSC prop serialization) and gets turned back into a Set here, same
// pattern the comics client uses.
export default function CardCreatorPageClient({ name, gameLabel, entries, ownedKeys, truncated, signedIn, currency }) {
  const ownedKeysSet = useMemo(() => new Set(ownedKeys || []), [ownedKeys]);

  // Same reasoning as CreatorPageClient.jsx's handleSelectMissing — this
  // grid spans every set the illustrator's worked across, each entry
  // carrying its own series (set name) and rawTitle (the card's own
  // name), so building the price-check item directly per-entry is
  // simpler than bending prefillFromSeriesEntry (which assumes one shared
  // set for the whole grid) to fit.
  function handleSelectMissing(entry) {
    goToBestListing({ item_type: 'trading_card', title: entry.rawTitle, card_set: entry.series }, currency);
  }

  return (
    <div>
      <div className="profile-header" style={{ marginTop: 0 }}>
        <div className="avatar">{(name || '?').slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{name}</div>
          <div className="profile-username">
            {gameLabel} · {entries.length} card{entries.length === 1 ? '' : 's'} on file
          </div>
        </div>
      </div>

      {truncated && (
        <p className="sub" style={{ marginBottom: 16 }}>
          This is a lot of ground to cover — this list may not show every card.
        </p>
      )}

      {!signedIn && (
        <p className="sub" style={{ marginBottom: 16 }}>
          <Link href="/login">Log in</Link> to see what you already own highlighted below, and to click any
          missing card to check its price.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon-badge"><Layers aria-hidden="true" /></span>
          <div>Nothing on file for {name}.</div>
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
