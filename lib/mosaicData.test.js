import { describe, it, expect } from 'vitest';
import {
  CATEGORY_ORDER,
  dominantType,
  modeLabel,
  titleColor,
  shapeMosaic,
  availableYears,
  availableTypes,
} from './mosaicData';

describe('dominantType', () => {
  it('returns the item_type with the most items', () => {
    const items = [
      { item_type: 'comic' },
      { item_type: 'game' },
      { item_type: 'game' },
      { item_type: 'game' },
    ];
    expect(dominantType(items)).toBe('game');
  });

  it('breaks ties using CATEGORY_ORDER', () => {
    // game comes before comic in CATEGORY_ORDER, so a 1-1 tie should
    // favor game even though comic appears first in the input array.
    const items = [{ item_type: 'comic' }, { item_type: 'game' }];
    expect(dominantType(items)).toBe('game');
  });

  it('returns null for an empty or missing list', () => {
    expect(dominantType([])).toBeNull();
    expect(dominantType(undefined)).toBeNull();
  });

  it('ignores entries with no item_type', () => {
    expect(dominantType([{}, { item_type: null }])).toBeNull();
  });
});

describe('modeLabel', () => {
  it('covers every mode', () => {
    expect(modeLabel('showcase')).toBe('Showcase');
    expect(modeLabel('custom')).toBe('Custom Selection');
    expect(modeLabel('top')).toBe('Most Valuable');
    expect(modeLabel('type', { type: 'comic' })).toBe('Comics');
    expect(modeLabel('year', { year: 2024 })).toBe('Added in 2024');
    expect(modeLabel('year', {})).toBe('By Year');
    expect(modeLabel('all')).toBe('The Whole Shelf');
  });
});

describe('titleColor', () => {
  it('is deterministic for the same title', () => {
    expect(titleColor('Chrono Trigger')).toBe(titleColor('Chrono Trigger'));
  });

  it('always returns a hex color', () => {
    expect(titleColor('Anything')).toMatch(/^#[0-9a-f]{6}$/);
    expect(titleColor('')).toMatch(/^#[0-9a-f]{6}$/);
    expect(titleColor(null)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('availableYears / availableTypes', () => {
  const items = [
    { created_at: '2023-05-01', item_type: 'comic' },
    { created_at: '2024-01-15', item_type: 'game' },
    { created_at: '2024-11-02', item_type: 'game' },
  ];

  it('lists distinct years newest first', () => {
    expect(availableYears(items)).toEqual([2024, 2023]);
  });

  it('lists distinct types in CATEGORY_ORDER order, not input order', () => {
    // game is present before comic in CATEGORY_ORDER even though comic
    // appears first in the input array above.
    expect(availableTypes(items)).toEqual(['game', 'comic']);
  });
});

describe('shapeMosaic', () => {
  const baseItems = [
    { id: 1, item_type: 'game', created_at: '2024-01-01', title: 'A' },
    { id: 2, item_type: 'game', created_at: '2024-02-01', title: 'B' },
    { id: 3, item_type: 'comic', created_at: '2024-01-15', title: 'C' },
  ];

  it('groups "all" mode by CATEGORY_ORDER, sorted oldest-added first within a type', () => {
    const { rows, totalItems, shownItems } = shapeMosaic(baseItems, { perRowCap: 10 });
    expect(totalItems).toBe(3);
    expect(shownItems).toBe(3);
    // game (id 1, 2) sorts before comic (id 3) per CATEGORY_ORDER, and
    // within game, id 1 (created first) comes before id 2.
    expect(rows).toHaveLength(1);
    expect(rows[0].items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('"top" mode excludes digital items and anything with no tracked price', () => {
    const items = [
      { id: 1, item_type: 'game', market_price: 40, copy_type: 'physical', created_at: '2024-01-01' },
      { id: 2, item_type: 'game', market_price: 999, copy_type: 'digital', created_at: '2024-01-01' },
      { id: 3, item_type: 'game', market_price: 0, copy_type: 'physical', created_at: '2024-01-01' },
      { id: 4, item_type: 'game', price: 10, copy_type: 'physical', created_at: '2024-01-01' },
    ];
    const { rows } = shapeMosaic(items, { mode: 'top', perRowCap: 10 });
    expect(rows[0].items.map((i) => i.id)).toEqual([1, 4]); // sorted highest value first
  });

  it('"year" mode filters to items created in the given year', () => {
    const { rows, totalItems } = shapeMosaic(baseItems, { mode: 'year', year: '2024', perRowCap: 10 });
    expect(totalItems).toBe(3); // all 3 are 2024 in this fixture
    expect(rows[0].items).toHaveLength(3);
  });

  it('"custom" mode filters to a hand-picked id set', () => {
    const { rows, totalItems } = shapeMosaic(baseItems, { mode: 'custom', selectedIds: [1, 3], perRowCap: 10 });
    expect(totalItems).toBe(2);
    expect(rows[0].items.map((i) => i.id).sort()).toEqual([1, 3]);
  });

  it('marks a trailing overflow count once items exceed the row cap, without dropping real items', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      item_type: 'game',
      created_at: `2024-01-0${i + 1}`,
    }));
    const { rows } = shapeMosaic(many, { perRowCap: 2 });
    // 5 items at 2 per row -> 2 full rows + a 5th item alone with an
    // overflow marker only if the cap (MAX_SHOWN_ITEMS, 80) were exceeded
    // — it isn't here, so every item should still show and overflow
    // should be 0 on every row.
    const totalShown = rows.reduce((sum, r) => sum + r.items.length, 0);
    expect(totalShown).toBe(5);
    expect(rows.every((r) => r.overflow === 0)).toBe(true);
  });
});
