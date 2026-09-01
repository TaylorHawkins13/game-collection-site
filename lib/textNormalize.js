// A tiny, dependency-free home for normalizeSeriesText (Sep 2026,
// extracted from lib/seriesCrowdsource.js) — that file's own top-level
// `@/lib/supabaseServer` import made it unusable from a plain Vitest
// unit test (no path-alias resolution configured there — see
// vitest.config.mjs's own comment: pure-logic modules only, deliberately
// no environment setup). Pulling this one function out into a module
// with zero imports of its own lets lib/upcomingReleases.js reuse the
// exact same normalization lib/seriesCrowdsource.js already uses for
// series matching, without dragging in anything Supabase-related just to
// load a string-normalizing helper.

// Strips punctuation, extra spaces, capitalization — doesn't silently
// split the same series into two under a plain exact-string match
// (see ROADMAP.md/CHANGELOG.md: "Marvel Series 1" vs "Marvel - Series 1"
// used to be invisible to each other). Strips everything but
// letters/numbers down to single spaces before comparing, so both of
// those — and "marvel  series 1" — normalize to the same key.
export function normalizeSeriesText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
