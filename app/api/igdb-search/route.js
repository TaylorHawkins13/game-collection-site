import { NextResponse } from 'next/server';
import { searchIgdb } from '@/lib/igdbSearch';

// The token exchange and IGDB query themselves live in lib/igdbSearch.js
// (shared with the collectible detail page's server-side fallback lookup
// for titles nobody's added yet) — this route is just the thin
// client-facing wrapper GameModal's "Search" button and the players
// search page call over HTTP.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const result = await searchIgdb(q);
  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ results: result.results });
}
