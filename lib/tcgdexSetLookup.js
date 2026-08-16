// The trading-card "master set" backend — Pokémon only for now (Magic's
// on ROADMAP.md). Unlike lib/seriesCrowdsource.js's generic comic/card/
// Funko Pop "series" feature (which can only know about numbers other
// Shelf Life users happen to have logged), this hits TCGdex's real
// per-set data, including which print variants (Normal, Reverse Holo,
// Holo, 1st Edition, etc.) actually exist for each card — a genuine
// master-set checklist, not a guess built from whatever's already in
// the database.
//
// Same sandbox caveat as every other TCGdex integration in this repo
// (see app/api/card-search/route.js): TCGdex's API is outside this
// sandbox's network allowlist, so none of this could be exercised
// against live data while building it. The shapes below match TCGdex's
// documented schema as closely as possible, but every external call is
// written defensively (try/catch, type-checked before use) so a shape
// mismatch degrades to "fewer variants than it should" rather than a
// hard failure — worth a real click-through once deployed.

import { normalizeCardNumber } from './seriesLookup';

const KNOWN_VARIANTS = [
  { key: 'normal', label: 'Normal' },
  { key: 'reverse', label: 'Reverse Holo' },
  { key: 'holo', label: 'Holo' },
  { key: 'firstEdition', label: '1st Edition' },
  { key: 'wPromo', label: 'W Promo' },
];

async function tcgdexFetch(path) {
  const res = await fetch(`https://api.tcgdex.net/v2/en${path}`, { headers: { Accept: 'application/json' } });
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

// Returns { seriesName, entries } already shaped for SeriesGrid
// ({id, cover, label, matchKey}) plus a plain `number`/`rawTitle` on
// each entry so prefillFromSeriesEntry() (lib/seriesLookup.js) still
// works for a missing-entry click-through, same as the crowdsourced
// path. One entry per (card, variant) pair — a card with Normal +
// Reverse Holo prints produces two separate checkable entries, which is
// the actual definition of a "master set" versus a plain base-set list.
export async function getMasterSetEntries(setName) {
  const set = await findSetIdByName(setName);
  if (!set) return { error: 'no_series' };

  const detail = await tcgdexFetch(`/sets/${encodeURIComponent(set.id)}`);
  const cards = Array.isArray(detail?.cards) ? detail.cards : [];
  if (!cards.length) return { error: 'no_series' };

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
    const variants = variantKeysForCard(card);
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
