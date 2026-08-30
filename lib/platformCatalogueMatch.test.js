import { describe, it, expect } from 'vitest';
import { ownedTitleKeysForPlatform } from './platformCatalogueMatch';

describe('ownedTitleKeysForPlatform', () => {
  it('matches by resolved IGDB platform id, even when the logged platform string is a bare abbreviation', () => {
    const games = [{ title: 'Grand Theft Auto: San Andreas', platforms: ['PS2'] }];
    // "PS2" and "PlayStation 2" share no useful substring relationship —
    // this only matches because both resolved to the same real IGDB id.
    const ownedIds = { PS2: 8 };
    expect(ownedTitleKeysForPlatform(games, ownedIds, 8, 'PlayStation 2').has('grand theft auto san andreas')).toBe(
      true
    );
  });

  it('does not match a different resolved id, even if the free-typed names loosely overlap', () => {
    const games = [{ title: 'Some Game', platforms: ['PlayStation'] }];
    // "PlayStation" is a substring of "PlayStation 2" — the old
    // name-based heuristic would have wrongly matched this; id-based
    // matching correctly tells PS1 and PS2 apart.
    const ownedIds = { PlayStation: 7 };
    expect(ownedTitleKeysForPlatform(games, ownedIds, 8, 'PlayStation 2').size).toBe(0);
  });

  it('only needs one of several platforms on a multi-platform item to match by id', () => {
    const games = [{ title: 'Skyrim', platforms: ['X360', 'PS3', 'PC'] }];
    const ownedIds = { X360: 12, PS3: 9, PC: 6 };
    expect(ownedTitleKeysForPlatform(games, ownedIds, 9, 'PlayStation 3').has('skyrim')).toBe(true);
  });

  it('falls back to a loose name comparison when a platform never resolved against IGDB', () => {
    const games = [{ title: 'Homebrew Cart', platforms: ['Some Obscure Clone Console'] }];
    // Neither side resolved (both null) — id comparison has nothing to
    // go on, so this falls back to the old substring-based check.
    const ownedIds = { 'Some Obscure Clone Console': null };
    expect(
      ownedTitleKeysForPlatform(games, ownedIds, null, 'Some Obscure Clone Console').has('homebrew cart')
    ).toBe(true);
  });

  it('falls back to loose comparison when only the owned side is unresolved', () => {
    const games = [{ title: 'Regional Cart', platforms: ['PlayStation 2 (NTSC-J)'] }];
    const ownedIds = { 'PlayStation 2 (NTSC-J)': null };
    expect(ownedTitleKeysForPlatform(games, ownedIds, 8, 'PlayStation 2 (NTSC-J)').has('regional cart')).toBe(true);
  });

  it('ignores items with no title, and treats a missing ownedPlatformIds map as empty', () => {
    const games = [{ title: '', platforms: ['PS2'] }, { title: 'No Title Match' }];
    expect(ownedTitleKeysForPlatform(games, undefined, 8, 'PlayStation 2').size).toBe(0);
  });

  it('returns an empty set for empty/null input', () => {
    expect(ownedTitleKeysForPlatform([], {}, 8, 'PlayStation 2').size).toBe(0);
    expect(ownedTitleKeysForPlatform(null, {}, 8, 'PlayStation 2').size).toBe(0);
  });
});
