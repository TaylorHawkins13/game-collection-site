import { describe, it, expect } from 'vitest';
import { normalizeTitle, findPossibleDuplicates } from './duplicateCheck';

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeTitle('Chrono Trigger')).toBe('chrono trigger');
    expect(normalizeTitle('chrono  trigger!')).toBe('chrono trigger');
    expect(normalizeTitle("Baldur's Gate 3")).toBe('baldurs gate 3');
  });

  it('handles empty/nullish input without throwing', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle(null)).toBe('');
    expect(normalizeTitle(undefined)).toBe('');
  });
});

describe('findPossibleDuplicates', () => {
  const existing = [
    { id: 1, item_type: 'game', title: 'The Legend of Zelda: Breath of the Wild' },
    { id: 2, item_type: 'game', title: 'Chrono Trigger' },
    { id: 3, item_type: 'comic', title: 'Breath of the Wild' }, // different type, should not match
  ];

  it('matches a clear substring against an existing title', () => {
    const dupes = findPossibleDuplicates('Breath of the Wild', 'game', existing);
    expect(dupes.map((d) => d.id)).toEqual([1]);
  });

  it('matches an exact normalized title', () => {
    const dupes = findPossibleDuplicates('chrono  trigger!', 'game', existing);
    expect(dupes.map((d) => d.id)).toEqual([2]);
  });

  it('never matches across a different item_type', () => {
    const dupes = findPossibleDuplicates('Breath of the Wild', 'comic', existing);
    expect(dupes.map((d) => d.id)).toEqual([3]);
  });

  it('excludes excludeId so editing an item never flags itself', () => {
    const dupes = findPossibleDuplicates('Chrono Trigger', 'game', existing, 2);
    expect(dupes).toEqual([]);
  });

  it('returns nothing for a title too short to search on', () => {
    expect(findPossibleDuplicates('Hi', 'game', existing)).toEqual([]);
  });
});
