import { createClient } from '@/lib/supabaseServer';
import LeaderboardClient from './LeaderboardClient';

export const metadata = {
  title: 'Leaderboard',
  description:
    'Most-owned items, biggest and most valuable public collections, trending titles, and trophy counts across Shelf Life collectors.',
};

export default async function LeaderboardPage() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // Only the top 3 (a podium) ever show on this page now.
  // The leaderboard_friends* views are scoped to auth.uid() inside the
  // view itself (join follows on follower_id = auth.uid()) — fetching
  // them for a signed-out visitor just comes back empty, no separate
  // branch needed.
  //
  // The "Most valuable" podium's secondary figure (see
  // LeaderboardClient.jsx's statFor) converts into the viewer's own
  // preferred currency, not a fixed USD — so this also needs the
  // viewer's profile.currency (the same field Settings > Currency
  // writes) and the same currency_rates_to_usd table the ranking itself
  // already uses, converting through total_value_usd rather than a fresh
  // currency-to-currency lookup so it can never disagree with the rate
  // data that decided the rank. A signed-out visitor, or one who hasn't
  // set a currency, falls back to USD — same default profiles.currency
  // itself uses.
  const [
    { data: mostOwned },
    { data: biggest },
    { data: trending },
    { data: trophies },
    { data: mostValuable },
    { data: friendsTrophies },
    { data: friendsBiggest },
    { data: friendsMostValuable },
    { data: friendsMostOwned },
    { data: friendsTrending },
    { data: viewerProfile },
    { data: rateRows },
  ] = await Promise.all([
    supabase.from('leaderboard_most_owned').select('*').limit(3),
    supabase.from('leaderboard_biggest_collections').select('*').limit(3),
    supabase.from('leaderboard_trending').select('*').limit(3),
    supabase.from('leaderboard_trophies').select('*').limit(3),
    supabase.from('leaderboard_most_valuable').select('*').limit(3),
    supabase.from('leaderboard_friends').select('*').limit(3),
    supabase.from('leaderboard_friends_biggest').select('*').limit(3),
    supabase.from('leaderboard_friends_most_valuable').select('*').limit(3),
    supabase.from('leaderboard_friends_most_owned').select('*').limit(3),
    supabase.from('leaderboard_friends_trending').select('*').limit(3),
    viewer
      ? supabase.from('profiles').select('currency').eq('id', viewer.id).single()
      : Promise.resolve({ data: null }),
    supabase.from('currency_rates_to_usd').select('code, rate_to_usd'),
  ]);

  const viewerCurrency = viewerProfile?.currency || 'USD';
  const rates = Object.fromEntries((rateRows || []).map((r) => [r.code, r.rate_to_usd]));

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Leaderboard</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Based on public collections only.
      </p>
      <LeaderboardClient
        mostOwned={mostOwned || []}
        biggest={biggest || []}
        trending={trending || []}
        trophies={trophies || []}
        mostValuable={mostValuable || []}
        friendsTrophies={friendsTrophies || []}
        friendsBiggest={friendsBiggest || []}
        friendsMostValuable={friendsMostValuable || []}
        friendsMostOwned={friendsMostOwned || []}
        friendsTrending={friendsTrending || []}
        viewerLoggedIn={!!viewer}
        viewerCurrency={viewerCurrency}
        rates={rates}
      />
    </main>
  );
}
