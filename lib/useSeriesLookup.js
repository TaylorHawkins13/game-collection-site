'use client';

import { useCallback, useState } from 'react';
import { normalizeSeriesResponse } from './seriesLookup';

// Shared fetch/state logic behind the "Series" feature — used by both
// GameModal (editing your own item) and SeriesModal (read-only, viewing
// anyone's profile). Games hit /api/igdb-franchise; trading cards try
// /api/pokemon-master-set first (a real per-set TCGdex checklist,
// including print variants — see lib/tcgdexSetLookup.js), then
// /api/mtg-master-set (a real per-set Scryfall checklist — see
// lib/scryfallSetLookup.js); comics hit /api/comic-master-set (a real
// per-series Comic Vine issue list — see lib/comicVineSeriesLookup.js);
// Funko Pops go straight to /api/series-lookup, the crowdsourced fallback
// used by anything that doesn't have a real canonical-data backend — see
// lib/seriesLookup.js for the full picture, and normalizeSeriesResponse
// for how the crowdsourced/IGDB/comic-master-set shapes all end up
// looking the same to the caller.
//
// There's no single field distinguishing which TCG a trading card is
// from (card_set is free-typed — "Foundations" is Magic, "Scarlet &
// Violet" is Pokémon, and nothing else on the row says which), so a
// trading card just tries both real backends in sequence rather than
// picking one up front: TCGdex first (originally the only one, kept
// first since Pokémon is this app's more common trading-card type),
// then Scryfall, then the crowdsourced fallback shared with Funko Pops.
// A genuine Pokémon card almost always resolves on the first try and
// never reaches Scryfall; a genuine Magic card resolves on the second.
// Only a card neither backend recognizes falls all the way through to
// the crowdsourced path.
//
// Fixed (Aug 2026 — reported live as some series "just don't show the
// whole series"): before Scryfall support existed, every trading card was
// sent to the Pokémon-only TCGdex endpoint regardless of which TCG it's
// actually from, so a Magic card's set name almost never matched
// anything there, and the lookup dead-ended with a Pokémon-specific
// "couldn't find a matching set" error even though ROADMAP.md's own
// "Magic master sets" note assumed Magic was still on the crowdsourced
// path (it wasn't — a genuine drift between what shipped and what got
// documented). That round added the crowdsourced retry below; this round
// adds the real Scryfall attempt in between, so a Magic card gets its own
// genuine master-set checklist instead of just Shelf Life's own
// crowdsourced data.
//
// The Pokémon and Magic master-set endpoints both return entries
// pre-shaped for SeriesGrid already (each needs its own shape to fan a
// card out into multiple variant/finish tiles) — comic-master-set and the
// crowdsourced fallback both flow through normalizeSeriesResponse
// instead.
export default function useSeriesLookup() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // `variantNumbers` (trading_card only) — normalized card numbers the
  // caller already owns a variant copy of within this set, from
  // lib/seriesLookup.js's variantCardNumbersFor. Passed to whichever
  // master-set backend actually resolves the set (TCGdex or Scryfall) so
  // it can fold in the requester's own logged variant/finish — see
  // lib/tcgdexSetLookup.js and lib/scryfallSetLookup.js.
  const load = useCallback(async (itemType, value, variantNumbers) => {
    const v = (value || '').trim();
    if (!v) {
      setError(itemType === 'game' ? 'No title to search.' : 'Fill in the set/series field first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const isTradingCard = itemType === 'trading_card';
      const isComicMasterSet = itemType === 'comic';
      const variantParam =
        isTradingCard && Array.isArray(variantNumbers) && variantNumbers.length
          ? `&variantNumbers=${encodeURIComponent(variantNumbers.join(','))}`
          : '';

      let json;
      let resolvedVia = null; // 'tcgdex' | 'scryfall' | null — which master-set backend actually answered, for setData below
      if (isTradingCard) {
        const tcgdexRes = await fetch(`/api/pokemon-master-set?value=${encodeURIComponent(v)}${variantParam}`);
        json = await tcgdexRes.json();
        if (json.error === 'no_series') {
          // Not a Pokémon set (or TCGdex just doesn't have it) — try the
          // real Magic backend before giving up. See the module comment
          // above for why trading cards try both in sequence.
          const scryfallRes = await fetch(`/api/mtg-master-set?value=${encodeURIComponent(v)}${variantParam}`);
          json = await scryfallRes.json();
          if (!json.error) resolvedVia = 'scryfall';
        } else if (!json.error) {
          resolvedVia = 'tcgdex';
        }
      } else if (itemType === 'game') {
        const res = await fetch(`/api/igdb-franchise?title=${encodeURIComponent(v)}`);
        json = await res.json();
      } else if (isComicMasterSet) {
        const res = await fetch(`/api/comic-master-set?value=${encodeURIComponent(v)}`);
        json = await res.json();
      } else {
        const res = await fetch(`/api/series-lookup?type=${itemType}&value=${encodeURIComponent(v)}`);
        json = await res.json();
      }

      // TCGdex+Scryfall (trading cards) and Comic Vine (comics) all only
      // cover what they cover. Any of them coming back `no_series` falls
      // through to the same crowdsourced backend Funko Pops use, instead
      // of just dead-ending here. See the module comment above.
      if (json.error === 'no_series' && (isTradingCard || isComicMasterSet)) {
        const fallbackRes = await fetch(`/api/series-lookup?type=${itemType}&value=${encodeURIComponent(v)}`);
        const fallbackJson = await fallbackRes.json();
        if (!fallbackJson.error) {
          setData(normalizeSeriesResponse(itemType, fallbackJson));
          return;
        }
        setError(
          isTradingCard
            ? "Couldn't find a matching set on TCGdex or Scryfall, and nobody on Shelf Life has logged anything else in this series yet either — this works best when the card was added via the trading-card Search button, so the set name matches exactly."
            : "Couldn't find a matching series on Comic Vine, and nobody on Shelf Life has logged anything else in this series yet either — this works best when the series name matches Comic Vine's own title closely (the comic Search button fills this in for you)."
        );
        return;
      }

      if (json.error === 'not_configured') {
        setError(
          isComicMasterSet
            ? 'Not available (no Comic Vine API key set on this site).'
            : 'Not available (no IGDB credentials set on this site).'
        );
      } else if (json.error === 'no_franchise') {
        setError("IGDB doesn't have this tagged as part of a series.");
      } else if (json.error === 'no_series') {
        setError('Nobody on Shelf Life has logged anything else in this series yet.');
      } else if (json.error) {
        setError('Could not load the series — try again in a bit.');
      } else if (isTradingCard && resolvedVia) {
        setData({ seriesName: json.seriesName, entries: json.entries });
      } else {
        setData(normalizeSeriesResponse(itemType, json));
      }
    } catch {
      setError('Could not load the series — check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError('');
    setLoading(false);
  }, []);

  return { data, loading, error, load, reset };
}
