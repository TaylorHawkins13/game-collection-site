// The trading-card "master set" backend for Magic: The Gathering, via
// Scryfall — the real per-set upgrade ROADMAP.md's "Magic master sets"
// line called for, same idea as lib/tcgdexSetLookup.js's Pokémon/TCGdex
// integration but a separate file rather than a shared one, since
// Scryfall's data shape (and what actually counts as a "variant") isn't
// the same as TCGdex's:
//
// - TCGdex only reports full print-variant data (Normal/Reverse Holo/
//   Holo/1st Edition/W Promo) on a *single card's own detail endpoint*,
//   one fetch per card — that's the whole reason tcgdexSetLookup.js only
//   spends the extra fetch on cards someone's actually logged a variant
//   copy of (see that file's header comment).
// - Scryfall is the opposite: a single `/cards/search?q=e:<code>` call
//   already returns every card in a set *with* its `finishes` array
//   (which of nonfoil/foil/etched that specific printing actually comes
//   in) inline — no per-card detail fetch needed at all. So unlike
//   Pokémon, Magic master sets get full, real variant data for every
//   card in the set on the very first request, no caching/precomputing
//   needed to avoid a timeout (see ROADMAP.md's separate, still-open
//   "Pokémon master sets: show variants you don't own yet" line — that
//   one genuinely needs precomputed data; this one doesn't).
//
// No API key needed — Scryfall's REST API is fully public. Its own docs
// (scryfall.com/docs/api) ask for "50-100ms of delay between requests" as
// etiquette, not a hard rate limit; since a set search here is normally
// 1-2 paginated calls (175 cards/page, and the overwhelming majority of
// real Magic sets are under 350 cards), a small delay between pages is
// enough to stay well within that ask without meaningfully slowing the
// lookup down.

import { normalizeCardNumber } from './seriesLookup';

// Scryfall's own vocabulary for what a specific printing can come in —
// see the `finishes` field on https://scryfall.com/docs/api/cards. Kept
// as its own list (not shared with TCGdex's KNOWN_VARIANTS in
// tcgdexSetLookup.js) since foil/etched have no Pokémon equivalent in
// this app's data and reverse/1st-edition/promo have no Magic one.
//
// `key` here is Scryfall's own vocabulary, used to read `card.finishes`.
// `matchKey` is the value actually baked into each entry's matchKey/used
// for ownership comparison — 'nonfoil' maps to the shared 'normal' rather
// than staying 'nonfoil', because lib/seriesLookup.js's guessCardVariant
// (shared by every trading-card TCG, not Magic-specific) already returns
// 'normal' for any card that isn't marked as a variant at all — that's
// the universal "plain base printing, nothing special logged" key every
// TCG's master-set backend has to agree on. Only a card genuinely marked
// is_variant with a recognizable foil/etched keyword in Variant Notes
// ever produces 'foil'/'etched'.
const KNOWN_FINISHES = [
  { key: 'nonfoil', matchKey: 'normal', label: 'Nonfoil' },
  { key: 'foil', matchKey: 'foil', label: 'Foil' },
  { key: 'etched', matchKey: 'etched', label: 'Etched Foil' },
];

// Same reasoning as tcgdexSetLookup.js's own TIMEOUT_MS — a slow Scryfall
// response shouldn't be able to hang the whole "See master set" request
// until Vercel's own platform ceiling kills it.
const TIMEOUT_MS = 8000;
// Scryfall's own requested etiquette delay between requests (see module
// comment above) — only actually matters here when a set spans more than
// one page (175+ cards), which most Magic sets don't.
const REQUEST_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scryfallFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Resolves a free-typed card_set value (e.g. "Foundations") to Scryfall's
// three-to-five-letter set code, the same "exact match preferred, first
// result otherwise" tolerance tcgdexSetLookup.js's findSetIdByName uses
// for the same reason — this is a free-typed field, not guaranteed to
// match Scryfall's own naming exactly. Scryfall's /sets endpoint returns
// every set (a few hundred) in one unpaginated response, so this is
// always a single request.
export async function findMtgSetByName(name) {
  const clean = (name || '').trim();
  if (!clean) return null;
  const json = await scryfallFetch('https://api.scryfall.com/sets');
  const sets = Array.isArray(json?.data) ? json.data : [];
  if (!sets.length) return null;
  const target = clean.toLowerCase();
  const exact = sets.find((s) => (s?.name || '').trim().toLowerCase() === target);
  // Fall back to a "starts with"/"contains" match rather than jumping
  // straight to an arbitrary first result — Scryfall's list mixes real
  // expansions with promos/tokens/art-series sets that share similar
  // names, so an unanchored first-result fallback risked landing on the
  // wrong one far more often than TCGdex's much smaller, cleaner set list
  // does.
  const partial = sets.find((s) => (s?.name || '').trim().toLowerCase().includes(target));
  const chosen = exact || partial;
  return chosen?.code ? { code: chosen.code, name: chosen.name } : null;
}

// Every card in a set, one row per distinct printing, already carrying
// real finish data — see module comment. `unique=prints` (rather than
// Scryfall's default `unique=cards`) matters here: without it, a card
// reprinted within the same set under more than one collector number
// (a showcase/borderless treatment, say) would collapse down to a single
// result and silently disappear from the checklist.
export async function fetchMtgSetCards(setCode) {
  const cards = [];
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`e:${setCode}`)}&unique=prints&order=set`;
  let first = true;
  while (url) {
    if (!first) await sleep(REQUEST_DELAY_MS);
    first = false;
    const json = await scryfallFetch(url);
    if (!json || json.object === 'error') break;
    if (Array.isArray(json.data)) cards.push(...json.data);
    url = json.has_more && json.next_page ? json.next_page : null;
  }
  return cards;
}

function labelForMatchKey(matchKey) {
  return KNOWN_FINISHES.find((f) => f.matchKey === matchKey)?.label || 'Nonfoil';
}

// Which finish matchKeys (see KNOWN_FINISHES above — 'normal'/'foil'/
// 'etched', the shared vocabulary lib/seriesLookup.js's ownedKeysFor
// compares against) a card actually comes in — Scryfall's own `finishes`
// array translated into that shared vocabulary, unioned with whatever
// this specific request's hints add (a print the requester has genuinely
// logged, guessed from Variant Notes — see guessCardVariant — always gets
// a tile even on the rare card whose Scryfall data is incomplete, same
// "trust your own logged copy" reasoning tcgdexSetLookup.js documents for
// TCGdex). `hintKeys` are already in the shared matchKey vocabulary
// (that's what guessCardVariant returns), so they need no translation.
function finishKeysForCard(card, hintKeys) {
  const reported = Array.isArray(card?.finishes)
    ? card.finishes.map((f) => KNOWN_FINISHES.find((kf) => kf.key === f)?.matchKey).filter(Boolean)
    : [];
  const known = new Set(KNOWN_FINISHES.map((f) => f.matchKey));
  const merged = new Set(reported);
  for (const key of hintKeys || []) {
    if (known.has(key)) merged.add(key);
  }
  const present = KNOWN_FINISHES.filter((f) => merged.has(f.matchKey)).map((f) => f.matchKey);
  return present.length ? present : ['normal'];
}

function coverFor(card) {
  if (card?.image_uris?.normal) return card.image_uris.normal;
  // Double-faced cards (transform/modal DFCs) carry their images on
  // card_faces instead of the top-level image_uris — front face only,
  // same "one cover per entry" convention the rest of this app already
  // uses everywhere else (GameCard, ShelfIdentityHero, etc.).
  const face = Array.isArray(card?.card_faces) ? card.card_faces[0] : null;
  return face?.image_uris?.normal || '';
}

// Returns { seriesName, entries } already shaped for SeriesGrid, mirroring
// tcgdexSetLookup.js's getMasterSetEntries — see that file for the shared
// entry shape ({id, cover, label, rawTitle, number, matchKey}) and why
// matchKey is built the way it is (has to line up with
// lib/seriesLookup.js's ownedKeysFor trading_card branch).
//
// `variantHints` — same shape as tcgdexSetLookup.js takes: an array of
// { number, variant } pairs, normalized card numbers the requester has
// logged a variant (foil/etched) copy of within this set. Unlike
// TCGdex, there's no separate "worth a real fetch" distinction here —
// every card already has full finish data from the one set-wide search,
// so hints only ever add to what's already known, never trigger an extra
// request.
export async function getMtgMasterSetEntries(setName, variantHints = []) {
  const set = await findMtgSetByName(setName);
  if (!set) return { error: 'no_series' };

  const cards = await fetchMtgSetCards(set.code);
  if (!cards.length) return { error: 'no_series' };

  const hintsByNumber = new Map();
  for (const h of Array.isArray(variantHints) ? variantHints : []) {
    if (!h?.number || !h?.variant) continue;
    if (!hintsByNumber.has(h.number)) hintsByNumber.set(h.number, new Set());
    hintsByNumber.get(h.number).add(h.variant);
  }

  const entries = [];
  for (const card of cards) {
    const rawNumber = card?.collector_number != null ? String(card.collector_number) : '';
    if (!rawNumber) continue;
    const number = normalizeCardNumber(rawNumber);
    if (!number) continue;
    const finishes = finishKeysForCard(card, [...(hintsByNumber.get(number) || [])]);
    for (const finishKey of finishes) {
      const finishLabel = labelForMatchKey(finishKey);
      entries.push({
        id: `${card.id}-${finishKey}`,
        cover: coverFor(card),
        label: finishKey === 'normal' && finishes.length === 1 ? `#${rawNumber}` : `#${rawNumber} · ${finishLabel}`,
        rawTitle: card.name || '',
        number: rawNumber,
        matchKey: `${number}::${finishKey}`,
      });
    }
  }

  if (!entries.length) return { error: 'no_series' };
  return { seriesName: set.name, entries };
}
