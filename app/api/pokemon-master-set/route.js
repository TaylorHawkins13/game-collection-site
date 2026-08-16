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
  // Which cards (already normalized client-side — see
  // lib/seriesLookup.js's variantHintsFor) the requester has actually
  // logged a variant copy of, each as "number:guessedVariant" (e.g.
  // "71:reverse"). Two jobs: (1) tells getMasterSetEntries which cards
  // are worth a real per-card TCGdex detail fetch (targeted, not every
  // card in the set — see lib/tcgdexSetLookup.js), and (2) the guessed
  // variant itself gets unioned with whatever TCGdex reports, so a print
  // you've genuinely logged still shows up even when TCGdex's own
  // variants data hasn't caught up yet (real gap for very recently
  // released sets — confirmed via debug logging against "Chaos Rising":
  // TCGdex reported reverse:false for a card a real reverse holo copy
  // had already been logged for).
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
    result = await getMasterSetEntries(value, variantHints);
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
