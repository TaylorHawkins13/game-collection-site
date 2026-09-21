import { describe, it, expect } from 'vitest';
import { parseQuickAddText } from './quickAddParse';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

describe('parseQuickAddText', () => {
  it('parses the canonical "verb + title + price + today" shape', () => {
    expect(parseQuickAddText('logged a Chrono Trigger for $40 today')).toEqual({
      title: 'Chrono Trigger',
      price: 40,
      purchase_date: todayIso(),
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('handles "got" as the verb, and a decimal price', () => {
    expect(parseQuickAddText('got Elden Ring for $59.99')).toEqual({
      title: 'Elden Ring',
      price: 59.99,
      purchase_date: '',
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('handles "bought" with no price or date at all', () => {
    expect(parseQuickAddText('bought Chrono Trigger')).toEqual({
      title: 'Chrono Trigger',
      price: null,
      purchase_date: '',
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('handles a price with no leading verb at all', () => {
    expect(parseQuickAddText('Chrono Trigger $40')).toEqual({
      title: 'Chrono Trigger',
      price: 40,
      purchase_date: '',
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('strips "N copies of" quantity phrasing without multiplying anything', () => {
    expect(parseQuickAddText('add 2 copies of Elden Ring for $60')).toEqual({
      title: 'Elden Ring',
      price: 60,
      purchase_date: '',
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('strips "NxTitle" quantity phrasing', () => {
    expect(parseQuickAddText('add 3x Funko Pop')).toEqual({
      title: 'Funko Pop',
      price: null,
      purchase_date: '',
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('resolves "yesterday" to the correct ISO date', () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(parseQuickAddText('picked up Chrono Trigger yesterday').purchase_date).toBe(y.toISOString().slice(0, 10));
  });

  it('does not mistake a title containing "Today" for a date mention when nothing trails it', () => {
    // "Today" only strips when it's a trailing, standalone date mention —
    // here it's mid-title with real words after it, so it survives.
    const result = parseQuickAddText("got Today's Special Edition for $20");
    expect(result.title).toBe("Today's Special Edition");
    expect(result.price).toBe(20);
  });

  it('returns an empty title for blank or all-filler input', () => {
    expect(parseQuickAddText('').title).toBe('');
    expect(parseQuickAddText('   ').title).toBe('');
    expect(parseQuickAddText('logged').title).toBe('');
  });

  it('strips trailing punctuation', () => {
    expect(parseQuickAddText('bought Chrono Trigger!').title).toBe('Chrono Trigger');
    expect(parseQuickAddText('got Elden Ring, today').title).toBe('Elden Ring');
  });

  // Regression test for the exact real-world input that flagged this gap:
  // "fifa 06 on ps2 CIB" used to leave "on ps2 CIB" stuck in the title
  // instead of routing it to the Platforms/Completeness fields.
  it('pulls platform and completeness out instead of leaving them in the title', () => {
    expect(parseQuickAddText('fifa 06 on ps2 CIB')).toEqual({
      title: 'fifa 06',
      price: null,
      purchase_date: '',
      platform: 'PlayStation 2',
      completeness: 'cib',
      itemTypeHint: 'game',
    });
  });

  it('recognizes a full platform name, not just the shorthand', () => {
    const result = parseQuickAddText('got Mario Kart for Nintendo Switch');
    expect(result.title).toBe('Mario Kart');
    expect(result.platform).toBe('Nintendo Switch');
    expect(result.itemTypeHint).toBe('game');
  });

  it('recognizes "box only" and "loose" completeness, and picks the longer alias first', () => {
    expect(parseQuickAddText('got Halo 3 for xbox 360 box only').platform).toBe('Xbox 360');
    expect(parseQuickAddText('got Halo 3 for xbox 360 box only').completeness).toBe('box_only');
    expect(parseQuickAddText('bought a loose copy of GoldenEye on n64').completeness).toBe('loose');
    expect(parseQuickAddText('bought a loose copy of GoldenEye on n64').platform).toBe('Nintendo 64');
  });

  it('prefers the more specific "no manual" completeness over the generic CIB match', () => {
    expect(parseQuickAddText('got Fifa 06 on ps2, missing manual').completeness).toBe('no_manual');
  });

  it('does not mistake a bare trailing "for"/"on" (no known platform after it) for a platform mention', () => {
    // Regression guard: PLATFORM_RE requires a *known* alias right after
    // "on"/"for" — a leftover "for" with nothing (or an unrecognized
    // word) after it must not match and corrupt the title.
    const result = parseQuickAddText('logged a Chrono Trigger for $40 today');
    expect(result.platform).toBe('');
    expect(result.title).toBe('Chrono Trigger');
  });

  it('does not leave orphaned commas behind when platform/completeness are comma-separated', () => {
    expect(parseQuickAddText('fifa 06 on ps2, CIB, $8 today')).toEqual({
      title: 'fifa 06',
      price: 8,
      purchase_date: todayIso(),
      platform: 'PlayStation 2',
      completeness: 'cib',
      itemTypeHint: 'game',
    });
  });

  it('leaves platform/completeness empty and itemTypeHint null when nothing matches', () => {
    const result = parseQuickAddText('bought Chrono Trigger');
    expect(result.platform).toBe('');
    expect(result.completeness).toBe('');
    expect(result.itemTypeHint).toBe(null);
  });

  // Regression tests for the "Quick Add only recognizes $" gap (ROADMAP.md,
  // fixed Sept 2026) — every symbol in lib/currency.js's CURRENCIES list
  // should now extract a price, not just USD's bare '$'.
  it('recognizes a prefix GBP price', () => {
    expect(parseQuickAddText('got Fifa 06 for £8 today')).toEqual({
      title: 'Fifa 06',
      price: 8,
      purchase_date: todayIso(),
      platform: '',
      completeness: '',
      itemTypeHint: null,
    });
  });

  it('recognizes a suffix EUR price with a comma decimal separator', () => {
    const result = parseQuickAddText('got Zelda for 12,99€');
    expect(result.title).toBe('Zelda');
    expect(result.price).toBe(12.99);
  });

  it('recognizes multi-character prefix symbols (CA$, A$, NZ$, MX$, R$)', () => {
    expect(parseQuickAddText('got Elden Ring for CA$60').price).toBe(60);
    expect(parseQuickAddText('got Elden Ring for A$60').price).toBe(60);
    expect(parseQuickAddText('got Elden Ring for NZ$60').price).toBe(60);
    expect(parseQuickAddText('got Elden Ring for MX$600').price).toBe(600);
    expect(parseQuickAddText('got Elden Ring for R$60').price).toBe(60);
  });

  it('recognizes a suffix Swedish Krona price with no space', () => {
    expect(parseQuickAddText('got a Funko Pop for 150kr').price).toBe(150);
  });

  it('recognizes bare-letter symbols (CHF, R) without matching inside an unrelated word', () => {
    expect(parseQuickAddText('got a Funko Pop for CHF 12').price).toBe(12);
    expect(parseQuickAddText('got a Funko Pop for R50').price).toBe(50);
    // "Trigger" contains an 'r' right before nothing price-like — must not
    // false-positive just because the bare R/kr/CHF symbols are letters.
    expect(parseQuickAddText('bought Chrono Trigger').price).toBe(null);
  });

  it('still recognizes bare USD $ exactly as before (no regression from broadening the symbol list)', () => {
    expect(parseQuickAddText('logged a Chrono Trigger for $40 today').price).toBe(40);
    expect(parseQuickAddText('got Elden Ring for $59.99').price).toBe(59.99);
  });
});
