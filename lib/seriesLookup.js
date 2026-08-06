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

export function seriesSupported(itemType) {
  return itemType === 'game' || Object.prototype.hasOwnProperty.call(NUMBER_FIELD_BY_TYPE, itemType);
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
export function ownedKeysFor(items, itemType) {
  const set = new Set();
  const numberField = NUMBER_FIELD_BY_TYPE[itemType];
  for (const item of items || []) {
    if (item.item_type !== itemType) continue;
    if (itemType === 'game') {
      if (item.title) set.add(normalizeTitle(item.title));
    } else if (numberField && item[numberField]) {
      set.add(normalizeTitle(String(item[numberField])));
    }
  }
  return set;
}

// Normalizes the two different API response shapes (/api/igdb-franchise's
// {franchiseName, games} vs /api/series-lookup's {seriesName, numberLabel,
// entries}) into one shape SeriesGrid can render generically, each entry
// carrying the same normalized key ownedKeysFor() produces so the two
// sides line up.
export function normalizeSeriesResponse(itemType, json) {
  if (itemType === 'game') {
    return {
      seriesName: json.franchiseName,
      entries: (json.games || []).map((g) => ({
        id: g.id,
        cover: g.cover,
        label: g.name,
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
      matchKey: normalizeTitle(String(e.number)),
    })),
  };
}
