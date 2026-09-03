import { describe, it, expect } from 'vitest';
import { titleVariants } from './igdbSearch';

// Covers the Sep 2026 fallback fix — flagged live from real
// refresh-upcoming-releases cron logs ("no franchise or collection tag
// on matched game" for "MegaMan X" and "Pokemon Leaf Green"). See
// getFranchiseGames()'s comment in igdbSearch.js for the full story;
// these tests only cover titleVariants()'s pure spelling-guess logic,
// not the live IGDB retry loop that consumes it.
describe('titleVariants', () => {
  it('inserts a space at a camelCase boundary', () => {
    expect(titleVariants('MegaMan X')).toContain('Mega Man X');
    expect(titleVariants('PacMan')).toContain('Pac Man');
  });

  it('does not touch a title with no camelCase boundary or Pokemon subtitle', () => {
    // Real production case (Sep 2026 log): "Lemmings" matching the wrong
    // IGDB candidate among several real ones is a different problem
    // (candidate ranking, not spelling) — titleVariants() correctly has
    // nothing to offer here, on purpose.
    expect(titleVariants('Lemmings')).toEqual([]);
    expect(titleVariants('Chrono Trigger')).toEqual([]);
  });

  it('merges the last two words of a Pokemon version name IGDB-style', () => {
    expect(titleVariants('Pokemon Leaf Green')).toContain('Pokemon LeafGreen');
    expect(titleVariants('Pokémon Fire Red')).toContain('Pokémon FireRed');
  });

  it('does not apply the Pokemon merge to a two-word Pokemon title', () => {
    // No subtitle to merge — "Pokemon Emerald" is already one word past
    // "Pokemon", nothing for the last-two-words merge to act on safely.
    expect(titleVariants('Pokemon Emerald')).toEqual([]);
  });

  it('does not apply the Pokemon merge to an unrelated title', () => {
    expect(titleVariants('Grand Theft Auto V')).toEqual([]);
  });

  it('returns both variants when a title matches both patterns', () => {
    // Contrived, but confirms the two transforms compose rather than
    // short-circuiting each other.
    const variants = titleVariants('Pokemon SunMoon Edition');
    expect(variants).toContain('Pokemon Sun Moon Edition');
    expect(variants).toContain('Pokemon SunMoonEdition');
  });

  it('returns an empty array when nothing changes', () => {
    expect(titleVariants('Half-Life 2')).toEqual([]);
  });
});
