import { describe, it, expect } from 'vitest';
import {
  normalizeCardNumber,
  seriesSupported,
  isMasterSetType,
  seriesQueryValueFor,
  ownedKeysFor,
  variantHintsFor,
  normalizeSeriesResponse,
  prefillFromSeriesEntry,
} from './seriesLookup';

describe('normalizeCardNumber', () => {
  it('strips a "/total" suffix down to the bare number', () => {
    expect(normalizeCardNumber('4/102')).toBe('4');
  });

  it('strips a leading # and collapses leading zeros on a purely numeric code', () => {
    expect(normalizeCardNumber('#004')).toBe('4');
  });

  it('leaves an alphanumeric code alone (zero is part of the real code, not padding)', () => {
    expect(normalizeCardNumber('TG01')).toBe('tg01');
  });

  it('handles empty/nullish input without throwing', () => {
    expect(normalizeCardNumber('')).toBe('');
    expect(normalizeCardNumber(null)).toBe('');
    expect(normalizeCardNumber(undefined)).toBe('');
  });
});

describe('seriesSupported / isMasterSetType', () => {
  it('supports games, comics, trading cards, and Funko Pops', () => {
    expect(seriesSupported('game')).toBe(true);
    expect(seriesSupported('comic')).toBe(true);
    expect(seriesSupported('trading_card')).toBe(true);
    expect(seriesSupported('funko_pop')).toBe(true);
  });

  it('does not support types with no natural numbered-series field', () => {
    expect(seriesSupported('vinyl')).toBe(false);
    expect(seriesSupported('book')).toBe(false);
    expect(seriesSupported('console')).toBe(false);
  });

  it('only trading cards and comics have a real master-set backend', () => {
    expect(isMasterSetType('trading_card')).toBe(true);
    expect(isMasterSetType('comic')).toBe(true);
    expect(isMasterSetType('game')).toBe(false);
    expect(isMasterSetType('funko_pop')).toBe(false);
  });
});

describe('seriesQueryValueFor', () => {
  it('picks the right field per item type', () => {
    expect(seriesQueryValueFor({ item_type: 'game', title: 'Chrono Trigger' })).toBe('Chrono Trigger');
    expect(seriesQueryValueFor({ item_type: 'comic', series: 'The Amazing Spider-Man', title: 'ASM #1' })).toBe(
      'The Amazing Spider-Man'
    );
    expect(seriesQueryValueFor({ item_type: 'comic', title: 'One-shot' })).toBe('One-shot');
    expect(seriesQueryValueFor({ item_type: 'trading_card', card_set: 'Base Set' })).toBe('Base Set');
  });

  it('returns an empty string for an unsupported type or missing item', () => {
    expect(seriesQueryValueFor({ item_type: 'vinyl' })).toBe('');
    expect(seriesQueryValueFor(null)).toBe('');
  });
});

describe('ownedKeysFor', () => {
  it('keys games by normalized title', () => {
    const items = [{ item_type: 'game', title: 'Chrono Trigger' }];
    expect(ownedKeysFor(items, 'game').has('chrono trigger')).toBe(true);
  });

  it('keys trading cards by normalized number + guessed print variant', () => {
    const items = [
      { item_type: 'trading_card', card_number: '4/102', is_variant: false },
      { item_type: 'trading_card', card_number: '7/102', is_variant: true, variant_notes: 'Reverse holo' },
    ];
    const keys = ownedKeysFor(items, 'trading_card');
    expect(keys.has('4::normal')).toBe(true);
    expect(keys.has('7::reverse')).toBe(true);
  });

  it('guesses Magic-style foil/etched variants the same way as Pokémon-style ones', () => {
    // Same guessCardVariant() keyword matching used for both TCGs this
    // app has a real master-set backend for — see lib/scryfallSetLookup.js
    // and lib/tcgdexSetLookup.js. A plain (non-foil) card still keys as
    // 'normal', same shared base-printing convention every TCG here uses.
    const items = [
      { item_type: 'trading_card', card_number: '150', is_variant: true, variant_notes: 'Foil' },
      { item_type: 'trading_card', card_number: '151', is_variant: true, variant_notes: 'Etched foil' },
      { item_type: 'trading_card', card_number: '152', is_variant: false },
    ];
    const keys = ownedKeysFor(items, 'trading_card');
    expect(keys.has('150::foil')).toBe(true);
    expect(keys.has('151::etched')).toBe(true);
    expect(keys.has('152::normal')).toBe(true);
  });

  it('keys comics by normalized issue number', () => {
    const items = [{ item_type: 'comic', issue_number: '12' }];
    expect(ownedKeysFor(items, 'comic').has('12')).toBe(true);
  });

  it('ignores items of a different item_type', () => {
    const items = [{ item_type: 'comic', issue_number: '12' }];
    expect(ownedKeysFor(items, 'game').size).toBe(0);
  });
});

describe('variantHintsFor', () => {
  it('builds "number:variant" hints for owned variant copies within one card set', () => {
    const items = [
      { item_type: 'trading_card', card_set: 'Base Set', card_number: '4', is_variant: true, variant_notes: 'holo' },
      { item_type: 'trading_card', card_set: 'Base Set', card_number: '7', is_variant: false }, // not a variant
      { item_type: 'trading_card', card_set: 'Jungle', card_number: '4', is_variant: true, variant_notes: 'holo' }, // different set
    ];
    expect(variantHintsFor(items, 'Base Set')).toEqual(['4:holo']);
  });

  it('matches the card set case-insensitively', () => {
    const items = [
      { item_type: 'trading_card', card_set: 'base set', card_number: '4', is_variant: true, variant_notes: '1st edition' },
    ];
    expect(variantHintsFor(items, 'Base Set')).toEqual(['4:firstEdition']);
  });

  it('returns nothing for a blank set value', () => {
    expect(variantHintsFor([{ item_type: 'trading_card', is_variant: true }], '')).toEqual([]);
  });
});

describe('normalizeSeriesResponse', () => {
  it('normalizes a game/franchise response', () => {
    const json = { franchiseName: 'Zelda', games: [{ id: 1, cover: 'x.jpg', name: 'Breath of the Wild' }] };
    const result = normalizeSeriesResponse('game', json);
    expect(result.seriesName).toBe('Zelda');
    expect(result.entries[0]).toMatchObject({ label: 'Breath of the Wild', number: null, matchKey: 'breath of the wild' });
  });

  it('normalizes a numbered-entry (comic/card) response', () => {
    const json = { seriesName: 'ASM', entries: [{ id: 1, cover: 'x.jpg', number: 12, title: 'ASM #12' }] };
    const result = normalizeSeriesResponse('comic', json);
    expect(result.entries[0]).toMatchObject({ label: '#12', number: 12, matchKey: '12' });
  });
});

describe('prefillFromSeriesEntry', () => {
  it('builds a game prefill from title alone', () => {
    const entry = { rawTitle: 'Breath of the Wild', cover: 'x.jpg' };
    expect(prefillFromSeriesEntry('game', 'Zelda', entry)).toMatchObject({
      item_type: 'game',
      title: 'Breath of the Wild',
      cover: 'x.jpg',
    });
  });

  it('builds a comic prefill with series + issue number', () => {
    const entry = { number: 12, cover: 'x.jpg' };
    expect(prefillFromSeriesEntry('comic', 'ASM', entry)).toMatchObject({
      item_type: 'comic',
      title: 'ASM #12',
      series: 'ASM',
      issue_number: '12',
    });
  });

  it('builds a trading-card prefill with card_set + card_number', () => {
    const entry = { number: 4, cover: 'x.jpg' };
    expect(prefillFromSeriesEntry('trading_card', 'Base Set', entry)).toMatchObject({
      item_type: 'trading_card',
      title: 'Base Set #4',
      card_set: 'Base Set',
      card_number: '4',
    });
  });
});
