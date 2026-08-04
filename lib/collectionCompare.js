import { normalizeTitle } from './duplicateCheck';

// Powers the "Compare collections" page — splits two people's owned items
// into what they both have, what only the viewer has, and what only the
// other collector has. Uses the same normalized-title matching as the
// duplicate-warning feature so "Chrono Trigger" and "chrono trigger!" still
// count as the same item.
//
// Only `ownership === 'owned'` items go into the comparison on either side
// — wishlist/sold items aren't really "do you have this too" material.
export function buildComparison(myGames, theirGames) {
  const mine = (myGames || []).filter((g) => g.ownership === 'owned');
  const theirs = (theirGames || []).filter((g) => g.ownership === 'owned');

  const mineByKey = new Map();
  for (const g of mine) {
    const key = `${g.item_type}::${normalizeTitle(g.title)}`;
    if (!mineByKey.has(key)) mineByKey.set(key, g);
  }
  const theirsByKey = new Map();
  for (const g of theirs) {
    const key = `${g.item_type}::${normalizeTitle(g.title)}`;
    if (!theirsByKey.has(key)) theirsByKey.set(key, g);
  }

  const shared = [];
  const onlyMine = [];
  const onlyTheirs = [];

  for (const [key, item] of mineByKey) {
    if (theirsByKey.has(key)) {
      shared.push(item);
    } else {
      onlyMine.push(item);
    }
  }
  for (const [key, item] of theirsByKey) {
    if (!mineByKey.has(key)) {
      onlyTheirs.push(item);
    }
  }

  const sortByTitle = (a, b) => a.title.localeCompare(b.title);
  shared.sort(sortByTitle);
  onlyMine.sort(sortByTitle);
  onlyTheirs.sort(sortByTitle);

  return { shared, onlyMine, onlyTheirs };
}

// Shelf Life trophy counts (the collection-milestone badges, not real
// Xbox/PlayStation trophies) for one person, given the full achievement_defs
// catalog and the list of keys they've earned.
export function trophyStats(achievementDefs, earnedKeys) {
  const earnedSet = new Set(earnedKeys || []);
  const earnedDefs = (achievementDefs || []).filter((d) => earnedSet.has(d.key));
  return {
    total: earnedDefs.length,
    platinum: earnedDefs.filter((d) => d.tier === 'platinum').length,
  };
}
