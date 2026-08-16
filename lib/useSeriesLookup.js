'use client';

import { useCallback, useState } from 'react';
import { normalizeSeriesResponse } from './seriesLookup';

// Shared fetch/state logic behind the "Series" feature — used by both
// GameModal (editing your own item) and SeriesModal (read-only, viewing
// anyone's profile). Games hit /api/igdb-franchise; trading cards hit
// /api/pokemon-master-set (a real per-set TCGdex checklist, including
// print variants — see lib/tcgdexSetLookup.js); comics/Funko Pops hit
// /api/series-lookup, the crowdsourced fallback used by everything that
// doesn't have a real canonical-data backend yet — see
// lib/seriesLookup.js for the full picture, and normalizeSeriesResponse
// for how the crowdsourced/IGDB shapes end up looking the same to the
// caller. The master-set endpoint already returns entries pre-shaped
// for SeriesGrid, so it skips normalizeSeriesResponse entirely.
export default function useSeriesLookup() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // `variantNumbers` (trading_card only) — normalized card numbers the
  // caller already owns a variant copy of within this set, from
  // lib/seriesLookup.js's variantCardNumbersFor. Tells
  // /api/pokemon-master-set which specific cards are worth a real
  // per-card TCGdex detail fetch — see lib/tcgdexSetLookup.js for why
  // that's targeted rather than fetched for the whole set.
  const load = useCallback(async (itemType, value, variantNumbers) => {
    const v = (value || '').trim();
    if (!v) {
      setError(itemType === 'game' ? 'No title to search.' : 'Fill in the set/series field first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const isMasterSet = itemType === 'trading_card';
      const variantParam =
        isMasterSet && Array.isArray(variantNumbers) && variantNumbers.length
          ? `&variantNumbers=${encodeURIComponent(variantNumbers.join(','))}`
          : '';
      const url = isMasterSet
        ? `/api/pokemon-master-set?value=${encodeURIComponent(v)}${variantParam}`
        : itemType === 'game'
          ? `/api/igdb-franchise?title=${encodeURIComponent(v)}`
          : `/api/series-lookup?type=${itemType}&value=${encodeURIComponent(v)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error === 'not_configured') {
        setError('Not available (no IGDB credentials set on this site).');
      } else if (json.error === 'no_franchise') {
        setError("IGDB doesn't have this tagged as part of a series.");
      } else if (json.error === 'no_series' && isMasterSet) {
        setError("Couldn't find a matching Pokémon set on TCGdex — this works best when the card was added via the trading-card Search button, so the set name matches exactly.");
      } else if (json.error === 'no_series') {
        setError('Nobody on Shelf Life has logged anything else in this series yet.');
      } else if (json.error) {
        setError('Could not load the series — try again in a bit.');
      } else if (isMasterSet) {
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
