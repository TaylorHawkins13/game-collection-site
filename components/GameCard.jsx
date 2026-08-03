'use client';

export default function GameCard({ game, onClick }) {
  const stars = game.rating ? '★'.repeat(game.rating) + '☆'.repeat(5 - game.rating) : '';
  const platformText = game.platforms && game.platforms.length ? game.platforms.join(', ') : 'Unknown platform';

  return (
    <div className={`card${onClick ? ' clickable' : ''}`} onClick={onClick}>
      {game.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="cover"
          src={game.cover}
          alt={game.title}
          onError={(e) => {
            e.currentTarget.outerHTML = '<div class="cover placeholder">🎮</div>';
          }}
        />
      ) : (
        <div className="cover placeholder">🎮</div>
      )}
      <div className="card-body">
        <div className="card-title">{game.title}</div>
        <div className="card-meta">
          {platformText}
          {game.genre ? ` · ${game.genre}` : ''}
        </div>
        {stars && <div className="stars">{stars}</div>}
        <div className="badge-row">
          <span className={`badge ${game.ownership}`}>{game.ownership}</span>
          {game.play_status && <span className="badge play">{game.play_status}</span>}
          {(game.tags || []).map((t) => (
            <span className="badge tag" key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
