// Powers the "you might already have this" heads-up in GameModal — a
// soft warning, not a blocker, since real duplicates are often
// intentional (a second platform's copy, replacing a lost one, etc.).

// Lowercase, strip punctuation, collapse whitespace — good enough to
// catch near-misses like "Chrono Trigger" vs "chrono  trigger!" without
// pulling in a full fuzzy-match library. Exported so other title-matching
// features (like the collection comparison page) can reuse the same rules.
export function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Finds items already in `existingItems` (the signed-in user's own
// collection) that look like the same thing as `title`/`itemType` — same
// item type, and titles that match once normalized, or where one is a
// clear substring of the other (catches "Breath of the Wild" vs "The
// Legend of Zelda: Breath of the Wild"). Excludes `excludeId` so editing
// an item doesn't flag itself as a duplicate of itself.
export function findPossibleDuplicates(title, itemType, existingItems, excludeId) {
  const norm = normalizeTitle(title);
  if (norm.length < 3) return [];
  return (existingItems || []).filter((item) => {
    if (excludeId && item.id === excludeId) return false;
    if (item.item_type !== itemType) return false;
    const itemNorm = normalizeTitle(item.title);
    if (!itemNorm) return false;
    return itemNorm === norm || itemNorm.includes(norm) || norm.includes(itemNorm);
  });
}
