'use client';

import StarRating from './StarRating';

const TYPE_LABELS = {
  game: 'Video Game',
  comic: 'Comic',
  trading_card: 'Trading Card',
  vinyl: 'Vinyl Record',
  book: 'Book',
  dvd: 'DVD / Blu-ray',
  cd: 'CD',
  console: 'Console',
  funko_pop: 'Funko Pop',
};

// Lighter-weight than GameCard — a recommendation isn't one of your own
// items (no id, ownership, condition, etc.), it's an aggregate across
// other collectors' rows for the same title. Clicking it hands off to the
// Add Item form pre-filled, same pattern as the existing "already in the
// community" suggestions while typing a title.
export default function RecommendationCard({ rec, onClick }) {
  return (
    <button type="button" className="rec-card" onClick={onClick}>
      {rec.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="rec-cover"
          src={rec.cover}
          alt={rec.title}
          onError={(e) => {
            e.currentTarget.outerHTML = '<div class="rec-cover placeholder">No Cover</div>';
          }}
        />
      ) : (
        <div className="rec-cover placeholder">No Cover</div>
      )}
      <div className="rec-body">
        <div className="rec-title">{rec.title}</div>
        <div className="rec-meta">{TYPE_LABELS[rec.item_type] || rec.item_type}</div>
        <div className="rec-meta">
          <StarRating value={Math.round(Number(rec.avg_rating) * 2) / 2} size={11} /> {rec.avg_rating} avg ·{' '}
          {rec.recommender_count} collector{rec.recommender_count === 1 ? '' : 's'} like you
        </div>
      </div>
    </button>
  );
}
