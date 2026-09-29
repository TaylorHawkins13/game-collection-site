import { NextResponse } from 'next/server';
import { fetchLegoMinifigs } from '@/lib/legoLookup';

// Thin client-facing wrapper GameModal's lego apply-result step calls once
// a search result is actually picked — the real Rebrickable minifigs
// lookup lives in lib/legoLookup.js, same split as
// /api/lego-search + searchRebrickable and /api/comic-detail +
// lib/comicVineSearch.js's two-step search-then-detail pattern.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const setNum = searchParams.get('setNum') || '';
  const result = await fetchLegoMinifigs(setNum);
  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ minifigs: result.minifigs });
}
