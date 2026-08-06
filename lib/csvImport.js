// Normalizes a raw CSV row (an object keyed by header name, as produced by
// Papa.parse with header:true) into a games-table-ready row, mirroring the
// exact same "clear out fields that don't apply to this item type" rules
// GameModal's handleSave uses, so a CSV import and a manually-entered item
// end up with identically-shaped data.

export const ITEM_TYPES = ['game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd', 'console', 'funko_pop'];
const OWNERSHIP = ['owned', 'wishlist', 'sold'];
const PLAY_STATUS = ['backlog', 'playing', 'completed', 'abandoned'];
const COPY_TYPES = ['', 'physical', 'digital'];
const COMPLETENESS = ['', 'loose', 'no_manual', 'cib', 'box_only'];

const HAS_PUBLISHER = ['comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd', 'console', 'funko_pop'];
const HAS_WRITER = ['comic', 'book', 'dvd', 'cd'];
const HAS_ARTIST = ['comic', 'vinyl'];
const HAS_GRADE = ['comic', 'trading_card', 'console', 'funko_pop'];
const HAS_VARIANT = ['comic', 'trading_card', 'funko_pop'];
const HAS_FORMAT = ['vinyl', 'book', 'dvd', 'cd', 'console'];
const HAS_REGION_COMPLETENESS = ['game', 'console'];
const HAS_CARD_FIELDS = ['trading_card', 'funko_pop'];
const ALWAYS_PHYSICAL = ['console', 'funko_pop'];

function splitList(val) {
  return (val || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function truthy(val) {
  const v = (val || '').trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1';
}

function parsePrice(val) {
  const v = (val || '').trim();
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function parseRating(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return 0;
  // Ratings go in 0.5 steps — round anything in between to the nearest one.
  return Math.round(Math.max(0, Math.min(5, n)) * 2) / 2;
}

function parseDate(val) {
  const v = (val || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

// Returns { data, warnings }. data is null when the row can't be used at
// all (no title) — warnings then explains why it was skipped.
export function normalizeRow(raw) {
  const warnings = [];
  const title = (raw.title || '').trim();
  if (!title) {
    return { data: null, warnings: ['missing title — row skipped'] };
  }

  let item_type = (raw.item_type || '').trim().toLowerCase();
  if (!ITEM_TYPES.includes(item_type)) {
    if (item_type) warnings.push(`unrecognized type "${raw.item_type}" — defaulted to Video Game`);
    item_type = 'game';
  }
  const isGame = item_type === 'game';
  const isComic = item_type === 'comic';

  let ownership = (raw.ownership || '').trim().toLowerCase();
  if (!OWNERSHIP.includes(ownership)) ownership = 'owned';

  let play_status = (raw.play_status || '').trim().toLowerCase();
  if (!PLAY_STATUS.includes(play_status)) play_status = 'backlog';

  let copy_type = (raw.copy_type || '').trim().toLowerCase();
  if (!COPY_TYPES.includes(copy_type)) copy_type = '';

  let completeness = (raw.completeness || '').trim().toLowerCase();
  // Old exports (before the "box" value was split into box_only/no_manual)
  // used a single "box" value that actually meant "complete minus the
  // manual" — map it forward so old CSVs still import sensibly.
  if (completeness === 'box') completeness = 'no_manual';
  if (!COMPLETENESS.includes(completeness)) completeness = '';

  const purchase_date = parseDate(raw.purchase_date);
  if (raw.purchase_date && raw.purchase_date.trim() && !purchase_date) {
    warnings.push(`purchase_date "${raw.purchase_date}" ignored — use YYYY-MM-DD`);
  }

  const price = parsePrice(raw.price);
  if (raw.price && raw.price.trim() && price === null) {
    warnings.push(`price "${raw.price}" ignored — not a number`);
  }

  // A console or Funko Pop is always physical — "digital" describes a
  // game with no physical copy at all, which doesn't apply to either, so
  // any digital/physical value in the CSV is ignored for these types
  // (same rule GameModal's handleSave enforces when the type is switched
  // there).
  if (ALWAYS_PHYSICAL.includes(item_type)) copy_type = 'physical';

  const data = {
    item_type,
    title,
    platforms: isGame ? splitList(raw.platforms) : [],
    region: HAS_REGION_COMPLETENESS.includes(item_type) ? (raw.region || '').trim() : '',
    genre: (raw.genre || '').trim(),
    barcode: (raw.barcode || '').trim(),
    tags: splitList(raw.tags),
    cover: (raw.cover || '').trim(),
    ownership,
    condition: isComic ? '' : (raw.condition || '').trim(),
    copy_type,
    completeness: HAS_REGION_COMPLETENESS.includes(item_type) ? completeness : '',
    price,
    purchase_date,
    play_status: isGame ? play_status : 'backlog',
    rating: parseRating(raw.rating),
    notes: (raw.notes || '').trim(),
    series: isComic ? (raw.series || '').trim() : '',
    issue_number: isComic ? (raw.issue_number || '').trim() : '',
    publisher: HAS_PUBLISHER.includes(item_type) ? (raw.publisher || '').trim() : '',
    writer: HAS_WRITER.includes(item_type) ? (raw.writer || '').trim() : '',
    artist: HAS_ARTIST.includes(item_type) ? (raw.artist || '').trim() : '',
    grade: HAS_GRADE.includes(item_type) ? (raw.grade || '').trim() : '',
    is_variant: HAS_VARIANT.includes(item_type) ? truthy(raw.is_variant) : false,
    variant_notes: HAS_VARIANT.includes(item_type) ? (raw.variant_notes || '').trim() : '',
    format: HAS_FORMAT.includes(item_type) ? (raw.format || '').trim() : '',
    edition: HAS_FORMAT.includes(item_type) ? (raw.edition || '').trim() : '',
    card_set: HAS_CARD_FIELDS.includes(item_type) ? (raw.card_set || '').trim() : '',
    card_number: HAS_CARD_FIELDS.includes(item_type) ? (raw.card_number || '').trim() : '',
    player_name: HAS_CARD_FIELDS.includes(item_type) ? (raw.player_name || '').trim() : '',
    fully_completed: truthy(raw.fully_completed),
  };

  return { data, warnings };
}
