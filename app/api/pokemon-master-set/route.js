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

  // TEMP DEBUG (see ROADMAP.md/CHANGELOG.md note — remove once the
  // "still the same" reverse-holo-tile report is root-caused): logs
  // straight to Vercel runtime logs so a real click-through can be
  // inspected without needing browser devtools access.
  console.log('[master-set debug] value=', JSON.stringify(value), 'variantNumbers=', JSON.stringify(variantNumbers));

  let result;
  try {
    result = await getMasterSetEntries(value, variantNumbers);
  } catch (e) {
    console.error('pokemon-master-set: lookup failed', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 502 });
  }

  if (result.error) {
    console.log('[master-set debug] error result=', result.error);
    const status = result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  console.log(
    '[master-set debug] seriesName=', result.seriesName,
    'entryCount=', result.entries?.length,
    'variantEntries=', JSON.stringify((result.entries || []).filter((e) => !e.label.endsWith('#' + e.number)).map((e) => e.label))
  );
  return NextResponse.json({ seriesName: result.seriesName, entries: result.entries });
}
