import { NextResponse } from 'next/server';
import { searchComicVine } from '@/lib/comicVineSearch';

// Thin client-facing wrapper GameModal's "Search" button calls for
// comics — the real Comic Vine query logic lives in
// lib/comicVineSearch.js, same split as /api/igdb-search + lib/igdbSearch.js.
//
// Backstop against the missing-timeout bug fixed in lib/comicVineSearch.js
// (Aug 2026, see CHANGELOG.md) — the real fetch-abort logic lives there.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const result = await searchComicVine(q);
  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ results: result.results });
}
