import { NextResponse } from 'next/server';

// DVD/Blu-ray/VHS auto-fill via Apple's iTunes Search API — free, no key
// or signup required, same "no gatekeeping" bar as Open Library (books)
// and MusicBrainz (vinyl/CD). The roadmap originally assumed this would
// need TMDb (which does require a free account + API key); iTunes covers
// the same ground — title, cover art, genre, year, studio — without it.
//
// artistName is unreliable for movies (sometimes the director, sometimes
// blank, sometimes something else entirely depending on how the studio
// submitted it), so it's passed through as a best-effort "creator" guess
// rather than trusted — same spirit as music-search skipping cover art
// it can't verify. copyright ("© 2015 Studio Name") is a much more
// consistent source for the studio/publisher field.
//
// Fixed (Aug 2026 — same missing-timeout bug already fixed in seven other
// routes, see CHANGELOG.md): the fetch below had nothing capping how long
// a slow iTunes response could hang the request, so a slow patch on
// Apple's end could stall this route until Vercel's platform-level 300s
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

function studioFromCopyright(copyright) {
  if (!copyright) return '';
  // Strip a leading "© 1993" / "(P) 2001" style year stamp, keep the rest.
  return copyright.replace(/^[©(P)]*\s*\d{4}\s*/i, '').trim();
}

function higherResArtwork(url) {
  if (!url) return '';
  return url.replace(/\d+x\d+bb(\.(jpg|png))?$/, '600x600bb$1');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetchWithTimeout(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=movie&entity=movie&limit=8`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'search_failed' }, { status: 500 });
    }
    const data = await res.json();
    const results = (data.results || []).map((r) => {
      const year = r.releaseDate ? r.releaseDate.slice(0, 4) : null;
      const studio = studioFromCopyright(r.copyright);
      return {
        kind: 'movie',
        id: r.trackId,
        name: r.trackName,
        cover: higherResArtwork(r.artworkUrl100),
        creator: r.artistName || '',
        publisher: studio,
        genre: r.primaryGenreName || '',
        year,
        subtitle: [studio, year].filter(Boolean).join(' · '),
      };
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
