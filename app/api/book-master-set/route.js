import { NextResponse } from 'next/server';
import { getAuthorBibliography } from '@/lib/openLibraryAuthorLookup';

// Real per-author bibliography lookup for Books — Open Library's author/
// works data instead of Shelf Life's own crowdsourced entries (see
// lib/openLibraryAuthorLookup.js for the full reasoning). Mirrors
// /api/series-lookup's response shape exactly ({seriesName, entries:
// [{id, cover, title}]}) so lib/seriesLookup.js's existing
// normalizeSeriesResponse() handles it without any changes — this only
// replaces where the data comes from, not the shape the rest of the app
// already expects. Also mirrors /api/comic-master-set's error-code shape
// (no_series_value/no_series/query_failed) so lib/useSeriesLookup.js
// handles all the master-set-ish backends with the same small set of
// branches.
//
// No `not_configured` case and no maxDuration override the way Comic
// Vine/TCGdex need — Open Library is a fully public, keyless API, and
// this is two fixed calls (search authors, then that author's works),
// not comic-master-set's open-ended, time-budgeted pagination loop, so
// it comfortably finishes within the platform default.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const value = (searchParams.get('value') || '').trim();
  if (!value) {
    return NextResponse.json({ error: 'no_series_value' }, { status: 400 });
  }

  let result;
  try {
    result = await getAuthorBibliography(value);
  } catch (e) {
    console.error('book-master-set: lookup failed', e);
    return NextResponse.json({ error: 'query_failed' }, { status: 502 });
  }

  if (result.error) {
    const status = result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ seriesName: result.seriesName, entries: result.entries });
}
