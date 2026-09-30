import { cache } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { getAuthorBibliography } from '@/lib/openLibraryAuthorLookup';
import { normalizeSeriesResponse, ownedKeysFor } from '@/lib/seriesLookup';
import BookCreatorPageClient from './BookCreatorPageClient';

// Wrapped in cache() so generateMetadata and the page body below share
// one real Open Library lookup instead of two — same reasoning
// app/creator/comics/[id]/page.js's getWorksCached already uses. This one
// genuinely costs two real Open Library requests (search authors, then
// that author's works — see lib/openLibraryAuthorLookup.js).
//
// `name` does NOT arrive pre-decoded — verified live, the hard way: this
// comment used to claim Next.js decodes dynamic-segment params itself, but
// a real production test (via the same-shaped app/creator/cards/[game]/
// [name]/page.js, which shares this exact assumption) showed the raw
// segment still had its literal `%20`s, so every author name containing a
// space — i.e. almost every author name — silently 404'd here too. Decode
// once, explicitly, rather than trust the framework to have done it.
const getBibliographyCached = cache((name) => getAuthorBibliography(decodeURIComponent(name)));

export async function generateMetadata({ params }) {
  const { name } = await params;
  const result = await getBibliographyCached(name);
  if (result.error) {
    return { title: 'Author not found', robots: { index: false } };
  }
  const count = result.entries.length;
  const description = count
    ? `Browse ${result.seriesName}'s books on Shelf Life — ${count} title${count === 1 ? '' : 's'} on file, greyed out except what you already own.`
    : `Browse ${result.seriesName}'s books on Shelf Life.`;
  return {
    title: `${result.seriesName} — Books`,
    description,
    openGraph: { title: `${result.seriesName}'s books on Shelf Life`, description },
  };
}

export default async function BookCreatorPage({ params }) {
  const { name } = await params;
  const supabase = await createClient();

  const [result, { data: { user } }] = await Promise.all([
    getBibliographyCached(name),
    supabase.auth.getUser(),
  ]);

  let ownedKeys = [];
  let currency;
  if (user) {
    const [{ data: ownBooks }, { data: profile }] = await Promise.all([
      supabase.from('games').select('title, ownership, item_type').eq('user_id', user.id).eq('item_type', 'book'),
      supabase.from('profiles').select('currency').eq('id', user.id).maybeSingle(),
    ]);
    // Same key shape (normalized title) the plain in-item "See full
    // series" flow already uses for Books — ownedKeysFor's generic
    // creator-field branch (lib/seriesLookup.js), reused as-is.
    ownedKeys = [...ownedKeysFor(ownBooks || [], 'book')];
    currency = profile?.currency;
  }

  // normalizeSeriesResponse's non-game branch is a direct fit for
  // getAuthorBibliography's own return shape ({seriesName, entries:
  // [{id, cover, title}]}) — no adapter needed, same function the plain
  // in-item Book series flow (/api/book-master-set) already relies on to
  // shape this data for SeriesGrid.
  const normalized = result.error ? null : normalizeSeriesResponse('book', result);

  return (
    <main className="container">
      <p className="sub" style={{ marginTop: 20 }}>
        <Link href="/creator/books">← Browse another author</Link>
      </p>

      {result.error ? (
        <div className="empty-state">
          <div>
            {result.error === 'no_series'
              ? "Open Library doesn't have anything on file for that name."
              : "Couldn't reach Open Library right now — try again in a moment."}
          </div>
          <p className="sub">
            <Link href="/creator/books">Try a different search</Link>.
          </p>
        </div>
      ) : (
        <BookCreatorPageClient
          name={normalized.seriesName}
          entries={normalized.entries}
          ownedKeys={ownedKeys}
          signedIn={!!user}
          currency={currency}
        />
      )}
    </main>
  );
}
