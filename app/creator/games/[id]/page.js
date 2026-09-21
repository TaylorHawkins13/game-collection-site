import { cache } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { getCompanyGames } from '@/lib/igdbCompanyLookup';
import { normalizeSeriesResponse, ownedKeysFor } from '@/lib/seriesLookup';
import CompanyPageClient from './CompanyPageClient';

// Wrapped in cache() so generateMetadata and the page body below share
// one real IGDB lookup instead of two — same reasoning app/creator/
// comics/[id]/page.js's getWorksCached uses. This one genuinely costs
// several real IGDB requests (a company lookup, a paginated
// involved_companies walk, then a batch of game fetches — see
// lib/igdbCompanyLookup.js).
const getCompanyGamesCached = cache((id) => getCompanyGames(id));

export async function generateMetadata({ params }) {
  const { id } = await params;
  const result = await getCompanyGamesCached(id);
  if (result.error || !result.companyName) {
    return { title: 'Company not found', robots: { index: false } };
  }
  const count = result.games.length;
  const description = count
    ? `Browse ${result.companyName}'s games on Shelf Life — ${count} title${count === 1 ? '' : 's'} on file, greyed out except what you already own.`
    : `Browse ${result.companyName}'s games on Shelf Life.`;
  return {
    title: `${result.companyName} — Games`,
    description,
    openGraph: {
      title: `${result.companyName}'s games on Shelf Life`,
      description,
      images: result.logo ? [result.logo] : undefined,
    },
  };
}

export default async function GameCompanyPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const [result, { data: { user } }] = await Promise.all([
    getCompanyGamesCached(id),
    supabase.auth.getUser(),
  ]);

  let ownedKeys = [];
  let currency;
  if (user) {
    const [{ data: ownGames }, { data: profile }] = await Promise.all([
      supabase.from('games').select('title, ownership, item_type').eq('user_id', user.id).eq('item_type', 'game'),
      supabase.from('profiles').select('currency').eq('id', user.id).maybeSingle(),
    ]);
    // Same title-normalized key ownedKeysFor's plain `game` branch already
    // uses everywhere else a game gets matched by title (the Series
    // feature's own franchise grid, GameModal/ItemDetailModal) — a
    // company's catalogue has no per-entry number field either, so
    // there's nothing more specific than title to key on, same as Books.
    ownedKeys = [...ownedKeysFor(ownGames || [], 'game')];
    currency = profile?.currency;
  }

  // normalizeSeriesResponse's game branch expects `franchiseName`, not
  // `companyName` — getCompanyGames()'s own return shape is otherwise a
  // direct fit (same {id, name, cover, year} game rows getFranchiseGames
  // already produces), so this is a one-field rename at the call site
  // rather than a real adapter.
  const normalized = result.error
    ? null
    : normalizeSeriesResponse('game', { franchiseName: result.companyName, games: result.games });

  return (
    <main className="container">
      <p className="sub" style={{ marginTop: 20 }}>
        <Link href="/creator/games">← Browse another company</Link>
      </p>

      {result.error ? (
        <div className="empty-state">
          <div>
            {result.error === 'not_configured'
              ? "Creator pages aren't set up on this site yet."
              : "Couldn't find that company, or couldn't reach IGDB right now."}
          </div>
          <p className="sub">
            <Link href="/creator/games">Try a different search</Link>.
          </p>
        </div>
      ) : (
        <CompanyPageClient
          name={result.companyName}
          logo={result.logo}
          entries={normalized.entries}
          ownedKeys={ownedKeys}
          truncated={result.truncated}
          signedIn={!!user}
          currency={currency}
        />
      )}
    </main>
  );
}
