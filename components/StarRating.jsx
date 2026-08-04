'use client';

// Shared 5-star display used everywhere a rating shows up (GameCard, Play
// next, recommendations, the activity feed) plus the interactive editable
// version in GameModal. Ratings go in 0.5 steps, so each star can be
// empty, half, or full — drawn as a dim background star with a colored
// foreground star clipped to 0/50/100% width on top of it, rather than
// relying on a single half-star text character (font support for those
// is inconsistent).
//
// Interactive mode splits each star into a left half (sets n-0.5) and
// right half (sets n) click target so half-star values are reachable
// without a separate slider.
export default function StarRating({ value = 0, size = 16, interactive = false, onChange }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className="star-rating" style={{ fontSize: size }}>
      {stars.map((n) => {
        const fillPct = Math.max(0, Math.min(1, value - (n - 1))) * 100;
        return (
          <span key={n} className="star-rating-slot">
            <span className="star-rating-bg" aria-hidden="true">★</span>
            <span className="star-rating-fg" style={{ width: `${fillPct}%` }} aria-hidden="true">★</span>
            {interactive && (
              <>
                <button
                  type="button"
                  className="star-rating-hit star-rating-hit-left"
                  aria-label={`Rate ${n - 0.5} stars`}
                  onClick={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
                />
                <button
                  type="button"
                  className="star-rating-hit star-rating-hit-right"
                  aria-label={`Rate ${n} stars`}
                  onClick={() => onChange(value === n ? 0 : n)}
                />
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}
