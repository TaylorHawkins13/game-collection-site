import { NextResponse } from 'next/server';
import { getPlatformCatalogue, debugCatalogueQueries } from '@/lib/igdbPlatformCatalogue';

// TEMPORARY — a long, specific value so this can't be hit by accident;
// gates lib/igdbPlatformCatalogue.js's debugCatalogueQueries, used to
// confirm the real cause of ROADMAP.md's "full release catalogue always
// empty" bug against IGDB's live API without another deploy-and-wait
// round trip. Remove alongside that function once the real fix ships.
const DEBUG_KEY = 'shelf-life-catalogue-debug-2026-09';

// Backs the "Full physical-release catalogue" page
// (app/dashboard/catalogue) — a thin client-facing wrapper over
// lib/igdbPlatformCatalogue.js, same pattern as /api/igdb-search and
// /api/igdb-franchise (keeps the Twitch client secret server-side only).
//
// Backstop against the missing-timeout bug already fixed across every
// other IGDB/external-API route (see CHANGELOG.md) — the real
// fetch-abort logic lives in lib/igdbSearch.js's fetchWithTimeout, shared
// by lib/igdbPlatformCatalogue.js.
export const maxDuration = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || '';
  const search = searchParams.get('search') || '';
  const offset = parseInt(searchParams.get('offset'), 10) || 0;
  const limit = parseInt(searchParams.get('limit'), 10) || undefined;

  if (searchParams.get('debug') === DEBUG_KEY) {
    const debugResult = await debugCatalogueQueries(platform);
    return NextResponse.json(debugResult);
  }

  const result = await getPlatformCatalogue({ platform, offset, limit, search });

  if (result.error === 'not_configured') {
    return NextResponse.json({ error: 'not_configured' });
  }
  if (result.error === 'platform_not_found') {
    return NextResponse.json({ error: 'platform_not_found' }, { status: 404 });
  }
  if (result.error === 'no_platform') {
    return NextResponse.json({ error: 'no_platform' }, { status: 400 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({
    platformName: result.platformName,
    platformId: result.platformId,
    games: result.games,
    hasMore: result.hasMore,
  });
}
