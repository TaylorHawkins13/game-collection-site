import { normalizeTitle } from './duplicateCheck';

// Backs the "Full physical-release catalogue per console" view
// (app/dashboard/catalogue) — works out which of the signed-in user's own
// `game` items count as "owned" for a specific platform, so the catalogue
// grid can grey out everything else the same way SeriesGrid already does
// for series/master-set entries.
//
// Fixed (Aug 2026 — flagged directly right after shipping the first
// version: "surely we can fix this so it's always accurate"). That first
// version compared a game's free-typed `platform` value against the
// catalogue's target platform name by case-insensitive substring
// containment — a real gap, since a pure abbreviation like "PS2" is
// neither a substring of nor contains "PlayStation 2", so a genuinely-
// owned game could show as "not logged." Matching now runs through IGDB's
// own platform ids instead of ever comparing free-typed names directly:
// app/dashboard/catalogue/page.js resolves every distinct platform string
// in the signed-in user's collection to its real IGDB platform id
// (lib/igdbPlatformCatalogue.js's resolvePlatformIds — the exact same
// resolution the catalogue's own chosen platform already goes through),
// and this function just checks id equality — as accurate as IGDB's own
// platform database is, not a guess built on hand-maintained aliases.
//
// The one remaining gap: a platform IGDB itself has no record of at all
// (a genuinely obscure/regional system, a bootleg console, or a typo far
// enough off that IGDB's search comes back empty) resolves to a null id
// on both sides, which no longer has anything to compare — that falls
// back to the same loose name comparison the original version used,
// which is a real degradation but a much smaller, more defensible one
// than "abbreviations never match" was.
function platformsLooselyMatch(a, b) {
  const x = (a || '').trim().toLowerCase();
  const y = (b || '').trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// `ownedGames` is the signed-in user's own `game`-type items (title +
// platforms only — see app/dashboard/catalogue/page.js). `ownedPlatformIds`
// is that same page's resolved `{ [platformString]: igdbId | null }` map,
// covering every distinct platform string across the whole collection.
// `targetPlatformId`/`targetPlatformName` describe the platform currently
// being browsed. A game with more than one platform tagged (see README's
// "multi-platform results" note) only needs one of them to match.
export function ownedTitleKeysForPlatform(ownedGames, ownedPlatformIds, targetPlatformId, targetPlatformName) {
  const keys = new Set();
  const idMap = ownedPlatformIds || {};
  for (const g of ownedGames || []) {
    if (!g?.title) continue;
    const platforms = g.platforms || [];
    const owns = platforms.some((p) => {
      const resolvedId = idMap[p];
      if (targetPlatformId != null && resolvedId != null) {
        return resolvedId === targetPlatformId;
      }
      // One side (or both) never resolved against IGDB at all — fall
      // back to the old loose comparison rather than treating an
      // unresolvable platform as automatically "not owned."
      return platformsLooselyMatch(p, targetPlatformName);
    });
    if (owns) keys.add(normalizeTitle(g.title));
  }
  return keys;
}
