import { NextResponse } from 'next/server';
import { getFranchiseGames } from '@/lib/igdbSearch';

// Backs the "Series" section in GameModal — given a game title already in
// someone's collection, returns every other game IGDB has tagged under
// the same franchise, so the modal can show what's owned vs. missing.
// Thin wrapper for the same reason /api/igdb-search is: keeps the Twitch
// client secret server-side only.
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
