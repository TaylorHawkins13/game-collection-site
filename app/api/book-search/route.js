import { NextResponse } from 'next/server';

// Book title auto-fill via Open Library's free search API — no key, no
// signup, same source barcode scanning already uses (openlibrary.org),
// just extended from ISBN lookup to a plain title search so it works
// when you don't have the physical barcode in hand.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,first_publish_year,cover_i,publisher`,
      { headers: { 'User-Agent': 'ShelfLifeApp/1.0 (collection tracker; contact via app)' } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'search_failed' }, { status: 500 });
    }
    const data = await res.json();
    const results = (data.docs || []).map((doc) => ({
      kind: 'book',
      id: doc.key,
      name: doc.title,
      cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
      creator: (doc.author_name || []).join(', '),
      publisher: (doc.publisher || [])[0] || '',
      year: doc.first_publish_year || null,
      subtitle: [(doc.author_name || [])[0], doc.first_publish_year].filter(Boolean).join(' · '),
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
