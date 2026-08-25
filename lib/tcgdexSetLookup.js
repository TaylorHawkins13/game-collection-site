// The trading-card "master set" backend — Pokémon only for now (Magic's
// on ROADMAP.md). Unlike lib/seriesCrowdsource.js's generic comic/card/
// Funko Pop "series" feature (which can only know about numbers other
// Shelf Life users happen to have logged), this hits TCGdex's real
// per-set data, including which print variants (Normal, Reverse Holo,
// Holo, 1st Edition, etc.) actually exist for each card — a genuine
// master-set checklist, not a guess built from whatever's already in
// the database.
//
// Confirmed against TCGdex's own docs (tcgdex.dev/reference/card-brief,
// tcgdex.dev/rest/set) after the first version of this shipped with a
// real bug: the per-set card list (`GET /sets/{id}`) only ever returns
// the "brief" shape — id/localId/name/image, no variants — regardless
// of the card. `variants` (normal/reverse/holo/firstEdition/wPromo)
// only exists on a single card's own detail endpoint
// (`GET /cards/{id}`), one fetch per card. There's no bulk "give me
// variants for this whole set" endpoint.
//
// Fetching full detail for every card in a set to get real variant data
// isn't viable here: real Pokémon sets commonly run 100-250+ cards, and
// firing that many parallel requests on every single "See master set"
// click risks both running past a Vercel function's execution timeout
// and being a genuinely bad citizen against a free, community-run API.
// So this only spends the extra per-card fetch on cards the requester
// has actually logged a variant copy of (passed in from the caller's
// own collection — see lib/seriesLookup.js's variantHintsFor and its use
// in GameModal/ItemDetailModal/SeriesModal) — everything else stays a
// single "Normal" tile. That means a card you haven't logged an extra
// print of yet won't show *its* other real-world variants until you do
// log one — this works as "confirm the different prints I already
// have," not yet "discover every variant this set actually offers."
//
// One more real gap, found by debug-logging a live request against a
// brand-new set ("Chaos Rising," days-old at the time): TCGdex is a
// community-maintained database, and a set that new can have cards whose
// `variants` object is present but not actually filled in yet — every
// key reported false, including for a print that demonstrably exists
// (the requester had a real reverse holo copy logged). Trusting TCGdex
// alone there would permanently hide a print you know you own until
// someone else finishes cataloguing that card. So the variant keys
// actually rendered are the union of what TCGdex reports AND the
// caller's own guessed hints (see variantHintsFor) — your own logged
// copy always gets a tile, TCGdex fills in anything else it already
// knows about.

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

// Hard cap on how many cards get a real per-card detail fetch per
// request, regardless of what the caller sends — a safety backstop, not
// a normal-use limit (a real collection logging 25+ variant copies of
// different cards from one set is an extreme edge case).
const MAX_DETAIL_FETCHES = 25;

// Returns { seriesName, entries } already shaped for SeriesGrid
// ({id, cover, label, matchKey}) plus a plain `number`/`rawTitle` on
// each entry so prefillFromSeriesEntry() (lib/seriesLookup.js) still
// works for a missing-entry click-through, same as the crowdsourced
// path. One entry per (card, variant) pair — a card with Normal +
// Reverse Holo prints produces two separate checkable entries, which is
// the actual definition of a "master set" versus a plain base-set list.
//
// `variantHints` — array of { number, variant } pairs (see
// variantHintsFor in lib/seriesLookup.js): normalized card numbers the
// requester has logged a variant copy of within this set, each paired
// with a best-effort guess at which print. Cards with a hint get a real
// per-card detail fetch (so TCGdex's own data can fill in anything the
// guess didn't catch, like a card that turns out to also have a 1st
// Edition print); everything else renders as a single Normal tile. The
// guessed variant itself always gets included in that card's tiles even
// if TCGdex's fetched detail disagrees — see the module comment above.
export async function getMasterSetEntries(setName, variantHints = []) {
  const set = await findSetIdByName(setName);
  if (!set) return { error: 'no_series' };

  const detail = await tcgdexFetch(`/sets/${encodeURIComponent(set.id)}`);
  const cards = Array.isArray(detail?.cards) ? detail.cards : [];
  if (!cards.length) return { error: 'no_series' };

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
  const detailResults = await Promise.all(
    targets.map((c) => (c?.id ? tcgdexFetch(`/cards/${encodeURIComponent(c.id)}`).catch(() => null) : null))
  );
  const detailById = new Map();
  targets.forEach((c, i) => {
    if (c?.id && detailResults[i]) detailById.set(c.id, detailResults[i]);
  });

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
    // Real detail (with actual variants) if this card was worth
    // fetching; otherwise the brief — which variantKeysForCard()
    // correctly reads as "no variants object, so Normal only".
    const cardForVariants = (card?.id && detailById.get(card.id)) || card;
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

  if (!entries.length) return { error: 'no_series' };
  return { seriesName: set.name, entries };
}
