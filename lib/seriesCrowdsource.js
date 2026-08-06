import { createClient } from '@/lib/supabaseServer';

// The "Series" feature's non-game backend. Games get a real answer from
// IGDB's franchise data (see igdbSearch.getFranchiseGames); nothing free
// and public exists for comics/trading cards/Funko Pops, so this works
// off Shelf Life's own data instead — every matching row anyone on the
// site has logged (RLS already scopes `games` reads to public profiles
// plus the viewer's own, same implicit rule the collectible detail page
// and community-suggestions search already rely on). Weaker than a real
// canonical list — it can only know about issues/cards someone's actually
// logged — but it's real data, not a guess, and needs no new integration.
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
