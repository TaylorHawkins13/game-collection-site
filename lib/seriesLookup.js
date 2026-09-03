import { normalizeTitle } from './duplicateCheck';

// Which item types the "Series" feature covers, and how to get from an
// item to (a) the value worth searching on and (b) the key used to check
// whether a given series entry is already in a collection.
const NUMBER_FIELD_BY_TYPE = {
  comic: 'issue_number',
  trading_card: 'card_number',
  funko_pop: 'card_number',
};

// Vinyl/CD/DVD/VHS/Books don't have a natural numbered-series concept the
// way comics/cards/Funko Pops do (issue/card number) — there's no "issue
// 1 of 12" for an artist's discography or an author's bibliography.
// "Series" for these five instead means "everything by the same
// creator," matched by title since there's nothing else to key entries
// on. Field per type mirrors GameCard.jsx's getStatRows (Vinyl has its
// own dedicated `artist` column; CD/DVD/VHS/Book all share `writer`,
// labeled Artist/Director/Director/Author respectively). Crowdsourced-
// only (lib/seriesCrowdsource.js), same as Funko Pops — no real
// canonical discography/filmography/bibliography API is wired up here.
// Consoles are deliberately left out: there's no per-item "creator"
// field that forms a meaningful completable series the way artist/
// director/author do — grouping by Manufacturer would just be "every
// console this brand ever made," a category, not a series to complete.
const CREATOR_FIELD_BY_TYPE = {
  vinyl: 'artist',
  cd: 'writer',
  dvd: 'writer',
  vhs: 'writer',
  book: 'writer',
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
  return (
    itemType === 'game' ||
    Object.prototype.hasOwnProperty.call(NUMBER_FIELD_BY_TYPE, itemType) ||
    Object.prototype.hasOwnProperty.call(CREATOR_FIELD_BY_TYPE, itemType)
  );
}

// Which item types have a *real* per-series/per-set backend (TCGdex for
// trading cards, Comic Vine for comics) instead of Shelf Life's own
// crowdsourced-from-logged-items fallback — used purely to pick the
// right button copy ("See master set" vs "See full series") in
// GameModal/ItemDetailModal/SeriesModal. Funko Pops share comics'
// card_number-shaped data but stay on the crowdsourced path (checked for
// a free database to give them the same upgrade — see
// lib/seriesCrowdsource.js for the full findings; still not buildable as
// of this check), so they're deliberately not included here even though
// seriesSupported() covers them.
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
  const creatorField = CREATOR_FIELD_BY_TYPE[item.item_type];
  return creatorField ? (item[creatorField] || '').trim() : '';
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
//
// Only `ownership === 'owned'` rows count — fixed (Sep 2026), flagged
// directly: a wishlisted item (Pokémon XD, not yet bought) was showing as
// complete/owned in the GameCube master set. This function's name always
// said "owned," but nothing here ever actually checked the `ownership`
// column — a wishlist or sold row with a matching title/number counted
// the same as a real owned one, in every SeriesGrid this feeds (GameModal,
// ItemDetailModal, SeriesModal) and, via lib/platformCatalogueMatch.js's
// identical bug, the Full release catalogue too. Same "only ownership ===
// 'owned' counts" rule lib/collectionCompare.js, lib/valueSnapshot.js, and
// lib/mosaicData.js already apply elsewhere — this was the one place that
// had drifted from it.
export function ownedKeysFor(items, itemType) {
  const set = new Set();
  const numberField = NUMBER_FIELD_BY_TYPE[itemType];
  const creatorField = CREATOR_FIELD_BY_TYPE[itemType];
  for (const item of items || []) {
    if (item.item_type !== itemType) continue;
    if (item.ownership !== 'owned') continue;
    if (itemType === 'game') {
      if (item.title) set.add(normalizeTitle(item.title));
    } else if (itemType === 'trading_card') {
      const num = normalizeCardNumber(item.card_number);
      if (num) set.add(`${num}::${guessCardVariant(item)}`);
    } else if (numberField && item[numberField]) {
      set.add(normalizeTitle(String(item[numberField])));
    } else if (creatorField && item.title) {
      // No numbered field for these types — an owned entry is matched
      // by its (normalized) title instead, same key the crowdsourced
      // backend's title-based entries below produce.
      set.add(normalizeTitle(item.title));
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
//
// Only `ownership === 'owned'` rows contribute a hint — same bug/fix as
// ownedKeysFor above (Sep 2026): this feeds the master set's "trust a
// print you've actually logged" union, so a wishlisted card's variant was
// getting folded in as owned right alongside a real one.
export function variantHintsFor(items, cardSetValue) {
  const target = (cardSetValue || '').trim().toLowerCase();
  if (!target) return [];
  const seen = new Set();
  const hints = [];
  for (const item of items || []) {
    if (item.item_type !== 'trading_card' || !item.is_variant || item.ownership !== 'owned') continue;
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

// Best-effort guess at which print variant a logged trading card actually
// is, from the existing is_variant/variant_notes fields (a freeform
// "special version" flag shared with comics — see supabase-schema.sql —
// not a structured field built for this). Shared across every trading-
// card TCG this app has a real master-set backend for — TCGdex
// (lib/tcgdexSetLookup.js, Pokémon) and Scryfall (lib/scryfallSetLookup.js,
// Magic) — since both key off the same card_number/matchKey machinery;
// the keyword list below is just the union of both TCGs' own variant
// vocabulary. Not perfect: a card logged as "Reverse Holo, water damage"
// matches fine, but inconsistent or blank notes on a variant copy fall
// through to 'other', which won't line up with any specific
// TCGdex/Scryfall-reported variant and just won't show as owned on the
// master-set grid. Typing a recognizable keyword into Variant Notes
// (reverse / holo / 1st edition / promo — Pokémon; foil / etched —
// Magic) is what makes the match work.
function guessCardVariant(item) {
  if (!item.is_variant) return 'normal';
  const notes = (item.variant_notes || '').toLowerCase();
  if (notes.includes('revers')) return 'reverse';
  if (notes.includes('1st') || notes.includes('first edition')) return 'firstEdition';
  if (notes.includes('promo')) return 'wPromo';
  if (notes.includes('etch')) return 'etched';
  if (notes.includes('foil')) return 'foil';
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
    // Comic/card/Funko entries always carry a real `number` — the
    // crowdsourced creator-based types (Vinyl/CD/DVD/VHS/Book) don't
    // have one at all (see lib/seriesLookup.js's CREATOR_FIELD_BY_TYPE),
    // so their entries key/label off the title itself instead, same
    // pattern games already use above.
    entries: (json.entries || []).map((e) =>
      e.number != null
        ? {
            id: e.id,
            cover: e.cover,
            label: `#${e.number}`,
            rawTitle: e.title || '',
            number: e.number,
            matchKey: normalizeTitle(String(e.number)),
          }
        : {
            id: e.id,
            cover: e.cover,
            label: e.title || '',
            rawTitle: e.title || '',
            number: null,
            matchKey: normalizeTitle(e.title || ''),
          }
    ),
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
  const creatorField = CREATOR_FIELD_BY_TYPE[itemType];
  if (creatorField) {
    return { ...base, title: entry.rawTitle || entry.label, [creatorField]: seriesName || '' };
  }
  const number = entry.number != null ? String(entry.number) : '';
  const title = entry.rawTitle || (seriesName ? `${seriesName} #${number}` : `#${number}`);
  if (itemType === 'comic') {
    return { ...base, title, series: seriesName || '', issue_number: number };
  }
  // trading_card / funko_pop
  return { ...base, title, card_set: seriesName || '', card_number: number };
}
