'use client';

import { useRef, useState } from 'react';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import SeriesModal from '@/components/SeriesModal';
import ShelfIdentityHero from '@/components/ShelfIdentityHero';
import { seriesSupported } from '@/lib/seriesLookup';
import { TYPE_LABELS, TYPE_NOUNS, dominantType } from '@/lib/mosaicData';
import CommentSection from './CommentSection';

export default function ProfileTabs({
  games,
  achievementDefs,
  earnedKeys,
  rarity,
  comments,
  canComment,
  profileId,
  currency,
  ownerName,
  isOwnProfile,
  enabledTypes,
}) {
  const hasTrophies = achievementDefs && achievementDefs.length > 0;
  const [tab, setTab] = useState('collection');
  const [seriesItem, setSeriesItem] = useState(null);
  // Extends the dashboard's segmented-shelf visual identity
  // (components/ShelfIdentityHero.jsx) to public profiles — see
  // ROADMAP.md "Extend the type-driven identity to public profiles."
  // Scoped to the Collection tab (rather than sitting above the tab bar
  // the way the dashboard's copy does) since this is specifically a
  // view into the collection grid below it: clicking a row or tile here
  // filters that same grid, not anything else on the page. null means
  // "show everything," same default the dashboard's own Filters panel
  // uses.
  const [typeFilter, setTypeFilter] = useState(null);
  const gridRef = useRef(null);

  function scrollToGrid() {
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSelectType(type) {
    setTypeFilter((current) => (current === type ? null : type));
    scrollToGrid();
  }

  function handleSelectItem(item) {
    // Series-supported types (games, comics, trading cards, Funko Pops)
    // already open a real detail view on click from the grid below —
    // reuse that exact same modal so a hero tile jumps straight to the
    // item, same as clicking its card would. Other types have no
    // dedicated detail view on a public profile (only the dashboard's
    // ItemDetailModal does), so the best available fallback is filtering
    // the grid down to that item's type and scrolling to it.
    if (seriesSupported(item.item_type)) {
      setSeriesItem(item);
    } else {
      setTypeFilter(item.item_type);
      scrollToGrid();
    }
  }

  const visibleGames = typeFilter ? games.filter((g) => g.item_type === typeFilter) : games;

  // Type-aware microcopy (see ROADMAP.md "Type-aware microcopy and
  // trophy-badge flavor") — the true-empty Collection tab has no items to
  // compute a dominant type from yet, so it falls back to whatever single
  // type this profile has enabled via Collecting preferences, same source
  // WelcomePanel.jsx uses for the equivalent brand-new-dashboard case.
  // Trophy flavor text below uses the real dominant type instead, since a
  // profile with trophies always has items to compute one from.
  const singleType = enabledTypes && enabledTypes.length === 1 ? enabledTypes[0] : null;
  const ownerPossessive = isOwnProfile ? 'Your' : `${ownerName}'s`;
  const dominant = dominantType(games.filter((g) => g.ownership === 'owned'));

  return (
    <div>
      <div className="profile-tabs">
        <button
          type="button"
          className={`profile-tab${tab === 'collection' ? ' active' : ''}`}
          onClick={() => setTab('collection')}
        >
          Collection ({games.length})
        </button>
        {hasTrophies && (
          <button
            type="button"
            className={`profile-tab${tab === 'trophies' ? ' active' : ''}`}
            onClick={() => setTab('trophies')}
          >
            Trophies ({earnedKeys.length}/{achievementDefs.length})
          </button>
        )}
        <button
          type="button"
          className={`profile-tab${tab === 'comments' ? ' active' : ''}`}
          onClick={() => setTab('comments')}
        >
          Comments ({comments.length})
        </button>
      </div>

      {tab === 'collection' &&
        (games.length === 0 ? (
          <div className="empty-state">
            <div>{singleType ? `${ownerPossessive} ${TYPE_NOUNS[singleType]} is empty.` : 'No items on this shelf yet.'}</div>
          </div>
        ) : (
          <>
            <ShelfIdentityHero
              items={games}
              enabledTypes={enabledTypes}
              onSelectType={handleSelectType}
              onSelectItem={handleSelectItem}
            />

            {typeFilter && (
              <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-dim)' }}>
                Showing {TYPE_LABELS[typeFilter] || typeFilter}
                {' · '}
                <button
                  type="button"
                  onClick={() => setTypeFilter(null)}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                >
                  Clear
                </button>
              </div>
            )}

            <div ref={gridRef} style={{ marginBottom: 40 }}>
              {visibleGames.length === 0 ? (
                <div className="empty-state">
                  <div>Nothing here for this filter.</div>
                </div>
              ) : (
                <div className="grid">
                  {visibleGames.map((g) => (
                    <GameCard
                      key={g.id}
                      game={g}
                      currency={currency}
                      onClick={seriesSupported(g.item_type) ? () => setSeriesItem(g) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ))}

      {seriesItem && (
        <SeriesModal
          key={seriesItem.id}
          item={seriesItem}
          items={games}
          ownerLabel={isOwnProfile ? null : ownerName}
          isOwnProfile={isOwnProfile}
          onClose={() => setSeriesItem(null)}
        />
      )}

      {tab === 'trophies' && hasTrophies && (
        <TrophyCase defs={achievementDefs} earnedKeys={earnedKeys} rarity={rarity} dominantType={dominant} />
      )}

      {tab === 'comments' && (
        <CommentSection profileId={profileId} initialComments={comments} canComment={canComment} />
      )}
    </div>
  );
}
