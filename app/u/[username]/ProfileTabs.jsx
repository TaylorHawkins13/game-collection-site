'use client';

import { useState } from 'react';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import CommentSection from './CommentSection';

export default function ProfileTabs({ games, achievementDefs, earnedKeys, comments, canComment, profileId }) {
  const hasTrophies = achievementDefs && achievementDefs.length > 0;
  const [tab, setTab] = useState('collection');

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
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        ))}

      {tab === 'trophies' && hasTrophies && (
        <TrophyCase defs={achievementDefs} earnedKeys={earnedKeys} />
      )}

      {tab === 'comments' && (
        <CommentSection profileId={profileId} initialComments={comments} canComment={canComment} />
      )}
    </div>
  );
}
