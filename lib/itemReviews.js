// Small pure helper for the per-item reviews feature (ROADMAP.md
// "Per-item reviews (separate from personal rating)") — kept separate
// from ItemReviews.jsx so the one piece of real logic here (averaging a
// list of reviews' star ratings) has actual test coverage, the same as
// every other lib/ helper on this project. `rating` comes back from
// Supabase as a string (it's a `numeric` column — see
// item-reviews-migration.sql — and supabase-js doesn't coerce numeric
// columns to JS numbers, same reason buildCollectibleDetail wraps
// `games.rating` in Number() too), so this normalizes before averaging.
export function averageRating(reviews) {
  if (!reviews || reviews.length === 0) return null;
  const total = reviews.reduce((sum, r) => sum + Number(r.rating), 0);
  return total / reviews.length;
}
