import { NextResponse } from 'next/server';
import { getComicMasterSetEntries } from '@/lib/comicVineSeriesLookup';

// Real per-series issue lookup for comics — Comic Vine's volume/issues
// data instead of Shelf Life's own crowdsourced entries (see
// lib/comicVineSeriesLookup.js for the full reasoning). Mirrors
// /api/series-lookup's response shape exactly ({seriesName, entries:
// [{id, cover, number, title}]}) so lib/seriesLookup.js's existing
// normalizeSeriesResponse() handles both without any changes — this only
// replaces where the data comes from, not the shape the rest of the app
// already expects. Also mirrors /api/pokemon-master-set's error-code
// shape (no_series_value/no_series/query_failed/not_configured) so
// lib/useSeriesLookup.js can handle all three master-set-ish backends
// with the same small set of branches.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const value = (searchParams.get('value') || '').trim();
  if (!value) {
    return NextResponse.json({ error: 'no_series_value' }, { status: 400 });
  }

  let result;
  try {
    result = await getComicMasterSetEntries(value);
  } catch (e) {
    console.error('comic-master-set: lookup failed', e);
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
