import { NextResponse } from 'next/server';

// Vinyl/CD auto-fill via MusicBrainz (musicbrainz.org) — free, no key or
// signup required, unlike ComicVine/TMDb which would need one. MusicBrainz
// asks that every request carry an identifying User-Agent; that's the only
// real requirement for using it.
//
// Deliberately doesn't try to fill in cover art — the Cover Art Archive
// (coverartarchive.org) only has art for a fraction of releases, and
// checking per-result would mean an extra fetch for every one of the up
// to 8 candidates just to find out most don't have any. Title/artist/
// label/format is enough to be worth the "Search" button existing;
// cover art (like console search) stays a manual paste.
//
// Fixed (Aug 2026 — same missing-timeout bug already fixed in seven other
// routes, see CHANGELOG.md): the fetch below had nothing capping how long
// a slow MusicBrainz response could hang the request, so a slow patch on
// their end could stall this route until Vercel's platform-level 300s
// ceiling killed it. Now aborts after 8 seconds, and maxDuration below is
// an explicit backstop.
export const maxDuration = 20;

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchMusicBrainz(q) {
  const res = await fetchWithTimeout(
    `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(q)}&fmt=json&limit=8`,
    { headers: { 'User-Agent': 'ShelfLifeApp/1.0 (https://shelflife.site)', Accept: 'application/json' } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.releases || []).map((r) => {
    const artist = (r['artist-credit'] || []).map((a) => a.name).join(', ');
    const label = (r['label-info'] || []).map((l) => l.label?.name).filter(Boolean).join(', ');
    const format = r.media?.[0]?.format || '';
    const year = r.date ? r.date.slice(0, 4) : null;
    return {
      kind: 'music',
      id: r.id,
      name: r.title,
      artist,
      label,
      format,
      year,
      subtitle: [artist, format, year].filter(Boolean).join(' · '),
    };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchMusicBrainz(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
