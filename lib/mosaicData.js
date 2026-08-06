// Shared data/grouping logic for the "shelf mosaic" feature — a poster of
// a collector's real cover art arranged like items standing on an actual
// shelf (one row per category), used by both the shareable PNG route
// (app/u/[username]/mosaic-image/route.js) and the live interactive page
// (app/u/[username]/mosaic/page.js). Kept here as plain data-shaping logic
// with no rendering code, so the two very different renderers (Satori/
// ImageResponse for the PNG, plain React/CSS for the live page) can stay
// in sync without duplicating the query + grouping rules.

// Fixed display order for shelf rows — matches the category order used
// on the home page's category pills, so "which shelf comes first" reads
// the same way across the site.
export const CATEGORY_ORDER = ['game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd', 'console', 'funko_pop'];

export const TYPE_LABELS = {
  game: 'Video Games',
  comic: 'Comics',
  trading_card: 'Trading Cards',
  vinyl: 'Vinyl Records',
  book: 'Books',
  dvd: 'DVDs & Blu-rays',
  cd: 'CDs',
  console: 'Consoles',
  funko_pop: 'Funko Pops',
};

export const MODES = ['all', 'showcase', 'type', 'year', 'top'];

export function modeLabel(mode, opts = {}) {
  if (mode === 'showcase') return 'Showcase';
  if (mode === 'top') return 'Most Valuable';
  if (mode === 'type') return TYPE_LABELS[opts.type] || 'Collection';
  if (mode === 'year') return opts.year ? `Added in ${opts.year}` : 'By Year';
  return 'The Whole Shelf';
}

// A stable, deterministic color from a title string — used for the
// placeholder tile of any item with no usable cover art, so a collector
// with lots of manually-entered items (no cover URL, or one that later
// 404s) still gets a consistent-looking tile instead of a blank gap.
export function titleColor(title) {
  const str = title || '?';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 42%, 32%)`;
}

function itemValue(item) {
  return item.market_price || item.price || 0;
}

// Two independent accent signals, computed across whatever item set is
// actually being shown (not the whole collection) so "most valuable"
// always highlights something within the current view:
//  - showcaseIds: the collector's own curated showcase picks (a star tag)
//  - topValueIds: the 5 highest-value items in view (a price tag)
export function computeAccents(items) {
  const valued = items.filter((i) => itemValue(i) > 0);
  const topValueIds = new Set(
    [...valued]
      .sort((a, b) => itemValue(b) - itemValue(a))
      .slice(0, 5)
      .map((i) => i.id)
  );
  const showcaseIds = new Set(items.filter((i) => i.showcase_order != null).map((i) => i.id));
  return { topValueIds, showcaseIds };
}

function groupIntoShelves(items, perRowCap) {
  const byType = {};
  items.forEach((i) => {
    (byType[i.item_type] ||= []).push(i);
  });
  return CATEGORY_ORDER.filter((t) => byType[t]?.length).map((t) => {
    const all = byType[t];
    const shown = all.slice(0, perRowCap);
    return { type: t, label: TYPE_LABELS[t] || t, items: shown, overflow: all.length - shown.length, total: all.length };
  });
}

// Pure shaping logic — takes an already-fetched array of owned items (no
// supabase/network involved) and a mode, and returns shelf rows + accent
// sets. Split out from fetchMosaicData() below so the exact same grouping
// rules can run twice: once server-side for the PNG route (which only
// ever needs one mode per request), and once client-side on the live
// mosaic page (which fetches the full collection a single time and then
// switches modes instantly, with no refetch, by re-running this on
// whatever's already in memory).
export function shapeMosaic(items, opts = {}) {
  const mode = MODES.includes(opts.mode) ? opts.mode : 'all';
  const perRowCap = opts.perRowCap || 10;

  let filtered = items;
  if (mode === 'type' && opts.type) filtered = items.filter((i) => i.item_type === opts.type);
  if (mode === 'showcase') filtered = items.filter((i) => i.showcase_order != null);
  if (mode === 'year' && opts.year) {
    const y = parseInt(opts.year, 10);
    if (Number.isFinite(y)) filtered = items.filter((i) => new Date(i.created_at).getFullYear() === y);
  }

  let sorted;
  if (mode === 'showcase') {
    sorted = [...filtered].sort((a, b) => (a.showcase_order ?? 99) - (b.showcase_order ?? 99));
  } else if (mode === 'top') {
    // Only items with an actual tracked price belong on a "most valuable"
    // shelf — padding it out with untracked-price items sorted arbitrarily
    // to the bottom would be misleading, not just unranked filler.
    sorted = filtered.filter((i) => itemValue(i) > 0).sort((a, b) => itemValue(b) - itemValue(a));
  } else {
    sorted = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  const { topValueIds, showcaseIds } = computeAccents(filtered);

  // "Most valuable" reads better as one single highlight shelf than split
  // across categories — the point is "here's your best stuff", not "here's
  // your most valuable game vs. most valuable comic separately".
  const rows =
    mode === 'top'
      ? [
          {
            type: 'top',
            label: 'Most Valuable',
            items: sorted.slice(0, 15),
            overflow: Math.max(0, sorted.length - 15),
            total: sorted.length,
          },
        ]
      : groupIntoShelves(sorted, perRowCap);

  return {
    rows,
    totalItems: filtered.length,
    shownItems: rows.reduce((n, r) => n + r.items.length, 0),
    topValueIds,
    showcaseIds,
  };
}

// Fetches one collector's owned items and shapes them into shelf rows for
// a given display mode. `supabase` is a server client already scoped by
// the caller's RLS session — this function doesn't do any auth of its
// own. Used by the PNG route, which needs exactly one mode per request.
export async function fetchMosaicData(supabase, profileId, opts = {}) {
  const { data, error } = await supabase
    .from('games')
    .select('id, item_type, title, cover, showcase_order, market_price, price, created_at')
    .eq('user_id', profileId)
    .eq('ownership', 'owned');

  const items = error ? [] : data || [];
  return shapeMosaic(items, opts);
}

// Fetches the full raw owned-items array with no mode filtering — used by
// the live mosaic page, which shapes it client-side via shapeMosaic() so
// switching modes is instant with no network round trip.
export async function fetchOwnedItems(supabase, profileId) {
  const { data, error } = await supabase
    .from('games')
    .select('id, item_type, title, cover, showcase_order, market_price, price, created_at')
    .eq('user_id', profileId)
    .eq('ownership', 'owned');
  return error ? [] : data || [];
}

// Distinct years present in an items array, newest first — used to
// populate the "By Year" picker on the live mosaic page.
export function availableYears(items) {
  const years = new Set((items || []).map((r) => new Date(r.created_at).getFullYear()));
  return [...years].sort((a, b) => b - a);
}

// Distinct item_types present, in the same fixed display order as the
// shelf rows — used to populate the "By Type" picker.
export function availableTypes(items) {
  const present = new Set((items || []).map((r) => r.item_type));
  return CATEGORY_ORDER.filter((t) => present.has(t));
}
