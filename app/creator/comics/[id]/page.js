import { cache } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { getComicCreatorWorks } from '@/lib/comicVineCreatorLookup';
import { ownedComicKeysBySeriesAndIssue } from '@/lib/seriesLookup';
import CreatorPageClient from './CreatorPageClient';

// Wrapped in React's cache() so generateMetadata and the page body below
// share one real Comic Vine lookup instead of two — this one genuinely
// costs several real requests (a person lookup plus a batch of issue
// fetches, see lib/comicVineCreatorLookup.js), unlike the plain single-
// row Supabase lookups elsewhere in this app that already tolerate being
// queried twice per page load without a second thought.
const getWorksCached = cache((id) => getComicCreatorWorks(id));

export async function generateMetadata({ params }) {
  const { id } = await params;
  const result = await getWorksCached(id);
  if (result.error || !result.name) {
    return { title: 'Creator not found', robots: { index: false } };
  }
  const count = result.entries.length;
  const description = count
    ? `Browse ${result.name}'s comics on Shelf Life — ${count} issue${count === 1 ? '' : 's'} on file, greyed out except what you already own.`
    : `Browse ${result.name}'s comics on Shelf Life.`;
  return {
    title: `${result.name} — Comics`,
    description,
    openGraph: {
      title: `${result.name}'s comics on Shelf Life`,
      description,
      images: result.image ? [result.image] : undefined,
    },
  };
}

export default async function ComicCreatorPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const [result, { data: { user } }] = await Promise.all([
    getWorksCached(id),
    supabase.auth.getUser(),
  ]);

  let ownedKeys = [];
  let currency;
  if (user) {
    const [{ data: ownComics }, { data: profile }] = await Promise.all([
      supabase.from('games').select('series, issue_number, ownership').eq('user_id', user.id).eq('item_type', 'comic'),
      supabase.from('profiles').select('currency').eq('id', user.id).maybeSingle(),
    ]);
    ownedKeys = [...ownedComicKeysBySeriesAndIssue((ownComics || []).map((g) => ({ ...g, item_type: 'comic' })))];
    currency = profile?.currency;
  }

  return (
    <main className="container">
      <p className="sub" style={{ marginTop: 20 }}>
        <Link href="/creator/comics">← Browse another creator</Link>
      </p>

      {result.error ? (
        <div className="empty-state">
          <div>
            {result.error === 'not_configured'
              ? "Creator pages aren't set up on this site yet."
              : "Couldn't find that creator, or couldn't reach Comic Vine right now."}
          </div>
          <p className="sub">
            <Link href="/creator/comics">Try a different search</Link>.
          </p>
        </div>
      ) : (
        <CreatorPageClient
          name={result.name}
          image={result.image}
          entries={result.entries}
          ownedKeys={ownedKeys}
          truncated={result.truncated}
          signedIn={!!user}
          currency={currency}
        />
      )}
    </main>
  );
}
