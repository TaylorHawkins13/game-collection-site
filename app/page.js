import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';

const CATEGORIES = ['Video Games', 'Comics', 'Trading Cards', 'Vinyl Records', 'Books', 'DVDs', 'CDs'];

// Real GameCard component fed sample data, rather than a hand-drawn
// mockup — what's shown here is pixel-for-pixel what an actual card
// looks like on your dashboard, not an approximation of it.
const SHOWCASE_ITEMS = [
  {
    id: 'demo-card-0000-0000-0000-000000000001',
    item_type: 'trading_card',
    title: 'Charizard VMAX',
    cover: '/demo/card-demo.png',
    ownership: 'owned',
    card_set: "Champion's Path",
    card_number: '074/073',
    player_name: 'Charizard',
    publisher: 'Pokémon',
    grade: 'PSA 10',
    rating: 5,
  },
  {
    id: 'demo-comic-000-0000-0000-000000000002',
    item_type: 'comic',
    title: 'Amazing Spider-Man #300',
    cover: '/demo/comic-demo.png',
    ownership: 'owned',
    series: 'Amazing Spider-Man',
    issue_number: '300',
    publisher: 'Marvel',
    writer: 'David Michelinie',
    artist: 'Todd McFarlane',
    grade: '9.8',
    rating: 4.5,
  },
  {
    id: 'demo-vinyl-000-0000-0000-000000000003',
    item_type: 'vinyl',
    title: 'Rumours',
    cover: '/demo/vinyl-demo.png',
    ownership: 'owned',
    artist: 'Fleetwood Mac',
    publisher: 'Warner Bros.',
    format: 'LP',
    edition: '180g reissue',
    rating: 4.5,
  },
];

// Same two trophies used in the real achievements-migration.sql seed
// data (first-item / items-100), shown earned — the actual Trophy Case
// component, not a redrawn copy of it.
const TROPHY_DEFS = [
  { key: 'first-item', name: 'First Pickup', description: 'Add your first item to your collection.', tier: 'bronze', sort_order: 1 },
  { key: 'items-100', name: 'Centurion', description: 'Own 100 items.', tier: 'gold', sort_order: 13 },
];

export default async function HomePage() {
  const supabase = createClient();

  // Real, live counts — not made-up marketing numbers. RLS means an
  // anonymous visitor only ever sees items belonging to public profiles,
  // so this naturally matches what "Based on public collections only"
  // already means everywhere else on the site (leaderboard, search).
  // If either count is too small to say anything meaningful yet, the
  // stat strip just doesn't render rather than showing an unimpressive
  // number.
  const [{ count: itemCount }, { count: collectorCount }, { data: topOwned }] = await Promise.all([
    supabase.from('games').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_public', true),
    supabase.from('leaderboard_most_owned').select('*').limit(3),
  ]);
  const showItemStat = (itemCount || 0) >= 20;
  const showCollectorStat = (collectorCount || 0) >= 3;
  // Only swap in the real top-3 once there's enough real data for it to
  // read as a genuine leaderboard rather than a couple of lonely rows —
  // falls back to a representative example in the meantime.
  const realLeaderboard = topOwned && topOwned.length === 3 && topOwned[2].owner_count >= 2 ? topOwned : null;
  const leaderboardRows = realLeaderboard
    ? realLeaderboard.map((row, i) => ({
        rank: i + 1,
        title: row.title,
        sub: `${row.owner_count} owner${row.owner_count === 1 ? '' : 's'}`,
      }))
    : [
        { rank: 1, title: 'Elden Ring', sub: '412 owners' },
        { rank: 2, title: 'The Last of Us', sub: '388 owners' },
        { rank: 3, title: 'Amazing Spider-Man #300', sub: '301 owners' },
      ];

  return (
    <main className="container">
      <div className="hero-split">
        <div className="hero-copy">
          <h1>Track your collection. Show it off.</h1>
          <p>
            Shelf Life is a free way to catalog everything you collect — games, comics, trading
            cards, vinyl, books, DVDs and CDs — then share your shelf with other collectors,
            earn trophies, and see how it stacks up.
          </p>
          <div className="cta-row">
            <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 22px' }}>
              Start tracking free
            </Link>
            <Link href="/leaderboard" className="btn-ghost" style={{ textDecoration: 'none', padding: '12px 22px' }}>
              See the leaderboard
            </Link>
          </div>
          {(showItemStat || showCollectorStat) && (
            <div className="hero-stats">
              {showItemStat && (
                <div className="hero-stat">
                  <span className="hero-stat-num">{itemCount.toLocaleString()}</span> items catalogued
                </div>
              )}
              {showCollectorStat && (
                <div className="hero-stat">
                  <span className="hero-stat-num">{collectorCount.toLocaleString()}</span> public collectors
                </div>
              )}
            </div>
          )}
          <div className="category-pills">
            {CATEGORIES.map((c) => (
              <span className="category-pill" key={c}>{c}</span>
            ))}
          </div>
        </div>

        <div className="hero-showcase">
          {SHOWCASE_ITEMS.map((item) => (
            <div className="hero-showcase-item" key={item.id}>
              <GameCard game={item} />
            </div>
          ))}
        </div>
      </div>

      <div className="value-rows">
        <div className="value-row">
          <div className="value-text">
            <div className="value-title">Every kind of collection, one shelf</div>
            <div className="value-body">
              Video games, comics, trading cards, vinyl, books, DVDs and CDs — each with its own
              tailored fields (platforms, issue numbers, grades, pressings, and more) instead of
              a generic catch-all form.
            </div>
            <Link href="/signup" className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 18px', display: 'inline-block', marginTop: 6 }}>
              Add your first item
            </Link>
          </div>
          <div className="value-visual">
            <div className="category-pills" style={{ marginTop: 0 }}>
              {CATEGORIES.map((c) => (
                <span className="category-pill" key={c}>{c}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="value-row reverse">
          <div className="value-text">
            <div className="value-title">Earn real trophies</div>
            <div className="value-body">
              A PlayStation Trophies-style system awards bronze-to-platinum badges automatically
              for real milestones — first item, 100 owned, 25 completed, and more — shown right
              on your public profile.
            </div>
          </div>
          <div className="value-visual">
            <TrophyCase defs={TROPHY_DEFS} earnedKeys={['first-item', 'items-100']} />
          </div>
        </div>

        <div className="value-row">
          <div className="value-text">
            <div className="value-title">Public profiles &amp; leaderboards</div>
            <div className="value-body">
              Share a link to your shelf, follow other collectors, and see the most-owned items,
              the biggest public collections, and what's trending — or keep everything private,
              it's your call.
            </div>
            <Link href="/players" className="btn-ghost" style={{ textDecoration: 'none', padding: '9px 18px', display: 'inline-block', marginTop: 6 }}>
              Browse collectors
            </Link>
          </div>
          <div className="value-visual">
            {leaderboardRows.map((row, i) => (
              <div className="leaderboard-row" style={i === leaderboardRows.length - 1 ? { marginBottom: 0 } : undefined} key={row.rank}>
                <div className="leaderboard-rank">{row.rank}</div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                <div className="sub" style={{ margin: 0 }}>{row.sub}</div>
              </div>
            ))}
            {!realLeaderboard && (
              <div className="sub" style={{ marginTop: 8, fontSize: 11 }}>Illustrative example — updates automatically as collectors join.</div>
            )}
          </div>
        </div>
      </div>

      <div className="cta-band">
        <div className="cta-band-title">Ready to catalog your collection?</div>
        <div className="cta-band-text">It's free, takes a minute to set up, and your shelf is yours to make public or keep private.</div>
        <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 22px', display: 'inline-block' }}>
          Start tracking free
        </Link>
      </div>
    </main>
  );
}
