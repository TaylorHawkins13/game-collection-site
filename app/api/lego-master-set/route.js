import { NextResponse } from 'next/server';
import { getLegoMasterSetEntries } from '@/lib/legoLookup';

// Real per-theme set list for LEGO — Rebrickable's live set database
// instead of Shelf Life's own crowdsourced entries (see
// lib/legoLookup.js's getLegoMasterSetEntries for the full reasoning).
// Mirrors /api/comic-master-set's response shape exactly ({seriesName,
// entries: [{id, cover, number, title}]}) so lib/seriesLookup.js's
// existing normalizeSeriesResponse() handles this without any changes,
// and mirrors its error-code shape (no_series_value/no_series/
// query_failed/not_configured) so lib/useSeriesLookup.js can handle every
// master-set-ish backend with the same small set of branches.
//
// A theme's set count is normally well under Rebrickable's own 1000-per-
// page ceiling (getLegoMasterSetEntries's LEGO_PAGE_SIZE), so this rarely
// needs more than one request — raised above the platform default anyway
// to give a genuinely huge theme (Star Wars, City) real headroom, same
// spirit as /api/comic-master-set's maxDuration.
export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const value = (searchParams.get('value') || '').trim();
  if (!value) {
    return NextResponse.json({ error: 'no_series_value' }, { status: 400 });
  }

  let result;
  try {
    result = await getLegoMasterSetEntries(value);
  } catch (e) {
    console.error('lego-master-set: lookup failed', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 502 });
  }

  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    const status = result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ seriesName: result.seriesName, entries: result.entries });
}
