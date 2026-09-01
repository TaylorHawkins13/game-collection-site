import { describe, it, expect } from 'vitest';
import { generateApiToken, hashApiToken, looksLikeApiToken } from './apiTokens';

describe('generateApiToken', () => {
  it('produces a token with the sl_live_ prefix and a matching hash', () => {
    const { token, hash, prefix } = generateApiToken();
    expect(token.startsWith('sl_live_')).toBe(true);
    expect(hash).toBe(hashApiToken(token));
    expect(prefix).toBe(token.slice(0, prefix.length));
  });

  it('never generates the same token twice', () => {
    const a = generateApiToken();
    const b = generateApiToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('hashApiToken', () => {
  it('is deterministic — the same token always hashes the same way', () => {
    const { token } = generateApiToken();
    expect(hashApiToken(token)).toBe(hashApiToken(token));
  });
});

describe('looksLikeApiToken', () => {
  it('accepts a real generated token', () => {
    const { token } = generateApiToken();
    expect(looksLikeApiToken(token)).toBe(true);
  });

  it('rejects anything without the sl_live_ prefix, including a bare hash-shaped string', () => {
    expect(looksLikeApiToken('abcdef1234567890')).toBe(false);
    expect(looksLikeApiToken('Bearer sl_live_abc')).toBe(false);
  });

  it('rejects non-string and empty input without throwing', () => {
    expect(looksLikeApiToken(undefined)).toBe(false);
    expect(looksLikeApiToken(null)).toBe(false);
    expect(looksLikeApiToken('')).toBe(false);
    expect(looksLikeApiToken('sl_live_')).toBe(false);
  });
});
