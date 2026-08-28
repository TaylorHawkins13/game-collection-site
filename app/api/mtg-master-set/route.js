import { NextResponse } from 'next/server';
import { getMtgMasterSetEntries } from '@/lib/scryfallSetLookup';

// Trading-card "master set" completion for Magic: The Gathering, via
// Scryfall — see lib/scryfallSetLookup.js for the full reasoning. Mirrors
// /api/pokemon-master-set's request/response shape (same error codes:
// no_series_value/no_series/query_failed) so lib/useSeriesLookup.js can
// try both the same way — a trading card tries TCGdex first (Pokémon),
// and only reaches this route on a TCGdex `no_series` (see that file).

// No caching/precompute concern here the way the Pokémon route has —
// Scryfall returns full variant (finish) data for an entire set in 1-2
// requests, not one fetch per card, so a live request comfortably fits
// well inside this budget. See lib/scryfallSetLookup.js's module comment.
export const maxDuration = 15;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const value = (searchParams.get('value') || '').trim();
  if (!value) {
    return NextResponse.json({ error: 'no_series_value' }, { status: 400 });
  }
  // Same shape/meaning as /api/pokemon-master-set's variantNumbers — see
  // that route's comment. Here it only ever adds a foil/etched tile a
  // genuinely-logged card deserves even if Scryfall's own `finishes` data
  // is somehow incomplete for that printing; it never gates an extra
  // fetch the way it does for TCGdex.
  const variantHints = (searchParams.get('variantNumbers') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [number, variant] = s.split(':');
      return { number: (number || '').trim(), variant: (variant || '').trim() };
    })
    .filter((h) => h.number && h.variant);

  let result;
  try {
    result = await getMtgMasterSetEntries(value, variantHints);
  } catch (e) {
    console.error('mtg-master-set: lookup failed', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 502 });
  }

  if (result.error) {
    const status = result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ seriesName: result.seriesName, entries: result.entries });
}
