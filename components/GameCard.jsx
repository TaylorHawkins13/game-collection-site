'use client';

import { useEffect, useState } from 'react';
import { getCoverColor, colorToCss, shadeColor, readableTextColor } from '@/lib/coverColor';
import { currencySymbol } from '@/lib/currency';
import StarRating from './StarRating';

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function GameCard({ game, onClick, featured = false }) {
  // Supabase can hand numeric columns back as strings — coerce before
  // any arithmetic/comparison.
  const rating = Number(game.rating) || 0;
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
  const isConsole = game.item_type === 'console';
  const isFunko = game.item_type === 'funko_pop';
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
  } else if (isConsole) {
    statRows.push({ label: 'Manufacturer', value: game.publisher || '—' });
    statRows.push({ label: 'Storage / variant', value: game.format || '—' });
    if (game.edition) statRows.push({ label: 'Special edition', value: game.edition });
    if (game.region) statRows.push({ label: 'Region', value: game.region });
    if (game.condition) statRows.push({ label: 'Condition', value: game.condition });
    if (game.completeness) {
      const compLabel = { loose: 'Loose', cib: 'CIB', box: 'Box only' }[game.completeness] || game.completeness;
      statRows.push({ label: 'Completeness', value: compLabel });
    }
    statRows.push({ label: 'Grade', value: game.grade || 'Ungraded' });
  } else if (isFunko) {
    statRows.push({ label: 'Series / line', value: game.card_set || '—' });
    statRows.push({ label: 'Pop! #', value: game.card_number || '—' });
    statRows.push({ label: 'Character', value: game.player_name || '—' });
    if (game.publisher) statRows.push({ label: 'Exclusive to', value: game.publisher });
    if (game.condition) statRows.push({ label: 'Box condition', value: game.condition });
    statRows.push({ label: 'Grade', value: game.grade || 'Ungraded' });
  } else {
    statRows.push({
      label: 'Platform',
      value: game.platforms && game.platforms.length ? game.platforms.join(', ') : 'Unknown',
    });
    if (game.region) statRows.push({ label: 'Region', value: game.region });
    statRows.push({ label: 'Genre', value: game.genre || '—' });
    statRows.push({ label: 'Progress', value: cap(game.play_status) || 'Backlog' });
    if (game.condition) statRows.push({ label: 'Condition', value: game.condition });
    if (game.completeness) {
      const compLabel = { loose: 'Loose', cib: 'CIB', box: 'Box only' }[game.completeness] || game.completeness;
      statRows.push({ label: 'Completeness', value: compLabel });
    }
    if (game.trophy_platinum || game.trophy_completion != null) {
      statRows.push({
        label: 'Trophies',
        value: game.trophy_platinum ? 'Platinum' : `${game.trophy_completion}%`,
      });
    }
  }
  if (game.market_price != null) {
    // Older rows checked before regional pricing shipped never got a
    // currency stored — those were always USD back then, so that's a safe
    // fallback rather than just guessing the viewer's own currency.
    statRows.push({
      label: 'Market value',
      value: `${currencySymbol(game.market_price_currency || 'USD')}${game.market_price}`,
    });
  }
  statRows.push({
    label: 'Rating',
    value: rating > 0 ? <StarRating value={rating} size={13} /> : 'Unrated',
    isRating: true,
  });

  return (
    <div className={`card${onClick ? ' clickable' : ''}${featured ? ' featured' : ''}`} onClick={onClick}>
      {featured && <div className="card-featured-flag">Featured</div>}
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
                <span className="stat-value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        {(((isComic || isCard || isFunko) && game.is_variant) || game.copy_type || game.fully_completed || game.showcase_order != null || (game.tags || []).length > 0) && (
          <div className="badge-row">
            {(isComic || isCard || isFunko) && game.is_variant && (
              <span className="badge tag">{isFunko ? 'Chase' : isCard ? 'Parallel' : 'Variant'}</span>
            )}
            {game.copy_type && (
              <span className={`badge tag copy-${game.copy_type}`}>{cap(game.copy_type)}</span>
            )}
            {game.fully_completed && (
              <span className="badge tag complete-100">100% Complete</span>
            )}
            {game.showcase_order != null && (
              <span className="badge tag showcase-badge">Showcased</span>
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
