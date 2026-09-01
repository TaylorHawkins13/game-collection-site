import { describe, it, expect } from 'vitest';
import { averageRating } from './itemReviews';

describe('averageRating', () => {
  it('returns null for an empty or missing list', () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating(undefined)).toBeNull();
    expect(averageRating(null)).toBeNull();
  });

  it('returns the rating itself for a single review', () => {
    expect(averageRating([{ rating: 4 }])).toBe(4);
  });

  it('averages multiple reviews, including string-typed ratings as returned for a numeric column', () => {
    expect(averageRating([{ rating: '5' }, { rating: '3' }, { rating: 4 }])).toBe(4);
  });

  it('keeps half-star precision', () => {
    expect(averageRating([{ rating: 4.5 }, { rating: 3 }])).toBe(3.75);
  });
});
