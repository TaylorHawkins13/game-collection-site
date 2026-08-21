import { createClient } from '@/lib/supabaseServer';

// The "Series" feature's crowdsourced-fallback backend — Funko Pops are
// the only type actually routed here anymore (see lib/useSeriesLookup.js:
// games hit IGDB, trading cards hit /api/pokemon-master-set, comics hit
// /api/comic-master-set — TYPE_CONFIG below still has comic/trading_card
// entries from before those two moved to real per-line data, kept around
// as dead-but-harmless config rather than ripped out mid-task). Works off
// Shelf Life's own data instead of a real canonical database — every
// matching row anyone on the site has logged (RLS already scopes `games`
// reads to public profiles plus the viewer's own, same implicit rule the
// collectible detail page and community-suggestions search already rely
// on). Weaker than a real canonical list — it can only know about
// issues/cards someone's actually logged — but it's real data, not a
// guess, and needs no new integration.
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

export async function getCrowdsourcedSeries(itemType, seriesValue) {
  const cfg = TYPE_CONFIG[itemType];
  if (!cfg) return { error: 'unsupported_type' };

  const value = (seriesValue || '').trim();
  if (!value) return { error: 'no_series_value' };

  const supabase = createClient();
  const cols = `id, title, cover, series, ${cfg.numberCol}`;

  // Comics often have `series` left blank with the series name just
  // typed into `title` instead (both patterns exist in real data) — so
  // for comics, match on either column rather than assuming everyone
  // filled in the same field the same way. Trading cards/Funko Pops
  // reliably use `card_set` as their one dedicated field.
  const queries =
    itemType === 'comic'
      ? [
          supabase.from('games').select(cols).eq('item_type', itemType).ilike('series', value),
          supabase.from('games').select(cols).eq('item_type', itemType).ilike('title', value),
        ]
      : [supabase.from('games').select(cols).eq('item_type', itemType).ilike('card_set', value)];

  const results = await Promise.all(queries);
  if (results.some((r) => r.error)) return { error: 'query_failed' };
  const rows = results.flatMap((r) => r.data || []);

  // Multiple collectors can (and often do) own the same issue/card —
  // dedupe down to one representative row per number, preferring
  // whichever copy actually has cover art.
  const byNumber = new Map();
  for (const row of rows) {
    const num = (row[cfg.numberCol] || '').trim();
    if (!num) continue;
    const key = num.toLowerCase();
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
