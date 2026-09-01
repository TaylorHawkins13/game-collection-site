import { describe, it, expect } from 'vitest';
import {
  buildSeriesKey,
  distinctTrackedSeries,
  flattenUpcomingEntries,
  groupEntriesByMonth,
  computeSpendTotals,
} from './upcomingReleases';

describe('buildSeriesKey', () => {
  it('prefixes games and comics differently so same-named series never collide', () => {
    expect(buildSeriesKey('game', 'Watchmen')).toBe('game:watchmen');
    expect(buildSeriesKey('comic', 'Watchmen')).toBe('comic:watchmen');
    expect(buildSeriesKey('game', 'Watchmen')).not.toBe(buildSeriesKey('comic', 'Watchmen'));
  });

  it('normalizes punctuation/spacing so near-duplicates key the same', () => {
    expect(buildSeriesKey('comic', 'Marvel Series 1')).toBe(buildSeriesKey('comic', 'Marvel - Series  1'));
  });

  it('returns null for an empty value or unsupported item type', () => {
    expect(buildSeriesKey('game', '')).toBeNull();
    expect(buildSeriesKey('game', '   ')).toBeNull();
    expect(buildSeriesKey('vinyl', 'Some Album')).toBeNull();
  });
});

describe('distinctTrackedSeries', () => {
  it('dedupes by normalized key across item types', () => {
    const games = [
      { item_type: 'game', title: 'Chrono Trigger' },
      { item_type: 'game', title: 'chrono  trigger!' },
      { item_type: 'comic', series: 'Saga' },
      { item_type: 'comic', series: '' },
      { item_type: 'trading_card', card_set: 'Base Set' },
    ];
    const result = distinctTrackedSeries(games);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.key).sort()).toEqual(['comic:saga', 'game:chrono trigger']);
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
