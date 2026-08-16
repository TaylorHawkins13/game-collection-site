import { NextResponse } from 'next/server';
import { getMasterSetEntries } from '@/lib/tcgdexSetLookup';

// Trading-card "master set" completion — Pokémon only for now, see
// lib/tcgdexSetLookup.js for the full reasoning. Mirrors
// /api/series-lookup's error-code shape (no_series_value/no_series/
// query_failed) so lib/useSeriesLookup.js can handle both the same way.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const value = (searchParams.get('value') || '').trim();
  if (!value) {
    return NextResponse.json({ error: 'no_series_value' }, { status: 400 });
  }
  // Which card numbers (already normalized client-side — see
  // lib/seriesLookup.js's variantCardNumbersFor) actually need a real
  // per-card variant fetch. See lib/tcgdexSetLookup.js for why this is
  // targeted rather than every card in the set.
  const variantNumbers = (searchParams.get('variantNumbers') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let result;
  try {
    result = await getMasterSetEntries(value, variantNumbers);
  } catch (e) {
    console.error('pokemon-master-set: lookup failed', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 502 });
  }

  if (result.error) {
    const status = result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ seriesName: result.seriesName, entries: result.entries });
}
