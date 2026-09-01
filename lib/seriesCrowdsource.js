import { createClient } from '@/lib/supabaseServer';
import { normalizeCardNumber } from './seriesLookup';

// The "Series" feature's crowdsourced-fallback backend. Funko Pops and
// Vinyl/CD/DVD/VHS/Books (Aug 2026 — see CHANGELOG.md) go straight here;
// comics go to Comic Vine and trading cards try TCGdex first (see
// lib/useSeriesLookup.js) but both fall back to this for anything their
// real backend doesn't recognize — trading cards in particular, since
// TCGdex is Pokémon-only and a non-Pokémon card (Magic, mainly) always
// misses there. Works off Shelf Life's own data instead of a real
// canonical database — every
// matching row anyone on the site has logged (RLS already scopes `games`
// reads to public profiles plus the viewer's own, same implicit rule the
// collectible detail page and community-suggestions search already rely
// on). Weaker than a real canonical list — it can only know about
// issues/cards/albums/movies/books someone's actually logged — but it's
// real data, not a guess, and needs no new integration.
//
// Checked (Aug 2026) for a free Funko Pop database/API to give this the
// same TCGdex/Comic Vine/Scryfall upgrade path: the one real open dataset
// that existed, kennymkchan/funko-pop-data (~23,000 entries, MIT
// licensed), is explicitly marked deprecated by its own author — last
// updated January 2021, over 5 years stale, and static (a GitHub-hosted
// JSON/CSV file, not a live queryable API). Its named successor,
// popiq.dev, now requires payment (a 402 on every page checked, including
// its docs) — no longer a free option either. No other hosted, free,
// actively-maintained Funko Pop API turned up. Conclusion: still not
// buildable the way Pokémon/comics were — removed from ROADMAP.md's
// buildable list rather than left as a recurring "worth a look" (see
// CHANGELOG.md). Worth revisiting only if a genuinely new free/live
// option appears — Funko itself has no public API, so this isn't likely
// to change on its own.
const TYPE_CONFIG = {
  comic: { numberCol: 'issue_number', numberLabel: 'Issue' },
  trading_card: { numberCol: 'card_number', numberLabel: 'Card #' },
  funko_pop: { numberCol: 'card_number', numberLabel: 'Pop! #' },
};

// Vinyl/CD/DVD/VHS/Book: "series" means "everything by the same
// creator" instead of a numbered checklist — see lib/seriesLookup.js's
// CREATOR_FIELD_BY_TYPE for the full reasoning and the same per-type
// field mapping (Vinyl's dedicated `artist` column; CD/DVD/VHS/Book's
// shared `writer` column). Kept as a separate config/branch below rather
// than folded into TYPE_CONFIG above since these dedupe by title, not a
// number column.
const CREATOR_TYPE_CONFIG = {
  vinyl: { creatorCol: 'artist' },
  cd: { creatorCol: 'writer' },
  dvd: { creatorCol: 'writer' },
  vhs: { creatorCol: 'writer' },
  book: { creatorCol: 'writer' },
};

// Loose match so trivially different formatting of the same series name —
// punctuation, extra spaces, capitalization — doesn't silently split it
// into two separate series (see ROADMAP.md/CHANGELOG.md: "Marvel Series
// 1" vs "Marvel - Series 1" used to be invisible to each other under a
// plain ilike exact-string match). Strips everything but letters/numbers
// down to single spaces before comparing, so both of those — and
// "marvel  series 1" — normalize to the same key.
function normalizeSeriesText(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function getCrowdsourcedSeries(itemType, seriesValue) {
  const cfg = TYPE_CONFIG[itemType];
  const creatorCfg = CREATOR_TYPE_CONFIG[itemType];
  if (!cfg && !creatorCfg) return { error: 'unsupported_type' };

  const value = (seriesValue || '').trim();
  if (!value) return { error: 'no_series_value' };
  const normalizedTarget = normalizeSeriesText(value);

  const supabase = await createClient();

  if (creatorCfg) {
    return getCrowdsourcedCreatorSeries(supabase, itemType, creatorCfg, value, normalizedTarget);
  }

  const cols = `id, title, cover, series, card_set, ${cfg.numberCol}`;

  // Fetches every row of this item_type instead of an exact server-side
  // match on `value` — normalized comparison (below) only works once both
  // sides are normalized the same way, and Postgres ilike can't do that
  // loosely without risking false-positive wildcard matches. Fine at this
  // scale (Funko Pops only in practice now — see the module comment
  // above — RLS-scoped to public profiles plus the viewer's own), but
  // would need a real search index if this backend ever handled a type
  // with meaningfully more rows.
  const { data, error } = await supabase.from('games').select(cols).eq('item_type', itemType);
  if (error) return { error: 'query_failed' };

  // Comics often have `series` left blank with the series name just
  // typed into `title` instead (both patterns exist in real data) — so
  // for comics, match on either column rather than assuming everyone
  // filled in the same field the same way. Trading cards/Funko Pops
  // reliably use `card_set` as their one dedicated field.
  const rows = (data || []).filter((row) =>
    itemType === 'comic'
      ? normalizeSeriesText(row.series) === normalizedTarget || normalizeSeriesText(row.title) === normalizedTarget
      : normalizeSeriesText(row.card_set) === normalizedTarget
  );

  // Multiple collectors can (and often do) own the same issue/card —
  // dedupe down to one representative row per number, preferring
  // whichever copy actually has cover art.
  //
  // Fixed (Aug 2026 — reported live as "far too many and duplicates" in
  // series collections): this used to key the dedup Map on the raw,
  // trimmed-and-lowercased number field, not the same normalizeCardNumber()
  // every other owned/matching check in the app already runs numbers
  // through (lib/seriesLookup.js — strips a leading "#", drops a "/total"
  // suffix, strips leading zeros). Two collectors logging the exact same
  // card as "20", "#20", and "020" used to land in three separate Map
  // entries instead of one — every real duplicate-formatting difference
  // showed up as extra, duplicate-looking rows in the series grid.
  const byNumber = new Map();
  for (const row of rows) {
    const key = normalizeCardNumber(row[cfg.numberCol]);
    if (!key) continue;
    const existing = byNumber.get(key);
    if (!existing || (!existing.cover && row.cover)) {
      byNumber.set(key, row);
    }
  }

  const entries = Array.from(byNumber.values())
    .map((row) => ({ id: row.id, number: row[cfg.numberCol], title: row.title, cover: row.cover || '' }))
    .sort((a, b) => {
      const an = parseFloat(a.number);
      const bn = parseFloat(b.number);
      if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
      return String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
    });

  if (entries.length === 0) return { error: 'no_series' };
  return { seriesName: value, numberLabel: cfg.numberLabel, entries };
}

// Vinyl/CD/DVD/VHS/Book path — see CREATOR_TYPE_CONFIG above. No number
// column to dedupe/sort on, so entries dedupe by normalized title
// instead (two collectors logging the same album/movie/book shouldn't
// produce two tiles) and sort alphabetically.
async function getCrowdsourcedCreatorSeries(supabase, itemType, creatorCfg, value, normalizedTarget) {
  const { data, error } = await supabase
    .from('games')
    .select(`id, title, cover, ${creatorCfg.creatorCol}`)
    .eq('item_type', itemType);
  if (error) return { error: 'query_failed' };

  const rows = (data || []).filter((row) => normalizeSeriesText(row[creatorCfg.creatorCol]) === normalizedTarget);

  const byTitle = new Map();
  for (const row of rows) {
    const key = normalizeSeriesText(row.title);
    if (!key) continue;
    const existing = byTitle.get(key);
    if (!existing || (!existing.cover && row.cover)) {
      byTitle.set(key, row);
    }
  }

  const entries = Array.from(byTitle.values())
    .map((row) => ({ id: row.id, title: row.title, cover: row.cover || '' }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

  if (entries.length === 0) return { error: 'no_series' };
  return { seriesName: value, entries };
}
