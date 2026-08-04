import { createClient } from '@/lib/supabaseServer';
import LeaderboardClient from './LeaderboardClient';

export const metadata = {
  title: 'Leaderboard',
  description: 'Most-owned items, biggest public collections, trending titles, and trophy counts across Shelf Life collectors.',
};

export default async function LeaderboardPage() {
  const supabase = createClient();

  const [{ data: mostOwned }, { data: biggest }, { data: trending }, { data: trophies }] = await Promise.all([
    supabase.from('leaderboard_most_owned').select('*').limit(15),
    supabase.from('leaderboard_biggest_collections').select('*').limit(15),
    supabase.from('leaderboard_trending').select('*').limit(15),
    supabase.from('leaderboard_trophies').select('*').limit(15),
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
      />
    </main>
  );
}
