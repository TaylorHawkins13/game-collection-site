import { NextResponse } from 'next/server';
import { searchCompanies } from '@/lib/igdbCompanyLookup';

// Backs the typeahead on /creator/games — deliberately public, no
// sign-in required, same as /api/comic-creator-search: Creator pages are
// meant to work signed out too, per ROADMAP.md's "Creator/contributor
// pages" entry and Taylor's own call on public vs. dashboard-gated for
// this feature.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  const result = await searchCompanies(query);
  if (result.error) {
    const status = result.error === 'not_configured' ? 500 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ items: result.items });
}
