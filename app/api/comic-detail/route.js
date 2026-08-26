import { NextResponse } from 'next/server';
import { getComicVineIssueDetail } from '@/lib/comicVineSearch';

// Second-step lookup fired once someone actually picks a comic-search
// result — writer/artist credits and publisher live one level deeper
// than the initial search response (see lib/comicVineSearch.js), so
// they're fetched on demand instead of for every row in the list.
//
// Backstop against the missing-timeout bug fixed in lib/comicVineSearch.js
// (Aug 2026, see CHANGELOG.md) — the real fetch-abort logic lives there.
// This route can fire two sequential fetches (issue, then volume), so the
// explicit maxDuration matters more here than on a single-fetch route.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const result = await getComicVineIssueDetail(id);
  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
