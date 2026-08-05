import { createClient } from '@/lib/supabaseServer';
import LeaderboardClient from './LeaderboardClient';

export const metadata = {
  title: 'Leaderboard',
  description:
    'Most-owned items, biggest and most valuable public collections, trending titles, and trophy counts across Shelf Life collectors.',
};

export default async function LeaderboardPage() {
  const supabase = createClient();

  // Only the top 3 (a podium) ever show on this page now.
  const [{ data: mostOwned }, { data: biggest }, { data: trending }, { data: trophies }, { data: mostValuable }] =
    await Promise.all([
      supabase.from('leaderboard_most_owned').select('*').limit(3),
      supabase.from('leaderboard_biggest_collections').select('*').limit(3),
      supabase.from('leaderboard_trending').select('*').limit(3),
      supabase.from('leaderboard_trophies').select('*').limit(3),
      supabase.from('leaderboard_most_valuable').select('*').limit(3),
    ]);

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
      />
    </main>
  );
}
