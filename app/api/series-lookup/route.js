import { NextResponse } from 'next/server';
import { getCrowdsourcedSeries } from '@/lib/seriesCrowdsource';

// The comic/trading_card/funko_pop counterpart to /api/igdb-franchise —
// see lib/seriesCrowdsource.js for why these three use Shelf Life's own
// logged data instead of an external database.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const value = searchParams.get('value') || '';
  const result = await getCrowdsourcedSeries(type, value);
  if (result.error) {
    const status = result.error === 'unsupported_type' || result.error === 'no_series_value' ? 400 : result.error === 'no_series' ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ seriesName: result.seriesName, numberLabel: result.numberLabel, entries: result.entries });
}
