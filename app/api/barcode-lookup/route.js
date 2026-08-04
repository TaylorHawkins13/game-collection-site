import { NextResponse } from 'next/server';

// Looks up product info for a scanned barcode. Barcodes themselves are
// just numbers — there's no title/cover baked into them — so this calls
// out to a couple of free, no-key-required lookup services:
//
// - Open Library (openlibrary.org): for books, keyed by ISBN. Most book
//   barcodes are EAN-13 codes starting with 978/979, which IS the ISBN-13.
// - UPCitemdb (upcitemdb.com): a general retail UPC/EAN database, used
//   for everything else (games, DVDs, CDs, vinyl). Free tier is limited
//   (100 lookups/day, 6/min) and coverage is best-effort — not every
//   barcode will be in it.

function isLikelyIsbn(code) {
  const digits = (code || '').replace(/[^0-9Xx]/g, '');
  return digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'));
}

async function lookupOpenLibrary(code) {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(code)}&format=json&jscmd=data`,
    { headers: { 'User-Agent': 'ShelfLifeApp/1.0 (collection tracker; contact via app)' } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const entry = data[`ISBN:${code}`];
  if (!entry) return null;
  return {
    found: true,
    source: 'openlibrary',
    title: entry.title || '',
    cover: entry.cover?.large || entry.cover?.medium || '',
    creator: (entry.authors || []).map((a) => a.name).join(', '),
    publisher: (entry.publishers || []).map((p) => p.name).join(', '),
    genre: (entry.subjects || []).slice(0, 2).map((s) => s.name).join(', '),
  };
}

// UPCitemdb's "category" is a taxonomy path like "Media > Books & Magazines
// > Books" or "Toys & Games > Games > Video Games". There's no dedicated
// genre field, so the last, most specific segment of that path is the
// closest available stand-in — better than leaving genre blank.
function genreFromCategory(category) {
  if (!category) return '';
  const parts = category.split('>').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

async function lookupUpcItemDb(code) {
  const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const item = (data.items || [])[0];
  if (!item) return null;
  return {
    found: true,
    source: 'upcitemdb',
    title: item.title || '',
    cover: (item.images || [])[0] || '',
    creator: '',
    publisher: item.brand || '',
    genre: genreFromCategory(item.category),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') || '').trim();
  const type = (searchParams.get('type') || '').trim();

  if (!code) {
    return NextResponse.json({ found: false });
  }

  try {
    // Books: try Open Library first when it looks like an ISBN, since
    // it's more reliable for books than the general UPC database.
    if (type === 'book' || isLikelyIsbn(code)) {
      const ol = await lookupOpenLibrary(code).catch(() => null);
      if (ol) return NextResponse.json(ol);
    }

    const upc = await lookupUpcItemDb(code).catch(() => null);
    if (upc) return NextResponse.json(upc);

    return NextResponse.json({ found: false });
  } catch {
    return NextResponse.json({ found: false, error: 'lookup_failed' }, { status: 500 });
  }
}
