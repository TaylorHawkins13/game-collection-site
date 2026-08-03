'use client';

export default function GameCard({ game, onClick }) {
  const stars = game.rating ? '★'.repeat(game.rating) + '☆'.repeat(5 - game.rating) : '';
  const isComic = game.item_type === 'comic';

  let metaText;
  if (isComic) {
    const parts = [];
    if (game.series) parts.push(game.issue_number ? `${game.series} ${game.issue_number}` : game.series);
    else if (game.issue_number) parts.push(game.issue_number);
    if (game.publisher) parts.push(game.publisher);
    metaText = parts.length ? parts.join(' · ') : 'Comic';
  } else {
    const platformText = game.platforms && game.platforms.length ? game.platforms.join(', ') : 'Unknown platform';
    metaText = platformText + (game.genre ? ` · ${game.genre}` : '');
  }

  return (
    <div className={`card${onClick ? ' clickable' : ''}`} onClick={onClick}>
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
      <div className="card-body">
        <div className="card-title">{game.title}</div>
        <div className="card-meta">{metaText}</div>
        {stars && <div className="stars">{stars}</div>}
        <div className="badge-row">
          <span className={`badge ${game.ownership}`}>{game.ownership}</span>
          {isComic ? (
            <>
              {game.grade && <span className="badge play">{game.grade}</span>}
              {game.is_variant && <span className="badge tag">Variant</span>}
            </>
          ) : (
            game.play_status && <span className="badge play">{game.play_status}</span>
          )}
          {(game.tags || []).map((t) => (
            <span className="badge tag" key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
