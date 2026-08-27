import { describe, it, expect } from 'vitest';
import { currencySymbol, formatMoney, CURRENCIES } from './currency';

describe('currencySymbol', () => {
  it('returns the right symbol for a known code', () => {
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('JPY')).toBe('¥');
  });

  it('falls back to $ for an unknown/missing code', () => {
    expect(currencySymbol('XXX')).toBe('$');
    expect(currencySymbol(undefined)).toBe('$');
  });

  it('every listed currency actually has a symbol', () => {
    CURRENCIES.forEach((c) => expect(c.symbol).toBeTruthy());
  });
});

describe('formatMoney', () => {
  it('formats a plain number to 2 decimal places with the right symbol', () => {
    expect(formatMoney(19.5, 'GBP')).toBe('£19.50');
    expect(formatMoney(100, 'USD')).toBe('$100.00');
  });

  it('treats missing/non-numeric amounts as 0 rather than throwing or showing NaN', () => {
    expect(formatMoney(null, 'USD')).toBe('$0.00');
    expect(formatMoney(undefined, 'EUR')).toBe('€0.00');
    expect(formatMoney('not a number', 'EUR')).toBe('€0.00');
  });

  it('parses a numeric string same as a real number', () => {
    expect(formatMoney('42.1', 'USD')).toBe('$42.10');
  });
});
