// The Books "series" backend — a real per-author bibliography from Open
// Library (already used for Books search/auto-fill — see
// app/api/book-search/route.js), replacing the old crowdsourced-only "See
// full series" behavior Books used to share with Vinyl/CD/DVD/VHS and
// Funko Pops. Those types stay on the crowdsourced path (see
// lib/seriesCrowdsource.js and ROADMAP.md) — no free, live, per-item
// discography/filmography/toy database exists the way Open Library
// covers books.
//
// Two real API calls, not one: Open Library has no "search an author's
// works by name" endpoint, only "search authors by name" (returning a
// stable author id, an OLID) and "list works by author id" separately —
// same two-step shape lib/comicVineCreatorLookup.js already uses for the
// Comics creator-page feature. `writer` on a book row is free-typed text
// (an Add Item field, not picked from a canonical list), so the first
// call resolves it to a real OLID before the second call can even be
// made.
//
// Prefers a case-insensitive exact name match among the search results
// (what you get when the author field was typed to match a book's real
// author, since the book Search button fills it straight from Open
// Library's own author name) and otherwise the candidate with the
// highest work_count — same "most substantial match wins" tie-break
// lib/comicVineSeriesLookup.js's findVolumeByName already uses for
// same-named series, since a same-named minor entry (a different,
// obscure person who happens to share a name) is far less likely to be
// what "the author" means day to day than the one with a real body of
// work on file.
//
// Couldn't be exercised against live Open Library data from this sandbox
// (same network-allowlist limitation as every other external API
// integration built here — Comic Vine, TCGdex, Discogs, all carry the
// same caveat until confirmed against live data) — worth a real
// click-through (open a book by a well-known author, confirm the
// bibliography grid populates and a logged title checks off the right
// tile) before trusting this fully.

import { normalizeSeriesText } from './textNormalize';

const USER_AGENT = 'ShelfLifeApp/1.0 (collection tracker; contact via app)';
// Generous for even a prolific author (a few hundred titles, including
// omnibuses/anthologies/translations Open Library counts as separate
// works) — a backstop against a runaway response, not an expected
// ceiling, same "backstop, not a real cap" framing every other
// pagination limit in this codebase uses.
const WORKS_LIMIT = 500;

async function openLibraryFetch(path) {
  try {
    const res = await fetch(`https://openlibrary.org${path}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return { error: 'query_failed' };
    return { data: await res.json() };
  } catch {
    return { error: 'query_failed' };
  }
}

async function findAuthorByName(name) {
  const clean = (name || '').trim();
  if (!clean) return { error: 'no_series' };
  const result = await openLibraryFetch(`/search/authors.json?q=${encodeURIComponent(clean)}&limit=10`);
  if (result.error) return result;
  const docs = result.data?.docs || [];
  if (!docs.length) return { error: 'no_series' };
  const exact = docs.find((d) => (d?.name || '').trim().toLowerCase() === clean.toLowerCase());
  const chosen =
    exact || docs.reduce((best, d) => ((d?.work_count || 0) > (best?.work_count || 0) ? d : best), docs[0]);
  return chosen?.key ? { author: chosen } : { error: 'no_series' };
}

// Best-effort English-only filter (Sep 2026 — Taylor: "stop it from
// showing... duplicate books in different languages", then chose "also
// try a best-effort English-only heuristic" when asked how far to take
// it). Open Library's per-work listing has no language field to check
// (same lightweight `/works.json` response this file already uses for
// everything else — a translated edition just shows up as its own
// "work" with a translated title), so this works off the title text
// itself, the same way every other best-effort heuristic in this
// codebase deals with a gap a free source just doesn't fill.
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
// edition's title — Open Library lists a translated edition as its own
// "work" using the translated title, not the original. Checked directly
// against Unicode script ranges rather than a detection library, so it
// can't be fooled the way franc-min was above.
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

function looksNonEnglish(title) {
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

// Returns { seriesName, entries } where each entry is { id, cover, title }
// — deliberately no `number` field (unlike comics/cards' issue/card
// number), same shape the crowdsourced creator-based backend already
// produces for Vinyl/CD/DVD/VHS/Book — lib/seriesLookup.js's
// normalizeSeriesResponse() already handles a numberless entry generically
// (keys/labels off the title), so this needed no changes there.
export async function getAuthorBibliography(authorName) {
  const found = await findAuthorByName(authorName);
  if (found.error) return { error: found.error };
  const authorKey = found.author.key;

  const result = await openLibraryFetch(`/authors/${encodeURIComponent(authorKey)}/works.json?limit=${WORKS_LIMIT}`);
  if (result.error) return result;
  const works = result.data?.entries || [];
  if (!works.length) return { error: 'no_series' };

  const mapped = works
    .filter((w) => w?.title)
    .map((w) => ({
      id: w.key,
      cover: w.covers?.[0] ? `https://covers.openlibrary.org/b/id/${w.covers[0]}-M.jpg` : '',
      title: w.title,
    }))
    .filter((w) => !looksNonEnglish(w.title));

  // Open Library's per-author works list has real duplicates in practice
  // (Sep 2026 — Taylor: "duplicate books"): the same book reissued under
  // an identical title gets its own separate "work" entry. Collapse to
  // one entry per normalized title, preferring whichever copy has cover
  // art — same byTitle Map pattern lib/seriesCrowdsource.js's
  // getCrowdsourcedCreatorSeries() already uses for the exact same
  // "one tile per book" problem on the crowdsourced fallback path.
  const byTitle = new Map();
  for (const entry of mapped) {
    const key = normalizeSeriesText(entry.title);
    if (!key) continue;
    const existing = byTitle.get(key);
    if (!existing || (!existing.cover && entry.cover)) {
      byTitle.set(key, entry);
    }
  }

  const entries = Array.from(byTitle.values()).sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
  );

  if (!entries.length) return { error: 'no_series' };
  return { seriesName: found.author.name, entries };
}
