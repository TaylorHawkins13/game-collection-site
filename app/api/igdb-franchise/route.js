import { NextResponse } from 'next/server';
import { getFranchiseGames } from '@/lib/igdbSearch';

// Backs the "Series" section in GameModal — given a game title already in
// someone's collection, returns every other game IGDB has tagged under
// the same franchise, so the modal can show what's owned vs. missing.
// Thin wrapper for the same reason /api/igdb-search is: keeps the Twitch
// client secret server-side only.
//
// Backstop against the missing-timeout bug fixed in lib/igdbSearch.js
// (Aug 2026, see CHANGELOG.md) — the real fetch-abort logic lives there.
// This route in particular can fire several fetches per request (the
// initial search, one per franchise tag, one per collection tag), so the
// explicit maxDuration matters more here than on a single-fetch route.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || '';
  const result = await getFranchiseGames(title);
  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'no_franchise' ? 404 : 502 });
  }
  return NextResponse.json({ franchiseName: result.franchiseName, games: result.games });
}
