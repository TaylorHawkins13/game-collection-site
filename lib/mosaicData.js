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
export const CATEGORY_ORDER = ['game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'vhs', 'cd', 'console', 'funko_pop'];

export const TYPE_LABELS = {
  game: 'Video Games',
  comic: 'Comics',
  trading_card: 'Trading Cards',
  vinyl: 'Vinyl Records',
  book: 'Books',
  dvd: 'DVDs & Blu-rays',
  vhs: 'VHS',
  cd: 'CDs',
  console: 'Consoles',
  funko_pop: 'Funko Pops',
};

export const MODES = ['all', 'showcase', 'custom', 'type', 'year', 'top'];

export function modeLabel(mode, opts = {}) {
  if (mode === 'showcase') return 'Showcase';
  if (mode === 'custom') return 'Custom Selection';
  if (mode === 'top') return 'Most Valuable';
  if (mode === 'type') return TYPE_LABELS[opts.type] || 'Collection';
  if (mode === 'year') return opts.year ? `Added in ${opts.year}` : 'By Year';
  return 'The Whole Shelf';
}

// A stable, deterministic color from a title string — used for the
// placeholder tile of any item with no usable cover art, so a collector
// with lots of manually-entered items (no cover URL, or one that later
// 404s) still gets a consistent-looking tile instead of a blank gap.
// Curated warm/muted palette (not a full 360deg hash-to-hue spin) so
// placeholder tiles sit alongside the mosaic's wood/brass poster palette
// instead of occasionally landing on a clashing neon hue — kept in sync
// by hand with the identical palette in lib/mosaicRender.js (that file
// can't import this one, see its header comment for why).
const PLACEHOLDER_PALETTE = ['#7a4a3a', '#5c6b47', '#7a5a2e', '#3f5a5c', '#6b4a5c', '#8a5a35', '#4a5a3f'];
export function titleColor(title) {
  const str = title || '?';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLACEHOLDER_PALETTE[Math.abs(hash) % PLACEHOLDER_PALETTE.length];
}

function itemValue(item) {
  return item.market_price || item.price || 0;
}

// The one accent signal left after price tags moved to "every priced
// item gets one" (see shapeMosaic below) — the collector's own curated
// showcase picks, marked with a star tag.
export function computeAccents(items) {
  const showcaseIds = new Set(items.filter((i) => i.showcase_order != null).map((i) => i.id));
  return { showcaseIds };
}

// Caps the *total* number of items shown across the whole mosaic (not
// per category) — high enough that a single filtered-to-one-type shelf
// (which only ever has one category to draw from) can still fill several
// rows instead of stopping after one, but still bounded so a huge,
// wildly diverse collection doesn't render a runaway-tall poster.
const MAX_SHOWN_ITEMS = 80;
const MOST_VALUABLE_CAP = 15;

// Flattens tagged {item, categoryLabel} entries into fixed-width display
// rows (perRow items each) that flow continuously across category
// boundaries instead of giving every category its own row regardless of
// how few items it has — a shelf with 2 comics and 3 records shares one
// row instead of two nearly-empty ones, and a shelf with only one
// category present (e.g. the "By Type" view) spreads across as many full
// rows as its item count calls for instead of being stuck on one. Each
// display row tracks which category label(s) it contains for its plank
// tag, and carries a trailing overflow count if the entries ran out.
function packRows(taggedEntries, perRow) {
  const packed = [];
  for (let i = 0; i < taggedEntries.length; i += perRow) {
    const chunk = taggedEntries.slice(i, i + perRow);
    const labels = [...new Set(chunk.map((c) => c.categoryLabel))];
    const label = labels.length > 2 ? 'Mixed Shelf' : labels.join(' + ');
    const items = chunk.filter((c) => c.item).map((c) => c.item);
    const overflowEntry = chunk.find((c) => c.overflowCount != null);
    packed.push({ label, items, overflow: overflowEntry ? overflowEntry.overflowCount : 0 });
  }
  return packed;
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
  const perRow = opts.perRowCap || 10;

  let filtered = items;
  if (mode === 'type' && opts.type) filtered = items.filter((i) => i.item_type === opts.type);
  if (mode === 'showcase') filtered = items.filter((i) => i.showcase_order != null);
  if (mode === 'year' && opts.year) {
    const y = parseInt(opts.year, 10);
    if (Number.isFinite(y)) filtered = items.filter((i) => new Date(i.created_at).getFullYear() === y);
  }
  // Hand-picked subset — same "filtered" concept as every other mode, just
  // driven by an explicit id set (a Set or a plain array both work) rather
  // than a computed rule. Falls through to the default type-grouped
  // sort-by-added-date candidate logic below, same as "all" — a manually
  // curated mosaic still reads better organized by shelf/category than in
  // arbitrary pick order.
  if (mode === 'custom') {
    const ids = opts.selectedIds instanceof Set ? opts.selectedIds : new Set(opts.selectedIds || []);
    filtered = items.filter((i) => ids.has(i.id));
  }

  const { showcaseIds } = computeAccents(filtered);

  let candidates; // [{item, categoryLabel}], already in the order they should be packed
  let cap;
  if (mode === 'showcase') {
    const sorted = [...filtered].sort((a, b) => (a.showcase_order ?? 99) - (b.showcase_order ?? 99));
    candidates = sorted.map((item) => ({ item, categoryLabel: TYPE_LABELS[item.item_type] || item.item_type }));
    cap = MAX_SHOWN_ITEMS;
  } else if (mode === 'top') {
    // Only items with an actual tracked price belong on a "most valuable"
    // shelf — padding it out with untracked-price items sorted arbitrarily
    // to the bottom would be misleading, not just unranked filler. Digital
    // items are excluded entirely, same rule lib/valueSnapshot.js uses for
    // the dashboard's collection-value stat: there's no resale market for
    // them, so a stray manually-entered price shouldn't make a digital
    // item look like a standout "most valuable" piece.
    const sorted = filtered
      .filter((i) => i.copy_type !== 'digital' && itemValue(i) > 0)
      .sort((a, b) => itemValue(b) - itemValue(a));
    candidates = sorted.map((item) => ({ item, categoryLabel: 'Most Valuable' }));
    cap = MOST_VALUABLE_CAP;
  } else {
    const sorted = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const byType = {};
    sorted.forEach((i) => {
      (byType[i.item_type] ||= []).push(i);
    });
    candidates = [];
    CATEGORY_ORDER.filter((t) => byType[t]?.length).forEach((t) => {
      byType[t].forEach((item) => candidates.push({ item, categoryLabel: TYPE_LABELS[t] || t }));
    });
    cap = MAX_SHOWN_ITEMS;
  }

  const shown = candidates.slice(0, cap);
  const overflowCount = candidates.length - shown.length;
  if (overflowCount > 0) {
    shown.push({ overflowCount, categoryLabel: shown[shown.length - 1]?.categoryLabel || 'More' });
  }

  const rows = packRows(shown, perRow);

  return {
    rows,
    totalItems: filtered.length,
    shownItems: shown.filter((e) => e.item).length,
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
    .select('id, item_type, title, cover, showcase_order, market_price, price, copy_type, created_at')
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
    .select('id, item_type, title, cover, showcase_order, market_price, price, copy_type, created_at')
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
