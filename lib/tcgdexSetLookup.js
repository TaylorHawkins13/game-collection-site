// The trading-card "master set" backend — Pokémon only (Magic's now its
// own file, lib/scryfallSetLookup.js). Unlike lib/seriesCrowdsource.js's
// generic comic/card/Funko Pop "series" feature (which can only know
// about numbers other Shelf Life users happen to have logged), this hits
// TCGdex's real per-set data, including which print variants (Normal,
// Reverse Holo, Holo, 1st Edition, etc.) actually exist for each card —
// a genuine master-set checklist, not a guess built from whatever's
// already in the database.
//
// Confirmed against TCGdex's own docs (tcgdex.dev/reference/card-brief,
// tcgdex.dev/rest/set): the per-set card list (`GET /sets/{id}`) only
// ever returns the "brief" shape — id/localId/name/image, no variants —
// regardless of the card. `variants` (normal/reverse/holo/firstEdition/
// wPromo) only exists on a single card's own detail endpoint
// (`GET /cards/{id}`), one fetch per card. There's no bulk "give me
// variants for this whole set" endpoint.
//
// Real Pokémon sets commonly run 100-250+ cards, so fetching full detail
// for every card in a set on every single live "See master set" click
// isn't viable — both a Vercel function timeout risk and a bad-citizen
// move against a free, community-run API. Two paths exist for getting a
// card's real variant detail, and getMasterSetEntries below picks
// whichever is available:
//
// 1. A cache hit (`master_set_cache`, see supabase-schema.sql and the new
//    /api/cron/refresh-master-sets) — a background cron pre-fetches full
//    variant detail for every card in any set someone's actually logged
//    a trading card from, refreshed periodically, so a live request never
//    has to do that work itself. This is what closes ROADMAP.md's
//    "Pokémon master sets: show variants you don't own yet" — with a
//    cache hit, EVERY card in the set shows its real variants, not just
//    ones you've already logged a copy of.
// 2. No cache yet (a set nobody's viewed since the cron last ran, or ever)
//    — falls back to the original, narrower behavior: only the cards the
//    requester has actually logged a variant copy of (passed in — see
//    lib/seriesLookup.js's variantHintsFor and its use in GameModal/
//    ItemDetailModal/SeriesModal) get a real per-card fetch, capped at
//    MAX_DETAIL_FETCHES; everything else renders as a single "Normal"
//    tile until the cron catches up. Never blocks a live request on
//    fetching an entire uncached set.
//
// One more real gap, found by debug-logging a live request against a
// brand-new set ("Chaos Rising," days-old at the time): TCGdex is a
// community-maintained database, and a set that new can have cards whose
// `variants` object is present but not actually filled in yet — every
// key reported false, including for a print that demonstrably exists
// (the requester had a real reverse holo copy logged). Trusting TCGdex
// alone there would permanently hide a print you know you own until
// someone else finishes cataloguing that card, or (now) until the next
// cache refresh. So the variant keys actually rendered are always the
// union of what TCGdex reports (cached or freshly fetched) AND the
// current request's own guessed hints (see variantHintsFor) — your own
// logged copy always gets a tile.

import { normalizeCardNumber } from './seriesLookup';

const KNOWN_VARIANTS = [
  { key: 'normal', label: 'Normal' },
  { key: 'reverse', label: 'Reverse Holo' },
  { key: 'holo', label: 'Holo' },
  { key: 'firstEdition', label: '1st Edition' },
  { key: 'wPromo', label: 'W Promo' },
];

// Same fix, same reason, as app/api/card-search/route.js's fetchWithTimeout
// (see that file's comment for the full story — a live-reported "Pokémon
// search randomly stopped finding cards" bug traced to these TCGdex fetches
// having no timeout at all, so one slow request could hang an entire
// function until Vercel's own 300-second platform ceiling killed it). This
// module hits the same API, so it carries the same exposure — a slow
// /sets/{id} or /cards/{id} response here could just as easily stall
// "See master set."
const TIMEOUT_MS = 8000;

async function tcgdexFetch(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`https://api.tcgdex.net/v2/en${path}`, {
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

// TCGdex's /sets list supports the same name filter as /cards (see
// card-search's fetchTcgdexBrief). A free-typed card_set value won't
// always match exactly — prefer an exact case-insensitive match (what
// you get when a card was added via the trading-card Search button,
// which fills card_set from TCGdex's own set name) and fall back to the
// first result otherwise, same "best effort on free text" tradeoff
// lib/seriesCrowdsource.js already makes.
export async function findSetIdByName(name) {
  const clean = (name || '').trim();
  if (!clean) return null;
  const results = await tcgdexFetch(`/sets?name=${encodeURIComponent(clean)}`);
  if (!Array.isArray(results) || results.length === 0) return null;
  const exact = results.find((s) => (s?.name || '').trim().toLowerCase() === clean.toLowerCase());
  const chosen = exact || results[0];
  return chosen?.id ? { id: chosen.id, name: chosen.name } : null;
}

// The brief card list for a set (id/localId/name/image — no variants,
// see module comment). Always fetched live, cached or not — this one
// call is cheap regardless of set size, unlike the per-card detail fetch
// below.
export async function fetchSetCards(setId) {
  const detail = await tcgdexFetch(`/sets/${encodeURIComponent(setId)}`);
  return Array.isArray(detail?.cards) ? detail.cards : [];
}

// Real per-card detail (including `variants`) for a batch of cards, at
// most `concurrency` in flight at once — a true concurrency limiter
// rather than firing every request in parallel, since the caller here
// can be either the narrow live path (a handful of cards, capped at
// MAX_DETAIL_FETCHES below) or the cache-building cron (every card in a
// whole set, 100-250+). An unbounded Promise.all was fine for the former
// but would've been a bad citizen — and a real Vercel function timeout
// risk — for the latter. Individual card failures are swallowed (best
// effort, same as the rest of this module) rather than failing the whole
// batch. Returns a Map<cardId, detail>.
export async function fetchDetailsForCards(cards, { concurrency = 8 } = {}) {
  const detailById = new Map();
  const queue = (cards || []).filter((c) => c?.id);
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const card = queue[next++];
      const detail = await tcgdexFetch(`/cards/${encodeURIComponent(card.id)}`).catch(() => null);
      if (detail) detailById.set(card.id, detail);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  return detailById;
}

// Which variant keys a given card actually has, per TCGdex's `variants`
// object on each card. Defensive: if the shape isn't what's expected
// (missing entirely, or not a plain object of booleans), falls back to
// "normal only" so the feature still works as a plain base-set
// checklist instead of breaking.
function variantKeysForCard(card) {
  const v = card?.variants;
  if (!v || typeof v !== 'object') return ['normal'];
  const present = KNOWN_VARIANTS.filter((kv) => v[kv.key] === true).map((kv) => kv.key);
  return present.length ? present : ['normal'];
}

function labelForVariant(key) {
  return KNOWN_VARIANTS.find((kv) => kv.key === key)?.label || 'Normal';
}

// Unions TCGdex's own reported variant keys with the caller's guessed
// hints for that same card (see the module comment above for why) — a
// print you've genuinely logged shows up even if TCGdex's own data
// hasn't caught up yet. Only known keys are ever added (an unrecognized
// hint is silently ignored, same defensive stance as variantKeysForCard).
function mergeVariantKeys(tcgdexKeys, hintKeys) {
  const known = new Set(KNOWN_VARIANTS.map((v) => v.key));
  const merged = new Set(tcgdexKeys);
  for (const key of hintKeys || []) {
    if (known.has(key)) merged.add(key);
  }
  const present = KNOWN_VARIANTS.filter((kv) => merged.has(kv.key)).map((kv) => kv.key);
  return present.length ? present : ['normal'];
}

// Hard cap on how many cards get a real per-card detail fetch on the
// narrow, no-cache live path — a safety backstop, not a normal-use limit
// (a real collection logging 25+ variant copies of different cards from
// one set is an extreme edge case). Doesn't apply to the cache-building
// path (fetchDetailsForCards is called directly there, uncapped, from a
// cron rather than a live request).
const MAX_DETAIL_FETCHES = 25;

// Builds the final SeriesGrid-shaped entries ({id, cover, label,
// rawTitle, number, matchKey}) from a set's brief card list plus
// whatever per-card detail is available — cached (every card, real
// variants throughout) or narrow-live (only hinted cards, everything
// else Normal-only). Pure/no fetching, so it's shared by both paths in
// getMasterSetEntries below. One entry per (card, variant) pair — a card
// with Normal + Reverse Holo prints produces two separate checkable
// entries, which is the actual definition of a "master set" versus a
// plain base-set list.
export function buildEntries(setName, cards, detailById, variantHints = []) {
  const hintsByNumber = new Map();
  for (const h of Array.isArray(variantHints) ? variantHints : []) {
    if (!h?.number || !h?.variant) continue;
    if (!hintsByNumber.has(h.number)) hintsByNumber.set(h.number, new Set());
    hintsByNumber.get(h.number).add(h.variant);
  }

  const entries = [];
  for (const card of cards) {
    const rawNumber = card?.localId != null ? String(card.localId) : '';
    if (!rawNumber) continue;
    // matchKey uses the normalized form so it lines up with
    // ownedKeysFor()'s trading_card branch (lib/seriesLookup.js), which
    // normalizes whatever the user actually typed into Card Number
    // ("4/102", "#4", "004", ...) the same way. The *display* label/number
    // keeps TCGdex's raw localId, since that's the real printed number
    // (e.g. a padded "004" is often how a set is actually numbered).
    const number = normalizeCardNumber(rawNumber);
    if (!number) continue;
    // Real detail (with actual variants) if it's cached or was worth a
    // live fetch; otherwise the brief — which variantKeysForCard()
    // correctly reads as "no variants object, so Normal only".
    const cardForVariants = (card?.id && detailById?.get(card.id)) || card;
    const variants = mergeVariantKeys(variantKeysForCard(cardForVariants), [...(hintsByNumber.get(number) || [])]);
    for (const variantKey of variants) {
      const variantLabel = labelForVariant(variantKey);
      entries.push({
        id: `${card.id}-${variantKey}`,
        cover: card.image ? `${card.image}/low.webp` : '',
        // Base "Normal" print keeps a plain "#4" label so a single-variant
        // set (most of them) doesn't look cluttered; multi-variant cards
        // spell out which print each tile is.
        label: variantKey === 'normal' && variants.length === 1 ? `#${rawNumber}` : `#${rawNumber} · ${variantLabel}`,
        rawTitle: card.name || '',
        number: rawNumber,
        matchKey: `${number}::${variantKey}`,
      });
    }
  }
  return entries;
}

// Returns { seriesName, entries, setId } — see module comment for the
// two ways a card's real variant detail can come from (cache vs. narrow
// live fetch).
//
// `variantHints` — array of { number, variant } pairs (see
// variantHintsFor in lib/seriesLookup.js): normalized card numbers the
// requester has logged a variant copy of within this set, each paired
// with a best-effort guess at which print. Always unioned into the final
// result regardless of cache state — see buildEntries.
//
// `cacheLoader`, if passed, is an async function(setId) => Map<cardId,
// detail-like-object> | null — kept as a generic callback rather than a
// direct Supabase import so this module stays DB-agnostic; the actual
// cache read (and the admin client it needs) lives in
// app/api/pokemon-master-set/route.js. Returning null/undefined (or
// throwing) is treated as "no cache", falling through to the narrow live
// path exactly as before this existed.
export async function getMasterSetEntries(setName, variantHints = [], cacheLoader = null) {
  const set = await findSetIdByName(setName);
  if (!set) return { error: 'no_series' };

  const cards = await fetchSetCards(set.id);
  if (!cards.length) return { error: 'no_series' };

  let detailById = null;
  if (cacheLoader) {
    try {
      detailById = await cacheLoader(set.id);
    } catch {
      detailById = null;
    }
  }

  if (!detailById) {
    const hintsByNumber = new Map();
    for (const h of Array.isArray(variantHints) ? variantHints : []) {
      if (!h?.number || !h?.variant) continue;
      if (!hintsByNumber.has(h.number)) hintsByNumber.set(h.number, new Set());
      hintsByNumber.get(h.number).add(h.variant);
    }
    const wanted = new Set([...hintsByNumber.keys()].slice(0, MAX_DETAIL_FETCHES));
    const targets = wanted.size
      ? cards.filter((c) => wanted.has(normalizeCardNumber(c?.localId != null ? String(c.localId) : '')))
      : [];
    detailById = targets.length ? await fetchDetailsForCards(targets) : new Map();
  }

  const entries = buildEntries(set.name, cards, detailById, variantHints);
  if (!entries.length) return { error: 'no_series' };
  return { seriesName: set.name, entries, setId: set.id };
}
