// Normalizes a raw CSV row (an object keyed by header name, as produced by
// Papa.parse with header:true) into a games-table-ready row, mirroring the
// exact same "clear out fields that don't apply to this item type" rules
// GameModal's handleSave uses, so a CSV import and a manually-entered item
// end up with identically-shaped data.

export const ITEM_TYPES = ['game', 'comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd'];
const OWNERSHIP = ['owned', 'wishlist', 'sold'];
const PLAY_STATUS = ['backlog', 'playing', 'completed', 'abandoned'];
const COPY_TYPES = ['', 'physical', 'digital'];
const COMPLETENESS = ['', 'loose', 'cib', 'box'];

const HAS_PUBLISHER = ['comic', 'trading_card', 'vinyl', 'book', 'dvd', 'cd'];
const HAS_WRITER = ['comic', 'book', 'dvd', 'cd'];
const HAS_ARTIST = ['comic', 'vinyl'];
const HAS_GRADE = ['comic', 'trading_card'];
const HAS_FORMAT = ['vinyl', 'book', 'dvd', 'cd'];

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
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
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
  const isCard = item_type === 'trading_card';

  let ownership = (raw.ownership || '').trim().toLowerCase();
  if (!OWNERSHIP.includes(ownership)) ownership = 'owned';

  let play_status = (raw.play_status || '').trim().toLowerCase();
  if (!PLAY_STATUS.includes(play_status)) play_status = 'backlog';

  let copy_type = (raw.copy_type || '').trim().toLowerCase();
  if (!COPY_TYPES.includes(copy_type)) copy_type = '';

  let completeness = (raw.completeness || '').trim().toLowerCase();
  if (!COMPLETENESS.includes(completeness)) completeness = '';

  const purchase_date = parseDate(raw.purchase_date);
  if (raw.purchase_date && raw.purchase_date.trim() && !purchase_date) {
    warnings.push(`purchase_date "${raw.purchase_date}" ignored — use YYYY-MM-DD`);
  }

  const price = parsePrice(raw.price);
  if (raw.price && raw.price.trim() && price === null) {
    warnings.push(`price "${raw.price}" ignored — not a number`);
  }

  const data = {
    item_type,
    title,
    platforms: isGame ? splitList(raw.platforms) : [],
    region: isGame ? (raw.region || '').trim() : '',
    genre: (raw.genre || '').trim(),
    barcode: (raw.barcode || '').trim(),
    tags: splitList(raw.tags),
    cover: (raw.cover || '').trim(),
    ownership,
    condition: isComic ? '' : (raw.condition || '').trim(),
    copy_type,
    completeness: isGame ? completeness : '',
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
    is_variant: HAS_GRADE.includes(item_type) ? truthy(raw.is_variant) : false,
    variant_notes: HAS_GRADE.includes(item_type) ? (raw.variant_notes || '').trim() : '',
    format: HAS_FORMAT.includes(item_type) ? (raw.format || '').trim() : '',
    edition: HAS_FORMAT.includes(item_type) ? (raw.edition || '').trim() : '',
    card_set: isCard ? (raw.card_set || '').trim() : '',
    card_number: isCard ? (raw.card_number || '').trim() : '',
    player_name: isCard ? (raw.player_name || '').trim() : '',
    fully_completed: truthy(raw.fully_completed),
  };

  return { data, warnings };
}
