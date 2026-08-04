'use client';

import { useEffect, useState } from 'react';
import { getCoverColor, colorToCss, shadeColor, readableTextColor } from '@/lib/coverColor';

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function GameCard({ game, onClick }) {
  const stars = game.rating ? '★'.repeat(game.rating) + '☆'.repeat(5 - game.rating) : '';
  const isComic = game.item_type === 'comic';
  const [artColor, setArtColor] = useState(null);

  // Pull a dominant color from the cover art (when the image host allows
  // it) so the slab strip and nameplate feel tied to the artwork instead
  // of always using the same fixed accent color.
  useEffect(() => {
    let active = true;
    if (game.cover) {
      getCoverColor(game.cover).then((c) => {
        if (active) setArtColor(c);
      });
    } else {
      setArtColor(null);
    }
    return () => {
      active = false;
    };
  }, [game.cover]);

  const titleStyle = artColor
    ? {
        background: `linear-gradient(135deg, ${colorToCss(artColor)}, ${shadeColor(artColor, -45)})`,
        color: readableTextColor(artColor),
      }
    : undefined;
  const stripStyle = artColor
    ? {
        background: `linear-gradient(90deg, ${shadeColor(artColor, 50)}, ${colorToCss(artColor)}, ${shadeColor(artColor, -35)})`,
        backgroundSize: '200% 100%',
      }
    : undefined;

  const isCard = game.item_type === 'trading_card';
  const isVinyl = game.item_type === 'vinyl';
  const isBook = game.item_type === 'book';
  const isDvd = game.item_type === 'dvd';
  const isCd = game.item_type === 'cd';
  const isMediaLike = isBook || isDvd || isCd;

  const statRows = [];
  if (isComic) {
    statRows.push({ label: 'Series', value: game.series || game.title });
    statRows.push({ label: 'Issue', value: game.issue_number || '—' });
    statRows.push({ label: 'Publisher', value: game.publisher || '—' });
    if (game.writer || game.artist) {
      statRows.push({ label: 'Creators', value: [game.writer, game.artist].filter(Boolean).join(' / ') });
    }
    statRows.push({ label: 'Grade', value: game.grade || 'Ungraded' });
  } else if (isCard) {
    statRows.push({ label: 'Set', value: game.card_set || '—' });
    statRows.push({ label: 'Card #', value: game.card_number || '—' });
    statRows.push({ label: 'Player', value: game.player_name || '—' });
    statRows.push({ label: 'Brand', value: game.publisher || '—' });
    statRows.push({ label: 'Grade', value: game.grade || 'Ungraded' });
  } else if (isVinyl) {
    statRows.push({ label: 'Artist', value: game.artist || '—' });
    statRows.push({ label: 'Label', value: game.publisher || '—' });
    statRows.push({ label: 'Format', value: game.format || '—' });
    if (game.edition) statRows.push({ label: 'Edition', value: game.edition });
  } else if (isMediaLike) {
    const creatorLabel = isDvd ? 'Director' : isCd ? 'Artist' : 'Author';
    const publisherLabel = isDvd ? 'Studio' : isCd ? 'Label' : 'Publisher';
    statRows.push({ label: creatorLabel, value: game.writer || '—' });
    statRows.push({ label: publisherLabel, value: game.publisher || '—' });
    statRows.push({ label: 'Format', value: game.format || '—' });
    if (game.edition) statRows.push({ label: 'Edition', value: game.edition });
  } else {
    statRows.push({
      label: 'Platform',
      value: game.platforms && game.platforms.length ? game.platforms.join(', ') : 'Unknown',
    });
    statRows.push({ label: 'Genre', value: game.genre || '—' });
    statRows.push({ label: 'Progress', value: cap(game.play_status) || 'Backlog' });
    if (game.condition) statRows.push({ label: 'Condition', value: game.condition });
  }
  statRows.push({ label: 'Rating', value: stars || 'Unrated', isRating: true });

  return (
    <div className={`card${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <div className={`card-ownership-flag ${game.ownership}`}>{game.ownership}</div>
      {game.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="cover"
          src={game.cover}
          alt={game.title}
          onError={(e) => {
            e.currentTarget.outerHTML = '<div class="cover placeholder">No Cover</div>';
          }}
        />
      ) : (
        <div className="cover placeholder">No Cover</div>
      )}
      <div className="card-title" style={titleStyle}>{game.title}</div>
      <div className="card-body">
        <div className="stat-list">
          <div className="slab-strip" style={stripStyle} aria-hidden="true" />
          <div className="slab-header">
            <span className="slab-wordmark">SHELF LIFE</span>
            <span className="slab-cert">#{game.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="stat-rows">
            {statRows.map((row) => (
              <div className="stat-row" key={row.label}>
                <span className="stat-label">{row.label}</span>
                <span className={`stat-value${row.isRating && stars ? ' stars' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        {(((isComic || isCard) && game.is_variant) || (game.tags || []).length > 0) && (
          <div className="badge-row">
            {(isComic || isCard) && game.is_variant && (
              <span className="badge tag">{isCard ? 'Parallel' : 'Variant'}</span>
            )}
            {(game.tags || []).map((t) => (
              <span className="badge tag" key={t}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
