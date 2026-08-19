import { normalizeTitle } from './duplicateCheck';

// Which item types the "Series" feature covers, and how to get from an
// item to (a) the value worth searching on and (b) the key used to check
// whether a given series entry is already in a collection. Vinyl/CD/DVD/
// VHS/books/consoles don't have a natural numbered-series concept the
// way comics/cards/Funko Pops do (issue/card number) or games do
// (franchise), so they're not included here — see ROADMAP.md.
const NUMBER_FIELD_BY_TYPE = {
  comic: 'issue_number',
  trading_card: 'card_number',
  funko_pop: 'card_number',
};

// Card numbers need their own normalization, not normalizeTitle()'s —
// that strips punctuation entirely, which mangles "4/102" into "4102"
// instead of extracting "4". TCGdex's own `localId` (what
// lib/tcgdexSetLookup.js's matchKeys are built from) is the bare
// number/code with no "/total" suffix, so an owned card's card_number
// (which might be "4", "#4", "4/102", or "004" depending on how it was
// typed or auto-filled) needs to collapse to that same bare form to
// ever match. Purely-numeric codes also get their leading zeros
// stripped ("004" -> "4"); alphanumeric codes (like Trainer Gallery's
// "TG01") are left as-is since the zero there is part of the real code,
// not padding.
export function normalizeCardNumber(raw) {
  let s = (raw ?? '').toString().trim();
  if (!s) return '';
  s = s.replace(/^#/, '').trim();
  s = s.split('/')[0].trim();
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s.toLowerCase();
}

export function seriesSupported(itemType) {
  return itemType === 'game' || Object.prototype.hasOwnProperty.call(NUMBER_FIELD_BY_TYPE, itemType);
}

// Which item types have a *real* per-series/per-set backend (TCGdex for
// trading cards, Comic Vine for comics) instead of Shelf Life's own
// crowdsourced-from-logged-items fallback — used purely to pick the
// right button copy ("See master set" vs "See full series") in
// GameModal/ItemDetailModal/SeriesModal. Funko Pops share comics'
// card_number-shaped data but stay on the crowdsourced path (no real
// per-line database available for them yet — see ROADMAP.md), so they're
// deliberately not included here even though seriesSupported() covers
// them.
export function isMasterSetType(itemType) {
  return itemType === 'trading_card' || itemType === 'comic';
}

// The string to actually search on, given an item (or in-progress form
// state shaped the same way). Games search by title (IGDB franchise
// lookup); comics fall back to title when series is blank, since real
// data has both patterns; cards/Funko Pops use their dedicated set field.
export function seriesQueryValueFor(item) {
  if (!item) return '';
  if (item.item_type === 'game') return (item.title || '').trim();
  if (item.item_type === 'comic') return (item.series || item.title || '').trim();
  if (item.item_type === 'trading_card' || item.item_type === 'funko_pop') return (item.card_set || '').trim();
  return '';
}

// Normalized keys for every item already in `items` that could match a
// series entry of `itemType` — games key on title, everything else keys
// on its number field (issue_number/card_number), since within one
// series/set the number is what actually distinguishes entries (the
// title is usually the series name, repeated across every issue).
//
// trading_card is the one exception: it keys on number *and* print
// variant (see guessCardVariant below), since the master-set feature
// (lib/tcgdexSetLookup.js) produces one entry per (card, variant) pair,
// not one per card number. funko_pop still shares card_number with
// trading cards but stays on the plain crowdsourced path (only Pokémon
// has a real master-set backend so far — see ROADMAP.md), so it's
// deliberately left out of the variant-aware branch below.
export function ownedKeysFor(items, itemType) {
  const set = new Set();
  const numberField = NUMBER_FIELD_BY_TYPE[itemType];
  for (const item of items || []) {
    if (item.item_type !== itemType) continue;
    if (itemType === 'game') {
      if (item.title) set.add(normalizeTitle(item.title));
    } else if (itemType === 'trading_card') {
      const num = normalizeCardNumber(item.card_number);
      if (num) set.add(`${num}::${guessCardVariant(item)}`);
    } else if (numberField && item[numberField]) {
      set.add(normalizeTitle(String(item[numberField])));
    }
  }
  return set;
}

// Which normalized card numbers, within one specific card_set, the
// caller has logged at least one variant (is_variant=true) copy of —
// each paired with a best-effort guess at *which* print (see
// guessCardVariant below) as a "number:variant" string, e.g. "71:reverse".
// Passed to /api/pokemon-master-set so it knows which cards are worth a
// real per-card TCGdex detail fetch (the only endpoint that reports
// variants at all — see lib/tcgdexSetLookup.js), AND so it can trust a
// print you've actually logged even when TCGdex's own data says
// otherwise. That second part matters in practice: TCGdex is a
// community-maintained database, and a set that only released in the
// last few weeks (like the "still doesn't show" report this was built
// to fix) can have real cards whose variants object simply hasn't been
// filled in yet — reverse/holo/etc. all reported false not because the
// print doesn't exist, but because nobody's gotten to that card yet.
// Your own logged copy is better evidence than an unfinished community
// entry, so the master set unions the two rather than only trusting
// TCGdex. Matches card_set case-insensitively since that's a free-typed
// field, same tolerance seriesQueryValueFor's callers already assume
// elsewhere. Notes that don't contain a recognizable keyword (guessed as
// 'other') are skipped — nothing to hint at without one.
export function variantHintsFor(items, cardSetValue) {
  const target = (cardSetValue || '').trim().toLowerCase();
  if (!target) return [];
  const seen = new Set();
  const hints = [];
  for (const item of items || []) {
    if (item.item_type !== 'trading_card' || !item.is_variant) continue;
    if ((item.card_set || '').trim().toLowerCase() !== target) continue;
    const num = normalizeCardNumber(item.card_number);
    if (!num) continue;
    const variant = guessCardVariant(item);
    if (variant === 'other') continue;
    const key = `${num}:${variant}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hints.push(key);
  }
  return hints;
}

// Best-effort guess at which TCGdex print variant a logged trading card
// actually is, from the existing is_variant/variant_notes fields (a
// freeform "special version" flag shared with comics — see
// supabase-schema.sql — not a structured field built for this). Not
// perfect: a card logged as "Reverse Holo, water damage" matches fine,
// but inconsistent or blank notes on a variant copy fall through to
// 'other', which won't line up with any specific TCGdex-reported
// variant and just won't show as owned on the master-set grid. Typing a
// recognizable keyword into Variant Notes (reverse / holo / 1st edition
// / promo) is what makes the match work.
function guessCardVariant(item) {
  if (!item.is_variant) return 'normal';
  const notes = (item.variant_notes || '').toLowerCase();
  if (notes.includes('revers')) return 'reverse';
  if (notes.includes('1st') || notes.includes('first edition')) return 'firstEdition';
  if (notes.includes('promo')) return 'wPromo';
  if (notes.includes('holo')) return 'holo';
  return 'other';
}

// Normalizes the two different API response shapes (/api/igdb-franchise's
// {franchiseName, games} vs /api/series-lookup's {seriesName, numberLabel,
// entries}) into one shape SeriesGrid can render generically, each entry
// carrying the same normalized key ownedKeysFor() produces so the two
// sides line up. Also keeps `number` (comics/cards/Funko Pops) and
// `rawTitle` around on each entry, even though SeriesGrid itself only
// ever displays `label` — prefillFromSeriesEntry() below needs the raw
// values to build a sensible Add Item prefill for a missing entry, and
// `label` alone (`"#12"` for non-game types) isn't enough for that.
export function normalizeSeriesResponse(itemType, json) {
  if (itemType === 'game') {
    return {
      seriesName: json.franchiseName,
      entries: (json.games || []).map((g) => ({
        id: g.id,
        cover: g.cover,
        label: g.name,
        rawTitle: g.name,
        number: null,
        matchKey: normalizeTitle(g.name),
      })),
    };
  }
  return {
    seriesName: json.seriesName,
    entries: (json.entries || []).map((e) => ({
      id: e.id,
      cover: e.cover,
      label: `#${e.number}`,
      rawTitle: e.title || '',
      number: e.number,
      matchKey: normalizeTitle(String(e.number)),
    })),
  };
}

// Builds an Add Item prefill (the same shape GameModal's `duplicateOf`
// prop already expects) from a missing series entry someone just clicked
// on — see ROADMAP.md "Full series view: let a missing entry link
// straight to an eBay check". Keeping this next to normalizeSeriesResponse
// since it's the one place that knows both the entry shape above and
// which item_type field each piece belongs in.
export function prefillFromSeriesEntry(itemType, seriesName, entry) {
  const base = { item_type: itemType, cover: entry.cover || '' };
  if (itemType === 'game') {
    return { ...base, title: entry.rawTitle || entry.label };
  }
  const number = entry.number != null ? String(entry.number) : '';
  const title = entry.rawTitle || (seriesName ? `${seriesName} #${number}` : `#${number}`);
  if (itemType === 'comic') {
    return { ...base, title, series: seriesName || '', issue_number: number };
  }
  // trading_card / funko_pop
  return { ...base, title, card_set: seriesName || '', card_number: number };
}
