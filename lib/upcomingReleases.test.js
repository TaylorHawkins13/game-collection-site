import { describe, it, expect } from 'vitest';
import {
  buildSeriesKey,
  buildPlatformKey,
  buildGenreKey,
  buildResolvedInterestKey,
  distinctTrackedSeries,
  flattenUpcomingEntries,
  groupEntriesByMonth,
  computeSpendTotals,
} from './upcomingReleases';

describe('buildSeriesKey', () => {
  it('prefixes a comic series key so it can never collide with a game/platform/genre key', () => {
    expect(buildSeriesKey('comic', 'Watchmen')).toBe('comic:watchmen');
    expect(buildSeriesKey('comic', 'Watchmen')).not.toBe(buildPlatformKey('Watchmen'));
  });

  it('normalizes punctuation/spacing so near-duplicates key the same', () => {
    expect(buildSeriesKey('comic', 'Marvel Series 1')).toBe(buildSeriesKey('comic', 'Marvel - Series  1'));
  });

  it('returns null for an empty value or an unsupported/game item type', () => {
    expect(buildSeriesKey('comic', '')).toBeNull();
    expect(buildSeriesKey('comic', '   ')).toBeNull();
    expect(buildSeriesKey('vinyl', 'Some Album')).toBeNull();
    // Games no longer key off a title at all — see buildPlatformKey/buildGenreKey.
    expect(buildSeriesKey('game', 'Chrono Trigger')).toBeNull();
  });
});

describe('buildPlatformKey / buildGenreKey', () => {
  it('normalizes case and whitespace so typed variants of the same value key the same', () => {
    expect(buildPlatformKey('PS5')).toBe(buildPlatformKey('  ps5  '));
    expect(buildGenreKey('Shooter')).toBe(buildGenreKey('shooter'));
  });

  it('keeps platform and genre keys from ever colliding with each other or with a comic key', () => {
    expect(buildPlatformKey('Shooter')).not.toBe(buildGenreKey('Shooter'));
    expect(buildPlatformKey('Watchmen')).not.toBe(buildSeriesKey('comic', 'Watchmen'));
  });

  it('returns null for an empty value', () => {
    expect(buildPlatformKey('')).toBeNull();
    expect(buildGenreKey('   ')).toBeNull();
  });
});

describe('buildResolvedInterestKey', () => {
  it('builds a platform/genre-prefixed key from a resolved IGDB id', () => {
    expect(buildResolvedInterestKey('platform', 167)).toBe('game_platform:167');
    expect(buildResolvedInterestKey('genre', 5)).toBe('game_genre:5');
  });

  it('returns null for a missing id or unknown kind', () => {
    expect(buildResolvedInterestKey('platform', null)).toBeNull();
    expect(buildResolvedInterestKey('platform', undefined)).toBeNull();
    expect(buildResolvedInterestKey('something-else', 1)).toBeNull();
  });
});

describe('distinctTrackedSeries', () => {
  it('tracks games by distinct platform/genre instead of by title', () => {
    const games = [
      { item_type: 'game', title: 'Chrono Trigger', platforms: ['SNES'], genre: 'RPG' },
      // A second, unrelated title on the same platform/genre shouldn't add
      // a second entry — the point of the redesign is that this collapses
      // onto the same two keys, not one pair per owned title.
      { item_type: 'game', title: 'Final Fantasy VI', platforms: ['SNES', 'Wii'], genre: 'RPG, Adventure' },
      { item_type: 'comic', series: 'Saga' },
      { item_type: 'comic', series: '' },
      { item_type: 'trading_card', card_set: 'Base Set' },
    ];
    const result = distinctTrackedSeries(games);
    const keys = result.map((r) => r.key).sort();
    expect(keys).toEqual([
      'comic:saga',
      'game_genre_name:adventure',
      'game_genre_name:rpg',
      'game_platform_name:snes',
      'game_platform_name:wii',
    ]);
    const wii = result.find((r) => r.key === 'game_platform_name:wii');
    expect(wii).toMatchObject({ itemType: 'game', kind: 'platform', value: 'Wii' });
    const comic = result.find((r) => r.key === 'comic:saga');
    expect(comic).toMatchObject({ itemType: 'comic', kind: 'series', value: 'Saga' });
  });

  it('splits a comma-separated genre string into separate distinct genres', () => {
    const games = [{ item_type: 'game', platforms: [], genre: 'Shooter, Adventure' }];
    const result = distinctTrackedSeries(games);
    expect(result.map((r) => r.value).sort()).toEqual(['Adventure', 'Shooter']);
  });

  it('ignores empty platform/genre values without erroring', () => {
    const games = [{ item_type: 'game', platforms: ['', '  '], genre: '' }];
    expect(distinctTrackedSeries(games)).toEqual([]);
  });

  it('returns an empty array for no games', () => {
    expect(distinctTrackedSeries([])).toEqual([]);
    expect(distinctTrackedSeries(undefined)).toEqual([]);
  });
});

describe('flattenUpcomingEntries', () => {
  const now = new Date('2026-09-01T00:00:00Z');

  it('drops past-dated entries and entries with no release date', () => {
    const rows = [
      {
        item_type: 'game',
        series_name: 'Some Franchise',
        entries: [
          { id: 1, name: 'Already Out', releaseDate: '2020-01-01T00:00:00Z' },
          { id: 2, name: 'No Date' },
          { id: 3, name: 'Coming Soon', releaseDate: '2026-12-01T00:00:00Z' },
        ],
      },
    ];
    const result = flattenUpcomingEntries(rows, now);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Coming Soon');
    expect(result[0].entryKey).toBe('game:3');
  });

  it('sorts soonest-first across multiple series', () => {
    const rows = [
      {
        item_type: 'comic',
        series_name: 'Saga',
        entries: [{ id: 'c1', title: '#66', releaseDate: '2026-11-01T00:00:00Z' }],
      },
      {
        item_type: 'game',
        series_name: 'Zelda',
        entries: [{ id: 'g1', name: 'New Zelda', releaseDate: '2026-09-15T00:00:00Z' }],
      },
    ];
    const result = flattenUpcomingEntries(rows, now);
    expect(result.map((e) => e.entryKey)).toEqual(['game:g1', 'comic:c1']);
  });

  it('handles empty/missing cache rows', () => {
    expect(flattenUpcomingEntries([], now)).toEqual([]);
    expect(flattenUpcomingEntries(undefined, now)).toEqual([]);
  });

  it('folds a game matched by more than one cache row (e.g. platform and genre) into one entry', () => {
    const rows = [
      {
        item_type: 'game',
        series_name: 'PlayStation 5',
        entries: [{ id: 42, name: 'New RPG', releaseDate: '2026-12-01T00:00:00Z' }],
      },
      {
        item_type: 'game',
        series_name: 'Role-playing (RPG)',
        entries: [{ id: 42, name: 'New RPG', releaseDate: '2026-12-01T00:00:00Z' }],
      },
    ];
    const result = flattenUpcomingEntries(rows, now);
    expect(result).toHaveLength(1);
    expect(result[0].entryKey).toBe('game:42');
    expect(result[0].seriesName).toBe('PlayStation 5, Role-playing (RPG)');
  });

  it('does not fold two different games that merely share the same numeric id across item types', () => {
    const rows = [
      { item_type: 'game', series_name: 'PlayStation 5', entries: [{ id: 1, name: 'A Game', releaseDate: '2026-12-01T00:00:00Z' }] },
      { item_type: 'comic', series_name: 'Saga', entries: [{ id: 1, title: '#1', releaseDate: '2026-12-01T00:00:00Z' }] },
    ];
    const result = flattenUpcomingEntries(rows, now);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.entryKey).sort()).toEqual(['comic:1', 'game:1']);
  });
});

describe('groupEntriesByMonth', () => {
  it('groups entries into month buckets in encounter order', () => {
    const entries = [
      { releaseTs: new Date('2026-09-15T00:00:00Z').getTime(), name: 'A' },
      { releaseTs: new Date('2026-09-20T00:00:00Z').getTime(), name: 'B' },
      { releaseTs: new Date('2026-10-01T00:00:00Z').getTime(), name: 'C' },
    ];
    const groups = groupEntriesByMonth(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0].monthKey).toBe('2026-09');
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[1].monthKey).toBe('2026-10');
    expect(groups[1].entries).toHaveLength(1);
  });

  it('returns an empty array for no entries', () => {
    expect(groupEntriesByMonth([])).toEqual([]);
  });
});

describe('computeSpendTotals', () => {
  const now = new Date('2026-09-01T00:00:00Z');

  it('only counts entries with a real, priced entryKey', () => {
    const entries = [
      { entryKey: 'a', releaseTs: new Date('2026-09-03T00:00:00Z').getTime() },
      { entryKey: 'b', releaseTs: new Date('2026-09-20T00:00:00Z').getTime() },
      { entryKey: 'c', releaseTs: new Date('2026-10-15T00:00:00Z').getTime() },
    ];
    const prices = { a: '59.99', b: '19.99', c: 'not-a-number' };
    const totals = computeSpendTotals(entries, prices, now);
    expect(totals.thisWeek).toBe(59.99);
    expect(totals.thisMonth).toBe(79.98);
  });

  it('returns zeros when nothing is priced', () => {
    const entries = [{ entryKey: 'a', releaseTs: now.getTime() }];
    expect(computeSpendTotals(entries, {}, now)).toEqual({ thisWeek: 0, thisMonth: 0 });
    expect(computeSpendTotals(entries, undefined, now)).toEqual({ thisWeek: 0, thisMonth: 0 });
  });

  it('handles no entries', () => {
    expect(computeSpendTotals([], {}, now)).toEqual({ thisWeek: 0, thisMonth: 0 });
  });
});
