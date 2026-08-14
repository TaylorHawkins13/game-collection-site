'use client';

import { useState } from 'react';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import SeriesModal from '@/components/SeriesModal';
import { seriesSupported } from '@/lib/seriesLookup';
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
}) {
  const hasTrophies = achievementDefs && achievementDefs.length > 0;
  const [tab, setTab] = useState('collection');
  const [seriesItem, setSeriesItem] = useState(null);

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
            <div>No items on this shelf yet.</div>
          </div>
        ) : (
          <div className="grid" style={{ marginBottom: 40 }}>
            {games.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                currency={currency}
                onClick={seriesSupported(g.item_type) ? () => setSeriesItem(g) : undefined}
              />
            ))}
          </div>
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
        <TrophyCase defs={achievementDefs} earnedKeys={earnedKeys} rarity={rarity} />
      )}

      {tab === 'comments' && (
        <CommentSection profileId={profileId} initialComments={comments} canComment={canComment} />
      )}
    </div>
  );
}
