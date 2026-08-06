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

async function searchMusicBrainz(q) {
  const res = await fetch(
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
