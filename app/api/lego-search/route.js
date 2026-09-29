import { NextResponse } from 'next/server';
import { searchRebrickable } from '@/lib/legoLookup';

// Thin client-facing wrapper GameModal's "Search" button calls for LEGO
// sets — the real Rebrickable query logic lives in lib/legoLookup.js,
// same split as /api/comic-search + lib/comicVineSearch.js.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const result = await searchRebrickable(q);
  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ results: result.results });
}
