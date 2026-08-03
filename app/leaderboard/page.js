import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';

export default async function LeaderboardPage() {
  const supabase = createClient();

  const [{ data: mostOwned }, { data: biggest }, { data: trending }] = await Promise.all([
    supabase.from('leaderboard_most_owned').select('*').limit(15),
    supabase.from('leaderboard_biggest_collections').select('*').limit(15),
    supabase.from('leaderboard_trending').select('*').limit(15),
  ]);

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Leaderboard</h1>
      <p className="sub" style={{ marginBottom: 32 }}>
        Based on public collections only.
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start' }}>
        <section>
          <h2 style={{ fontSize: 15 }}>Most-owned games</h2>
          {(mostOwned || []).length === 0 && <div className="sub">No data yet.</div>}
          {(mostOwned || []).map((row, i) => (
            <div className="leaderboard-row" key={row.title_key}>
              <div className="leaderboard-rank">{i + 1}</div>
              <div style={{ flex: 1 }}>{row.title}</div>
              <div className="sub" style={{ margin: 0 }}>{row.owner_count} owners</div>
            </div>
          ))}
        </section>

        <section>
          <h2 style={{ fontSize: 15 }}>Biggest collections</h2>
          {(biggest || []).length === 0 && <div className="sub">No data yet.</div>}
          {(biggest || []).map((row, i) => (
            <div className="leaderboard-row" key={row.user_id}>
              <div className="leaderboard-rank">{i + 1}</div>
              <div style={{ flex: 1 }}>
                <Link href={`/u/${row.username}`}>{row.display_name || row.username}</Link>
              </div>
              <div className="sub" style={{ margin: 0 }}>{row.game_count} games</div>
            </div>
          ))}
        </section>

        <section>
          <h2 style={{ fontSize: 15 }}>Trending (last 14 days)</h2>
          {(trending || []).length === 0 && <div className="sub">No data yet.</div>}
          {(trending || []).map((row, i) => (
            <div className="leaderboard-row" key={row.title_key}>
              <div className="leaderboard-rank">{i + 1}</div>
              <div style={{ flex: 1 }}>{row.title}</div>
              <div className="sub" style={{ margin: 0 }}>+{row.recent_adds}</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
