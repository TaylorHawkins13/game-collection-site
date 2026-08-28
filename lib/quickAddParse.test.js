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
    });
  });

  it('handles "got" as the verb, and a decimal price', () => {
    expect(parseQuickAddText('got Elden Ring for $59.99')).toEqual({
      title: 'Elden Ring',
      price: 59.99,
      purchase_date: '',
    });
  });

  it('handles "bought" with no price or date at all', () => {
    expect(parseQuickAddText('bought Chrono Trigger')).toEqual({
      title: 'Chrono Trigger',
      price: null,
      purchase_date: '',
    });
  });

  it('handles a price with no leading verb at all', () => {
    expect(parseQuickAddText('Chrono Trigger $40')).toEqual({
      title: 'Chrono Trigger',
      price: 40,
      purchase_date: '',
    });
  });

  it('strips "N copies of" quantity phrasing without multiplying anything', () => {
    expect(parseQuickAddText('add 2 copies of Elden Ring for $60')).toEqual({
      title: 'Elden Ring',
      price: 60,
      purchase_date: '',
    });
  });

  it('strips "NxTitle" quantity phrasing', () => {
    expect(parseQuickAddText('add 3x Funko Pop')).toEqual({
      title: 'Funko Pop',
      price: null,
      purchase_date: '',
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
});
