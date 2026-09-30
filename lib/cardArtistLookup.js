// Trading-card "Creator pages" backend — illustrator pages for Magic
// (Scryfall) and Pokémon (TCGdex), the same two TCGs this app already has
// a real per-set master-set backend for (lib/scryfallSetLookup.js,
// lib/tcgdexSetLookup.js). Closes ROADMAP.md item 38's one open question
// on the Creator pages entry (comics/books/games all shipped already):
// "Trading cards — plausible for Magic, unconfirmed for Pokémon." Checked
// directly before building, not assumed: TCGdex's own API reference
// (tcgdex.dev/reference/card) documents a real `illustrator` field on the
// Card object, and tcgdex.dev/rest/other-fields lists a real
// `/illustrators` catalog endpoint (api.tcgdex.net/v2/en/illustrators) —
// same flat-list shape lib/legoLookup.js's theme cache already relies on
// for Rebrickable — so Pokémon creator pages are just as buildable as
// Magic's, not blocked the way this line originally left it.
//
// Two very different backends, two very different fetch shapes:
//
// - Magic/Scryfall: `artist:"<name>"` is a documented search operator
//   (scryfall.com/docs/api/cards/search) that returns full card objects
//   in one shot — same image_uris/set_name/collector_number shape
//   lib/scryfallSetLookup.js's fetchMtgSetCards already relies on, no
//   per-card detail fetch needed.
// - Pokémon/TCGdex: confirmed against tcgdex.dev/rest/filtering-sorting-
//   pagination — `illustrator=eq:<name>` is the real filter syntax, but
//   like every other TCGdex list endpoint this app already integrates
//   with (see app/api/card-search/route.js's fetchTcgdexBrief), a
//   filtered card list only returns the bare id/name/image "brief" shape
//   — no set name or card number. Getting a real, coverable grid needs a
//   second per-card detail fetch, same two-step shape
//   lib/comicVineCreatorLookup.js already uses for Comic Vine's person
//   credits. Reuses lib/tcgdexSetLookup.js's own exported
//   fetchDetailsForCards() (a concurrency-limited batch fetcher already
//   built for exactly this "a batch of cards, each needing its own detail
//   call" shape) rather than writing a second copy of it.
//
// Both artist-name catalogs (Scryfall's /catalog/artist-names, TCGdex's
// /illustrators) are cached the same module-scope, 1-hour-TTL way
// lib/legoLookup.js's theme cache already is — neither list changes fast
// enough to justify a live fetch on every keystroke of the typeahead.
//
// Live-tested after deploy (see CHANGELOG.md): the Pokémon/TCGdex path
// worked first try. The Magic/Scryfall path did not — every search came
// back empty, even for definitely-real artists like Rebecca Guay. Root
// cause: scryfallFetch here sent no User-Agent header, and Scryfall
// silently 403s catalog/search requests without one from a Vercel
// serverless IP (fine from a real browser, which is why this never showed
// up checking the docs or the endpoint by hand). Fixed by sending the same
// User-Agent app/api/card-search/route.js's searchScryfall already does —
// and the exact same bug, same fix, applied to lib/scryfallSetLookup.js,
// which turned out to have been silently broken the same way since before
// this file existed (see that file's own header comment).
//
// Deliberate simplification, same one the comic creator page already
// makes for print/variant details: owning ANY printing of a card (any
// set it was reprinted in aside, and regardless of foil/reverse-holo/etc.
// finish) counts as owning it here — entries key on (set, card number)
// only, not finish. A true master-set-style finish breakdown is what
// "See master set" on the item itself already does; a creator page is
// about browsing a whole body of work, not auditing one set's prints.

import { normalizeTitle } from './duplicateCheck';
import { normalizeCardNumber } from './seriesLookup';
import { fetchDetailsForCards } from './tcgdexSetLookup';

const TIMEOUT_MS = 8000;
const CATALOG_CACHE_MS = 60 * 60 * 1000; // 1 hour, same as legoLookup's theme cache
const SEARCH_LIMIT_PER_GAME = 6;
const TCGDEX_PAGE_SIZE = 100;
const CARD_HARD_CAP = 1000; // backstop, not an expected ceiling — see comicVineCreatorLookup.js's ISSUE_HARD_CAP for the same reasoning
const DEADLINE_MS = 45000; // leaves headroom under the route's own maxDuration, same spirit as comicVineCreatorLookup.js's DEADLINE_MS
const REQUEST_DELAY_MS = 100; // Scryfall's own requested etiquette delay between paginated requests

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function scryfallFetch(url) {
  let res;
  try {
    // User-Agent is required, not optional — confirmed live (see the
    // CHANGELOG.md entry dated around this file's own live-verification):
    // without it Scryfall's catalog/search endpoints silently 403 from a
    // Vercel serverless IP while returning fine to a real browser, so the
    // failure never showed up hitting these endpoints by hand. Matches the
    // header app/api/card-search/route.js's searchScryfall already sends.
    res = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'ShelfLifeApp/1.0 (collection tracker)' },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function tcgdexFetch(path) {
  let res;
  try {
    res = await fetchWithTimeout(`https://api.tcgdex.net/v2/en${path}`, { headers: { Accept: 'application/json' } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

let mtgArtistCache = null;
let mtgArtistCacheAt = 0;
let pokemonArtistCache = null;
let pokemonArtistCacheAt = 0;

async function getMtgArtistNames() {
  const now = Date.now();
  if (mtgArtistCache && now - mtgArtistCacheAt < CATALOG_CACHE_MS) return mtgArtistCache;
  const json = await scryfallFetch('https://api.scryfall.com/catalog/artist-names');
  const names = Array.isArray(json?.data) ? json.data.filter((n) => typeof n === 'string' && n.trim()) : null;
  if (!names) return mtgArtistCache || [];
  mtgArtistCache = names;
  mtgArtistCacheAt = now;
  return names;
}

async function getPokemonArtistNames() {
  const now = Date.now();
  if (pokemonArtistCache && now - pokemonArtistCacheAt < CATALOG_CACHE_MS) return pokemonArtistCache;
  const json = await tcgdexFetch('/illustrators');
  // Defensive against either a flat string array (the documented shape
  // for TCGdex's other simple catalog endpoints, like /categories) or an
  // array of { name } objects, in case illustrators is shaped differently
  // — this sandbox couldn't fetch the real response to confirm which.
  const raw = Array.isArray(json) ? json : [];
  const names = raw.map((n) => (typeof n === 'string' ? n : n?.name || '')).filter((n) => n.trim());
  if (!names.length) return pokemonArtistCache || [];
  pokemonArtistCache = names;
  pokemonArtistCacheAt = now;
  return names;
}

// Typeahead behind /creator/cards — searches both catalogs' cached name
// lists client-side (a plain substring match, same tolerance every other
// free-typed-field lookup in this codebase uses) and returns combined
// results tagged with which game each name belongs to.
export async function searchCardArtists(query) {
  const clean = (query || '').trim();
  if (!clean) return { items: [] };
  const target = clean.toLowerCase();

  const [mtgNames, pokemonNames] = await Promise.all([
    getMtgArtistNames().catch(() => []),
    getPokemonArtistNames().catch(() => []),
  ]);
  if (!mtgNames.length && !pokemonNames.length) return { error: 'query_failed' };

  const mtgMatches = mtgNames.filter((n) => n.toLowerCase().includes(target)).slice(0, SEARCH_LIMIT_PER_GAME);
  const pokemonMatches = pokemonNames.filter((n) => n.toLowerCase().includes(target)).slice(0, SEARCH_LIMIT_PER_GAME);

  const items = [
    ...mtgMatches.map((name) => ({ name, game: 'mtg', gameLabel: 'Magic: The Gathering' })),
    ...pokemonMatches.map((name) => ({ name, game: 'pokemon', gameLabel: 'Pokémon TCG' })),
  ];
  return { items };
}

export function cardCreatorMatchKey(setName, number) {
  return `${normalizeTitle(setName)}::${normalizeCardNumber(number)}`;
}

function coverForScryfallCard(card) {
  if (card?.image_uris?.normal) return card.image_uris.normal;
  const face = Array.isArray(card?.card_faces) ? card.card_faces[0] : null;
  return face?.image_uris?.normal || '';
}

function sortEntries(entries) {
  entries.sort((a, b) => {
    if (a.series !== b.series) return a.series.localeCompare(b.series);
    const na = parseFloat(a.number);
    const nb = parseFloat(b.number);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return String(a.number).localeCompare(String(b.number));
  });
  return entries;
}

async function getMtgArtistWorks(name) {
  const cards = [];
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`artist:"${name}"`)}&unique=prints&order=released`;
  let first = true;
  while (url) {
    if (!first) await sleep(REQUEST_DELAY_MS);
    first = false;
    const json = await scryfallFetch(url);
    if (!json || json.object === 'error') break;
    if (Array.isArray(json.data)) cards.push(...json.data);
    url = json.has_more && json.next_page ? json.next_page : null;
    if (cards.length >= CARD_HARD_CAP) break;
  }
  if (!cards.length) return { error: 'no_creator' };

  const entries = [];
  for (const card of cards) {
    const rawNumber = card?.collector_number != null ? String(card.collector_number) : '';
    const setName = card?.set_name || '';
    if (!rawNumber || !setName) continue;
    entries.push({
      id: card.id,
      cover: coverForScryfallCard(card),
      label: `${setName} #${rawNumber}`,
      series: setName,
      rawTitle: card.name || '',
      number: rawNumber,
      matchKey: cardCreatorMatchKey(setName, rawNumber),
    });
  }
  if (!entries.length) return { error: 'no_creator' };
  return { name, image: '', entries: sortEntries(entries), truncated: cards.length >= CARD_HARD_CAP };
}

async function getPokemonArtistWorks(name) {
  const briefs = [];
  const startedAt = Date.now();
  for (let page = 1; briefs.length < CARD_HARD_CAP; page++) {
    if (page > 1 && Date.now() - startedAt > DEADLINE_MS) break;
    const json = await tcgdexFetch(
      `/cards?illustrator=${encodeURIComponent(`eq:${name}`)}&pagination:page=${page}&pagination:itemsPerPage=${TCGDEX_PAGE_SIZE}`
    );
    if (!Array.isArray(json) || !json.length) break;
    briefs.push(...json);
    if (json.length < TCGDEX_PAGE_SIZE) break;
  }
  if (!briefs.length) return { error: 'no_creator' };

  const capped = briefs.slice(0, CARD_HARD_CAP);
  const detailById = await fetchDetailsForCards(capped);

  const entries = [];
  for (const brief of capped) {
    const detail = detailById.get(brief.id);
    const setName = detail?.set?.name || '';
    const rawNumber = detail?.localId != null ? String(detail.localId) : brief?.localId != null ? String(brief.localId) : '';
    if (!setName || !rawNumber) continue; // couldn't get full detail for this one — skip rather than show a half-blank tile
    entries.push({
      id: brief.id,
      cover: brief.image ? `${brief.image}/low.webp` : '',
      label: `${setName} #${rawNumber}`,
      series: setName,
      rawTitle: (detail?.name || brief.name) || '',
      number: rawNumber,
      matchKey: cardCreatorMatchKey(setName, rawNumber),
    });
  }
  if (!entries.length) return { error: 'no_creator' };
  return {
    name,
    image: '',
    entries: sortEntries(entries),
    truncated: briefs.length > capped.length || detailById.size < capped.length,
  };
}

// Returns { name, image, entries, truncated } — same shape
// getComicCreatorWorks (lib/comicVineCreatorLookup.js) returns, so the
// page/client components can share its exact rendering pattern.
export async function getCardArtistWorks(name, game) {
  const clean = (name || '').trim();
  if (!clean) return { error: 'no_creator' };
  if (game === 'mtg') return getMtgArtistWorks(clean);
  if (game === 'pokemon') return getPokemonArtistWorks(clean);
  return { error: 'no_creator' };
}
