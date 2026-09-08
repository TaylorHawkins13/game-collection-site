'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import SeriesModal from '@/components/SeriesModal';
import ShelfIdentityHero from '@/components/ShelfIdentityHero';
import StarRating from '@/components/StarRating';
import { seriesSupported } from '@/lib/seriesLookup';
import { TYPE_LABELS, TYPE_NOUNS, dominantType } from '@/lib/mosaicData';
import CommentSection from './CommentSection';

const MAX_ACTIVITY_PREVIEW = 5;

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

// Plain-verb phrasing for an activity_events row, same verbs /feed.js
// already uses — deliberately no "You"/possessive-name prefix (unlike the
// comment rows right above these in the merged list, which do name who
// commented): this whole section already sits directly under this
// person's own header/avatar, so restating whose activity it is on every
// single row would be pure noise, not a signal.
function activityVerb(eventType) {
  if (eventType === 'added') return 'Added';
  if (eventType === 'completed') return 'Completed';
  if (eventType === 'rated') return 'Rated';
  if (eventType === 'trophy') return 'Earned the trophy';
  return eventType;
}

export default function ProfileTabs({
  games,
  achievementDefs,
  earnedKeys,
  rarity,
  comments,
  ownActivity,
  canComment,
  profileId,
  currency,
  ownerName,
  isOwnProfile,
  enabledTypes,
  children,
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

  // ROADMAP.md "Public profile still partly reads as a copy of the
  // dashboard" — the dashboard and a public profile both lead with a
  // stats bar then straight into a collection grid, which is the real
  // reason they read as near-duplicates of each other (Dashboard =
  // editing/management, Profile = public/social, but nothing above the
  // fold said so unless the owner had also curated a Showcase — see
  // ShowcaseSection.jsx, which renders nothing at all when empty). A
  // first pass (Sep 2026) added a comments-only preview strip here; this
  // round is the "lead with social content, push the grid down further"
  // follow-up the same ROADMAP line flagged as still open: `ownActivity`
  // (this person's own recent add/complete/rate/trophy events, from the
  // same activity_events table /feed already reads for people you follow
  // — see page.js) is merged in alongside comments received, sorted into
  // one real reverse-chronological activity trail instead of only ever
  // showing what other people said on this profile's wall. `children`
  // (ShowcaseSection + custom lists, passed down from page.js) renders
  // right after this block and before the tab bar/grid below, so curated
  // highlights and the raw collection are both now genuinely secondary,
  // scroll-to-browse content rather than the first thing on the page.
  // Hidden while the Comments tab itself is open, since re-showing the
  // same few comments right above the full list would be noise, not a
  // signal — the non-comment rows disappear too in that case, for the
  // same "don't show a second, partial feed right above a full one"
  // reason, even though they're not literally duplicated on that tab.
  const mergedActivity = useMemo(() => {
    const fromComments = (comments || []).map((c) => ({
      kind: 'comment',
      key: `comment-${c.id}`,
      created_at: c.created_at,
      comment: c,
    }));
    const fromEvents = (ownActivity || []).map((e) => ({
      kind: 'activity',
      key: `activity-${e.id}`,
      created_at: e.created_at,
      event: e,
    }));
    return [...fromComments, ...fromEvents]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, MAX_ACTIVITY_PREVIEW);
  }, [comments, ownActivity]);

  return (
    <div>
      {mergedActivity.length > 0 && tab !== 'comments' && (
        <div className="profile-activity">
          <h3 className="profile-activity-heading">Recent activity</h3>
          {mergedActivity.map((row) => {
            if (row.kind === 'comment') {
              const c = row.comment;
              return (
                <div className="profile-activity-item" key={row.key}>
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
              );
            }

            const e = row.event;
            const isTrophy = e.event_type === 'trophy' && e.trophy;
            return (
              <div className="profile-activity-item" key={row.key}>
                {isTrophy ? (
                  <div className="profile-activity-avatar profile-activity-avatar-trophy">
                    <span className={`feed-trophy-dot tier-${e.trophy.tier}`} aria-hidden="true" />
                  </div>
                ) : e.game?.cover ? (
                  <div className="profile-activity-avatar profile-activity-avatar-cover">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.game.cover} alt="" />
                  </div>
                ) : (
                  <div className="profile-activity-avatar profile-activity-avatar-cover">
                    {(e.game?.title || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="profile-activity-body">
                  <div className="profile-activity-meta">
                    {activityVerb(e.event_type)}{' '}
                    <strong>{isTrophy ? e.trophy.name : e.game?.title}</strong>
                    {e.event_type === 'rated' && Number(e.game?.rating) > 0 ? (
                      <span style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                        <StarRating value={Number(e.game.rating)} size={12} />
                      </span>
                    ) : null}
                    {' · '}
                    {new Date(e.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
          {comments.length > 0 && (
            <button type="button" className="profile-activity-seeall" onClick={() => setTab('comments')}>
              See all {comments.length} comment{comments.length === 1 ? '' : 's'} →
            </button>
          )}
        </div>
      )}

      {children}

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
