'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GameCard from './GameCard';
import ShowcaseManagerModal from './ShowcaseManagerModal';
import SeriesModal from './SeriesModal';
import { seriesSupported } from '@/lib/seriesLookup';

// Renders the profile's pinned "Showcase" grid, and makes each tile
// clickable: the owner clicks straight into the same picker used by the
// "Manage showcase" button (no extra fetch needed — the full collection
// is already sitting in `allGames`, passed down from the server), while
// a visitor clicks into the read-only series view for anything that
// supports it, same behavior as the collection grid below it. The
// existing "Manage showcase" action-menu button stays as-is (it's still
// the only way in when the showcase is empty and there's nothing to
// click yet); this is an additional, more direct path for the common
// case of "I want to swap that one out."
export default function ShowcaseSection({ showcaseGames, allGames, currency, isOwner, ownerName }) {
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [seriesItem, setSeriesItem] = useState(null);

  if (!showcaseGames || showcaseGames.length === 0) return null;

  function handleSaved() {
    setManaging(false);
    router.refresh();
  }

  function handleClick(g) {
    if (isOwner) {
      setManaging(true);
    } else if (seriesSupported(g.item_type)) {
      setSeriesItem(g);
    }
  }

  return (
    <div className="profile-showcase">
      <h3 className="profile-showcase-heading">Showcase</h3>
      <div className="grid showcase-grid">
        {showcaseGames.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            featured
            currency={currency}
            onClick={isOwner || seriesSupported(g.item_type) ? () => handleClick(g) : undefined}
          />
        ))}
      </div>

      {managing && (
        <ShowcaseManagerModal games={allGames} onClose={() => setManaging(false)} onSaved={handleSaved} />
      )}

      {seriesItem && (
        <SeriesModal
          key={seriesItem.id}
          item={seriesItem}
          items={allGames}
          ownerLabel={isOwner ? null : ownerName}
          onClose={() => setSeriesItem(null)}
        />
      )}
    </div>
  );
}
