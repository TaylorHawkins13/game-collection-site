'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import SeriesModal from '@/components/SeriesModal';
import ShelfIdentityHero from '@/components/ShelfIdentityHero';
import { seriesSupported } from '@/lib/seriesLookup';
import { TYPE_LABELS, TYPE_NOUNS, dominantType } from '@/lib/mosaicData';
import CommentSection from './CommentSection';

// Truncates a comment body for the "Recent activity" preview below —
// plain character slice (comments are plain text, no markup to worry
// about cutting mid-tag), long enough to give real context without the
// preview strip growing tall enough to push the collection grid back
// down the page — the exact thing it exists to avoid.
function truncateComment(text, max) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

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

  // ROADMAP.md "Public profile still visually reads as a copy of the
  // dashboard" — the dashboard and a public profile both lead with a
  // stats bar then straight into a collection grid, which is the real
  // reason they read as near-duplicates of each other (Dashboard =
  // editing/management, Profile = public/social, but nothing above the
  // fold said so unless the owner had also curated a Showcase — see
  // ShowcaseSection.jsx, which renders nothing at all when empty). This
  // strip gives every profile with any real comment activity a genuine
  // social signal above the grid, not just profiles someone has
  // deliberately curated a Showcase for — reuses `comments` already
  // fetched server-side (page.js), no extra query. Hidden while the
  // Comments tab itself is open, since showing the same 3 comments again
  // right above the full list would just be noise, not a signal.
  const recentComments = comments.slice(0, 3);

  return (
    <div>
      {recentComments.length > 0 && tab !== 'comments' && (
        <div className="profile-activity">
          <h3 className="profile-activity-heading">Recent activity</h3>
          {recentComments.map((c) => (
            <div className="profile-activity-item" key={c.id}>
              <div className="profile-activity-avatar">
                {c.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author.avatar_url} alt="" />
                ) : (
                  (c.author?.display_name || c.author?.username || '?').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="profile-activity-body">
                <div className="profile-activity-meta">
                  {c.author?.username ? (
                    <Link href={`/u/${c.author.username}`}>{c.author.display_name || c.author.username}</Link>
                  ) : (
                    'Someone'
                  )}
                  {' commented · '}
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
                <div className="profile-activity-text">{truncateComment(c.body, 140)}</div>
              </div>
            </div>
          ))}
          <button type="button" className="profile-activity-seeall" onClick={() => setTab('comments')}>
            See all {comments.length} comment{comments.length === 1 ? '' : 's'} →
          </button>
        </div>
      )}

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
              <div style={{ marginBottom: 12, fontSize: 'var(--fs-md)', color: 'var(--text-dim)' }}>
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
