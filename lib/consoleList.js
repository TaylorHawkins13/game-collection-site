// Console "auto-search" is a hardcoded list rather than a live API —
// there's no good free public database of game consoles the way IGDB
// covers games or Open Library covers books, so instead of leaving
// Consoles with zero auto-fill, this covers the common ones people
// actually collect: pick one and Manufacturer + Genre (Home console /
// Handheld) fill in, same interaction as the other Search buttons.
// Not meant to be exhaustive — anything obscure/regional still gets
// typed in by hand, same as always.
export const CONSOLES = [
  { name: 'Nintendo Switch', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Switch Lite', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Nintendo Switch OLED', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Switch 2', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo 64', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo GameCube', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Wii', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Wii U', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Super Nintendo (SNES)', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Entertainment System (NES)', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Game Boy', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Game Boy Color', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Game Boy Advance', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Nintendo DS', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Nintendo 3DS', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'PlayStation', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 2', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 3', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 4', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 4 Pro', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 5', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 5 Pro', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PSP', manufacturer: 'Sony', genre: 'Handheld' },
  { name: 'PS Vita', manufacturer: 'Sony', genre: 'Handheld' },
  { name: 'Xbox', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox 360', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox One', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox One X', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox Series S', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox Series X', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Sega Genesis / Mega Drive', manufacturer: 'Sega', genre: 'Home console' },
  { name: 'Sega Saturn', manufacturer: 'Sega', genre: 'Home console' },
  { name: 'Sega Dreamcast', manufacturer: 'Sega', genre: 'Home console' },
  { name: 'Sega Game Gear', manufacturer: 'Sega', genre: 'Handheld' },
  { name: 'Atari 2600', manufacturer: 'Atari', genre: 'Home console' },
  { name: 'Atari 7800', manufacturer: 'Atari', genre: 'Home console' },
  { name: 'Steam Deck', manufacturer: 'Valve', genre: 'Handheld' },
  { name: 'ROG Ally', manufacturer: 'Asus', genre: 'Handheld' },
  { name: 'Neo Geo', manufacturer: 'SNK', genre: 'Home console' },
  { name: '3DO', manufacturer: 'Panasonic', genre: 'Home console' },
];

// Plain Wagner–Fischer edit distance, no dependency needed for a list
// this small (39 entries, a handful of words each) — every call below
// runs in well under a millisecond.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Tolerance scales with word length — a couple of characters off in a
// longer word is a plausible typo; the same distance on a short word
// just means a different word entirely.
function maxDistanceFor(word) {
  return word.length <= 5 ? 1 : word.length <= 9 ? 2 : 3;
}

// Every word in the (multi-word) query needs a close match somewhere
// among the console name's own words — checked word-by-word rather than
// as one long string, so a typo anywhere in a multi-word query ("xbox
// seris x", "sega genesys") doesn't get penalized against the full
// name's length, and so a query that's only gotten partway typed doesn't
// need every word from the name present. Returns the summed distance
// (lower = closer) for ranking, or null if any query word has nothing
// close enough in this name to count as a match at all.
function wordLevelDistance(queryWords, name) {
  const nameWords = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let total = 0;
  for (const qw of queryWords) {
    let best = Infinity;
    for (const nw of nameWords) {
      const d = levenshtein(qw, nw);
      if (d < best) best = d;
    }
    if (best > maxDistanceFor(qw)) return null;
    total += best;
  }
  return total;
}

// Word-level matching alone misses the equally common case of a query
// that just doesn't split into the same words the name does — "gameboy"
// (typed as one word, no typo at all) doesn't fuzzy-match "Game" or "Boy"
// individually since it isn't close to either alone. Comparing both
// strings with every space/punctuation character stripped out entirely
// catches that: "gameboyadvence" vs "gameboyadvance" is a one-character
// edit distance apart. Only used as a fallback for whatever word-level
// matching didn't already catch — the two approaches cover different
// failure modes, so a name matches if either one calls it close enough.
function flatDistance(query, name) {
  const flatQuery = query.replace(/\s+/g, '');
  const flatName = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return levenshtein(flatQuery, flatName);
}

function fuzzyDistance(queryWords, query, name) {
  const wordDistance = wordLevelDistance(queryWords, name);
  const flat = flatDistance(query, name);
  const flatOk = flat <= maxDistanceFor(query.replace(/\s+/g, ''));
  if (wordDistance === null && !flatOk) return null;
  if (wordDistance === null) return flat;
  if (!flatOk) return wordDistance;
  return Math.min(wordDistance, flat);
}

export function searchConsoles(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const exact = CONSOLES.filter((c) => c.name.toLowerCase().includes(q));

  // Substring matches always come first (a query typed so far, like
  // "play", is a prefix, not a typo, and should rank above anything
  // fuzzy). Below 3 characters, near enough every name in a 39-entry
  // list is "close" by edit distance, so short queries stay substring-
  // only — fuzzy matching would just add noise, not typo tolerance.
  if (q.length < 3) return exact.slice(0, 8);

  // A plain `.includes()` match had zero typo tolerance — a single
  // dropped or swapped letter ("nintendo swithc", "playstaton 5",
  // "xbox seris x") returned nothing at all, on a list short enough
  // that a genuine near-miss is almost always exactly one console.
  const queryWords = q.split(/\s+/).filter(Boolean);
  const fuzzy = CONSOLES.filter((c) => !exact.includes(c))
    .map((c) => ({ console: c, distance: fuzzyDistance(queryWords, q, c.name) }))
    .filter((m) => m.distance !== null)
    .sort((a, b) => a.distance - b.distance)
    .map((m) => m.console);

  return [...exact, ...fuzzy].slice(0, 8);
}
