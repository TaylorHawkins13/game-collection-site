'use client';

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function GameCard({ game, onClick }) {
  const stars = game.rating ? '★'.repeat(game.rating) + '☆'.repeat(5 - game.rating) : '';
  const isComic = game.item_type === 'comic';

  const statRows = [];
  if (isComic) {
    statRows.push({ label: 'Series', value: game.series || game.title });
    statRows.push({ label: 'Issue', value: game.issue_number || '—' });
    statRows.push({ label: 'Publisher', value: game.publisher || '—' });
    if (game.writer || game.artist) {
      statRows.push({ label: 'Creators', value: [game.writer, game.artist].filter(Boolean).join(' / ') });
    }
    statRows.push({ label: 'Grade', value: game.grade || 'Ungraded' });
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
      <div className="card-title">{game.title}</div>
      <div className="card-body">
        <div className="stat-list">
          {statRows.map((row) => (
            <div className="stat-row" key={row.label}>
              <span className="stat-label">{row.label}</span>
              <span className={`stat-value${row.isRating && stars ? ' stars' : ''}`}>{row.value}</span>
            </div>
          ))}
        </div>
        {((isComic && game.is_variant) || (game.tags || []).length > 0) && (
          <div className="badge-row">
            {isComic && game.is_variant && <span className="badge tag">Variant</span>}
            {(game.tags || []).map((t) => (
              <span className="badge tag" key={t}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
