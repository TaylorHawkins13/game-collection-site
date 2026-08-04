'use client';

import { useMemo, useState } from 'react';
import CollapseToggle from './CollapseToggle';

// Weighted-random pick — higher weight means more likely, not guaranteed,
// so hitting "Try another" doesn't just cycle the same top pick over and
// over on a small backlog.
function weightedPick(candidates, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Suggests one game to play next from your own backlog (falling back to
// wishlist if the backlog's empty), weighted toward the genres/platforms
// of games you've already rated highly. Purely client-side — everything
// it needs is already in the `games` prop, no extra fetch.
export default function PlayNextWidget({ games, onOpen, collapsed, onToggleCollapse }) {
  const { pool, genreScore, platformScore, hasRatings } = useMemo(() => {
    const rated = games.filter((g) => g.item_type === 'game' && g.rating >= 4);
    const genreScore = {};
    const platformScore = {};
    rated.forEach((g) => {
      if (g.genre) genreScore[g.genre] = (genreScore[g.genre] || 0) + g.rating;
      (g.platforms || []).forEach((p) => {
        platformScore[p] = (platformScore[p] || 0) + g.rating;
      });
    });

    let pool = games.filter((g) => g.item_type === 'game' && g.ownership === 'owned' && g.play_status === 'backlog');
    if (pool.length === 0) {
      pool = games.filter((g) => g.item_type === 'game' && g.ownership === 'wishlist');
    }
    return { pool, genreScore, platformScore, hasRatings: rated.length > 0 };
  }, [games]);

  const [suggestion, setSuggestion] = useState(null);

  function suggest() {
    // Exclude the current suggestion so "Try another" on a small backlog
    // doesn't just hand the same game right back.
    const candidates = pool.length > 1 && suggestion ? pool.filter((g) => g.id !== suggestion.id) : pool;
    const weights = candidates.map((g) => {
      let w = 1;
      if (g.genre && genreScore[g.genre]) w += genreScore[g.genre];
      (g.platforms || []).forEach((p) => {
        if (platformScore[p]) w += platformScore[p];
      });
      return w;
    });
    setSuggestion(weightedPick(candidates, weights));
  }

  if (pool.length === 0) {
    return (
      <div className="playnext-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 className="playnext-heading" style={{ margin: 0 }}>What should I play next?</h3>
          <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
        {!collapsed && (
          <p className="sub" style={{ margin: '10px 0 0' }}>
            Nothing in your backlog or wishlist yet — add a game and mark it Backlog to get a suggestion here.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="playnext-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="playnext-heading" style={{ margin: 0 }}>What should I play next?</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!collapsed && (
            <button className="btn-ghost" type="button" onClick={suggest}>
              {suggestion ? 'Try another' : 'Suggest something'}
            </button>
          )}
          <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
        </div>
      </div>
      {!collapsed && suggestion && (
        <>
          <button type="button" className="playnext-suggestion" onClick={() => onOpen(suggestion)}>
            {suggestion.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="playnext-suggestion-cover"
                src={suggestion.cover}
                alt={suggestion.title}
                onError={(e) => {
                  e.currentTarget.outerHTML = '<div class="playnext-suggestion-cover placeholder">No Cover</div>';
                }}
              />
            ) : (
              <div className="playnext-suggestion-cover placeholder">No Cover</div>
            )}
            <div className="playnext-suggestion-body">
              <div className="playnext-suggestion-title">{suggestion.title}</div>
              <div className="playnext-suggestion-meta">
                {suggestion.platforms && suggestion.platforms.length ? suggestion.platforms.join(', ') : 'Unknown platform'}
                {suggestion.genre ? ` · ${suggestion.genre}` : ''}
              </div>
              {suggestion.rating > 0 && (
                <div className="playnext-suggestion-meta stars">
                  {'★'.repeat(suggestion.rating)}{'☆'.repeat(5 - suggestion.rating)}
                </div>
              )}
            </div>
          </button>
          <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {hasRatings
              ? "Picked from your backlog, weighted toward genres/platforms you've rated highly."
              : 'Picked at random — rate a few games 4-5 stars and picks will start leaning toward what you actually like.'}
          </p>
        </>
      )}
    </div>
  );
}
