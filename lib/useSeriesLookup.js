'use client';

import { useCallback, useState } from 'react';
import { normalizeSeriesResponse } from './seriesLookup';

// Shared fetch/state logic behind the "Series" feature — used by both
// GameModal (editing your own item) and SeriesModal (read-only, viewing
// anyone's profile). Games hit /api/igdb-franchise; comics/trading
// cards/Funko Pops hit /api/series-lookup — see lib/seriesLookup.js for
// why the split, and normalizeSeriesResponse for how the two different
// response shapes end up looking the same to the caller.
export default function useSeriesLookup() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (itemType, value) => {
    const v = (value || '').trim();
    if (!v) {
      setError(itemType === 'game' ? 'No title to search.' : 'Fill in the set/series field first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url =
        itemType === 'game'
          ? `/api/igdb-franchise?title=${encodeURIComponent(v)}`
          : `/api/series-lookup?type=${itemType}&value=${encodeURIComponent(v)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error === 'not_configured') {
        setError('Not available (no IGDB credentials set on this site).');
      } else if (json.error === 'no_franchise') {
        setError("IGDB doesn't have this tagged as part of a series.");
      } else if (json.error === 'no_series') {
        setError('Nobody on Shelf Life has logged anything else in this series yet.');
      } else if (json.error) {
        setError('Could not load the series — try again in a bit.');
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
