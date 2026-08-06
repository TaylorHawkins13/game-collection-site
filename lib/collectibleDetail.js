// Shared shaping logic for the collectible detail page
// (app/collectible/page.js). There's no single canonical "this game"
// row anywhere in the schema — every collector who's logged a title has
// their own independent copy of it (their own platforms, condition,
// rating, etc.), the same way a real shelf full of duplicates would
// work. This takes every matching row a viewer is allowed to see
// (already scoped by the games table's RLS policy — public collectors'
// items plus the viewer's own) and turns it into one aggregated view:
// a representative set of details plus cross-collector stats.

// Per item_type, which fields are worth showing on the detail page and
// under what label — a trimmed version of the same mapping
// components/GameCard.jsx uses per-card, since here we're summarizing
// across many collectors' entries rather than rendering one person's.
export const DETAIL_FIELDS = {
  game: [{ key: 'platforms', label: 'Platform', isArray: true }, { key: 'genre', label: 'Genre' }],
  comic: [
    { key: 'series', label: 'Series' },
    { key: 'issue_number', label: 'Issue' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'writer', label: 'Writer' },
    { key: 'artist', label: 'Artist' },
  ],
  trading_card: [
    { key: 'card_set', label: 'Set' },
    { key: 'card_number', label: 'Card #' },
    { key: 'player_name', label: 'Player' },
    { key: 'publisher', label: 'Brand' },
  ],
  vinyl: [
    { key: 'artist', label: 'Artist' },
    { key: 'publisher', label: 'Label' },
    { key: 'format', label: 'Format' },
  ],
  book: [
    { key: 'writer', label: 'Author' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'format', label: 'Format' },
  ],
  dvd: [
    { key: 'writer', label: 'Director' },
    { key: 'publisher', label: 'Studio' },
    { key: 'format', label: 'Format' },
  ],
  cd: [
    { key: 'writer', label: 'Artist' },
    { key: 'publisher', label: 'Label' },
    { key: 'format', label: 'Format' },
  ],
  console: [
    { key: 'publisher', label: 'Manufacturer' },
    { key: 'format', label: 'Storage / variant' },
  ],
  funko_pop: [
    { key: 'card_set', label: 'Series / line' },
    { key: 'card_number', label: 'Pop! #' },
    { key: 'player_name', label: 'Character' },
    { key: 'publisher', label: 'Exclusive to' },
  ],
};

// The most frequent non-empty value across every collector's copy —
// e.g. if 8 collectors logged the publisher as "Marvel" and 1 typo'd
// "marvel comics", the detail page shows the majority spelling rather
// than whichever row happened to load first.
function mostCommon(values) {
  const counts = {};
  values.forEach((v) => {
    if (!v) return;
    counts[v] = (counts[v] || 0) + 1;
  });
  let best = null;
  let bestCount = 0;
  for (const [v, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export function buildCollectibleDetail(rows, type) {
  if (!rows || rows.length === 0) return null;

  const primary = rows.find((r) => r.cover) || rows[0];
  const ownedCount = rows.filter((r) => r.ownership === 'owned').length;
  const ratings = rows.map((r) => Number(r.rating) || 0).filter((r) => r > 0);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const fieldDefs = DETAIL_FIELDS[type] || [];
  const fields = fieldDefs
    .map((def) => {
      if (def.isArray) {
        const all = new Set();
        rows.forEach((r) => (r[def.key] || []).forEach((v) => v && all.add(v)));
        const value = [...all].sort().join(', ');
        return value ? { label: def.label, value } : null;
      }
      const value = mostCommon(rows.map((r) => r[def.key]));
      return value ? { label: def.label, value } : null;
    })
    .filter(Boolean);

  return {
    primary,
    title: primary.title,
    itemType: type,
    count: rows.length,
    ownedCount,
    avgRating,
    fields,
  };
}

// Fallback shape for a game nobody's added to their shelf yet — built
// from an IGDB search result instead of any `games` rows. Used by the
// collectible detail page when a title has zero local matches, so a
// search result found via IGDB (see lib/igdbSearch.js) still has
// somewhere to land instead of a dead end.
export function buildIgdbDetail(igdbGame) {
  if (!igdbGame) return null;

  const fields = [];
  if (igdbGame.platforms?.length) fields.push({ label: 'Platform', value: igdbGame.platforms.join(', ') });
  if (igdbGame.genres?.length) fields.push({ label: 'Genre', value: igdbGame.genres.join(', ') });
  if (igdbGame.year) fields.push({ label: 'Released', value: String(igdbGame.year) });

  return {
    primary: { cover: igdbGame.cover || igdbGame.thumb || '' },
    title: igdbGame.name,
    itemType: 'game',
    count: 0,
    ownedCount: 0,
    avgRating: null,
    fields,
    uncollected: true,
  };
}
