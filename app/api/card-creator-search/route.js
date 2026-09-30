import { NextResponse } from 'next/server';
import { searchCardArtists } from '@/lib/cardArtistLookup';

// Backs the typeahead on /creator/cards — deliberately public, no
// sign-in required, same as /api/comic-creator-search: Creator pages are
// meant to work signed out too, per ROADMAP.md's "Creator/contributor
// pages" entry. No API key needed either (Scryfall and TCGdex are both
// fully public/keyless), so unlike comic-creator-search's not_configured
// path, a failure here means the catalogs themselves couldn't be reached.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  const result = await searchCardArtists(query);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ items: result.items });
}
