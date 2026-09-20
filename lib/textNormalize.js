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

// Best-effort English-only title filter (Sep 2026 — added for Books'
// getAuthorBibliography, extracted here so Vinyl/CD/DVD/VHS's
// crowdsourced creator-based "series" — lib/seriesCrowdsource.js's
// getCrowdsourcedCreatorSeries() — can reuse the exact same check rather
// than each maintaining its own copy of the same regex/word list). Works
// off title text alone, since neither Open Library's lightweight works
// listing nor Shelf Life's own crowdsourced data carries a real language
// field to check directly.
//
// Deliberately conservative in both tiers below — hiding a real English
// title by mistake is worse than letting an occasional foreign edition
// through, so anything short or uncertain is kept rather than excluded.
//
// Considered and rejected: franc-min, an npm language-detection library
// — tested locally against ~20 real book titles before deciding against
// it. It actively misidentified a Russian title as Uzbek rather than
// flagging it as non-English, and reliably returned "undetermined" for
// any short title (1-2 words) regardless of true language, so it wasn't
// trustworthy as a primary signal and would have added a new dependency
// (with a package-lock.json update to match) for a signal this file can
// get more reliably on its own. See CHANGELOG.md.
//
// Tier 1 (reliable): a title using a non-Latin script (Cyrillic, CJK,
// Hangul, Arabic, Hebrew, Greek, Thai, ...) is almost never the English
// edition's title. Checked directly against Unicode script ranges rather
// than a detection library, so it can't be fooled the way franc-min was
// above.
const NON_LATIN_SCRIPT =
  /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿݐ-ݿ฀-๿぀-ヿ㐀-䶿一-鿿가-힯]/;

// Tier 2 (weak signal, Latin-script titles only): common French/German/
// Spanish/Italian function words/articles, matched as whole words —
// catches things like "Le Petit Prince" or "Der Prozess" that Tier 1
// can't (accented Latin script is still Latin script). Only applied to
// titles with 3+ words, and only acts when a real proportion of the
// title's words hit this list — a single incidental match ("El Dorado",
// an English-language proper noun) isn't enough on its own.
const FOREIGN_WORDS = new Set([
  // French
  'le', 'la', 'les', 'des', 'du', 'une', 'et', 'dans', 'pour', 'avec', 'sans', 'sur', 'qui', 'que',
  // German
  'der', 'die', 'das', 'und', 'ein', 'eine', 'einen', 'mit', 'von', 'nicht', 'ist', 'war', 'für',
  // Spanish
  'el', 'los', 'las', 'y', 'de', 'del', 'con', 'para', 'una', 'un', 'que',
  // Italian
  'il', 'lo', 'gli', 'di', 'per', 'con', 'senza', 'uno', 'che',
]);

export function looksNonEnglish(title) {
  const clean = (title || '').trim();
  if (!clean) return false;
  if (NON_LATIN_SCRIPT.test(clean)) return true;

  const words = clean
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  if (words.length < 3) return false; // too short to trust a word-list guess

  const hits = words.filter((w) => FOREIGN_WORDS.has(w)).length;
  return hits >= 2 && hits / words.length >= 0.3;
}
