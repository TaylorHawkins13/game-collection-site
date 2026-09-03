import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { getDiscogsCollection } from '@/lib/discogsImport';

// Returns a Discogs member's public collection ("Import from Discogs" —
// see lib/discogsImport.js for the full reasoning), for
// DiscogsImportModal to show as a picklist. Requires sign-in (same as
// /api/steam-games) so this can't be used as an open Discogs proxy, even
// though — unlike Steam — the actual data being fetched isn't scoped to
// the signed-in user at all; anyone can type in any public Discogs
// username, same as anyone can browse discogs.com/user/<name> in a
// regular browser.
export const maxDuration = 60;

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username') || '';

  const result = await getDiscogsCollection(username);
  if (result.error) {
    const status = result.error === 'not_found' ? 404 : result.error === 'not_configured' ? 500 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ items: result.items });
}
