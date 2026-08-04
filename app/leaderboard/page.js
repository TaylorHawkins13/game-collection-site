import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { CoverThumb, PersonAvatar } from '@/components/LeaderboardThumb';

export const metadata = {
  title: 'Leaderboard',
  description: 'Most-owned items, biggest public collections, trending titles, and trophy counts across Shelf Life collectors.',
};

function rankClass(i) {
  if (i === 0) return ' medal-1';
  if (i === 1) return ' medal-2';
  if (i === 2) return ' medal-3';
  return '';
}

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
      <p className="sub" style={{ marginBottom: 32 }}>
        Based on public collections only.
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start' }}>
        <section>
          <h2 style={{ fontSize: 15 }}>Most-owned items</h2>
          {(mostOwned || []).length === 0 && <div className="sub">No data yet.</div>}
          {(mostOwned || []).map((row, i) => (
            <div className="leaderboard-row" key={row.title_key}>
              <div className={`leaderboard-rank${rankClass(i)}`}>{i + 1}</div>
              <CoverThumb cover={row.cover} title={row.title} />
              <div style={{ flex: 1, minWidth: 0 }} className="leaderboard-name">{row.title}</div>
              <div className="sub" style={{ margin: 0 }}>{row.owner_count} owners</div>
            </div>
          ))}
        </section>

        <section>
          <h2 style={{ fontSize: 15 }}>Biggest collections</h2>
          {(biggest || []).length === 0 && <div className="sub">No data yet.</div>}
          {(biggest || []).map((row, i) => (
            <div className="leaderboard-row" key={row.user_id}>
              <div className={`leaderboard-rank${rankClass(i)}`}>{i + 1}</div>
              <PersonAvatar avatarUrl={row.avatar_url} name={row.display_name || row.username} />
              <div style={{ flex: 1, minWidth: 0 }} className="leaderboard-name">
                <Link href={`/u/${row.username}`}>{row.display_name || row.username}</Link>
              </div>
              <div className="sub" style={{ margin: 0 }}>{row.game_count} items</div>
            </div>
          ))}
        </section>

        <section>
          <h2 style={{ fontSize: 15 }}>Trending (last 14 days)</h2>
          {(trending || []).length === 0 && <div className="sub">No data yet.</div>}
          {(trending || []).map((row, i) => (
            <div className="leaderboard-row" key={row.title_key}>
              <div className={`leaderboard-rank${rankClass(i)}`}>{i + 1}</div>
              <CoverThumb cover={row.cover} title={row.title} />
              <div style={{ flex: 1, minWidth: 0 }} className="leaderboard-name">{row.title}</div>
              <div className="sub" style={{ margin: 0 }}>+{row.recent_adds}</div>
            </div>
          ))}
        </section>

        <section>
          <h2 style={{ fontSize: 15 }}>Trophy case</h2>
          <p className="sub" style={{ margin: '0 0 10px' }}>Ranked by Shelf Life trophies earned.</p>
          {(trophies || []).length === 0 && <div className="sub">No data yet.</div>}
          {(trophies || []).map((row, i) => (
            <div className="leaderboard-row" key={row.user_id}>
              <div className={`leaderboard-rank${rankClass(i)}`}>{i + 1}</div>
              <PersonAvatar avatarUrl={row.avatar_url} name={row.display_name || row.username} />
              <div style={{ flex: 1, minWidth: 0 }} className="leaderboard-name">
                <Link href={`/u/${row.username}`}>{row.display_name || row.username}</Link>
              </div>
              <div className="sub" style={{ margin: 0 }}>
                {row.trophy_count} trophies{row.platinum_count > 0 ? ` · ${row.platinum_count} platinum` : ''}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
