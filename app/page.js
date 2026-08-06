import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import { CoverThumb } from '@/components/LeaderboardThumb';
import { fetchIgdbCover, fetchOpenLibraryCover, fetchPokemonCardCover } from '@/lib/showcaseCovers';

const CATEGORIES = ['Video Games', 'Comics', 'Trading Cards', 'Vinyl Records', 'Books', 'DVDs', 'CDs'];

// Curated fallback for each showcase slot. All 3 get a genuinely real
// photo, fetched live from a free API the app already uses elsewhere —
// game (IGDB), trading card (Pokémon TCG API, keyless — same source as
// the real "Search" button), book (Open Library). Comic was the 4th
// candidate but has no equivalent free cover API in the app yet, so it
// sat out in favor of a type that can show a real photo instead of
// generated art.
const FALLBACK_ITEMS = {
  game: {
    id: 'demo-game-000-0000-0000-000000000004',
    item_type: 'game',
    title: 'Hollow Knight',
    cover: '',
    ownership: 'owned',
    platforms: ['Nintendo Switch'],
    genre: 'Metroidvania',
    play_status: 'completed',
    rating: 5,
  },
  trading_card: {
    id: 'demo-card-000-0000-0000-000000000006',
    item_type: 'trading_card',
    title: 'Charizard VMAX',
    cover: '',
    ownership: 'owned',
    card_set: "Champion's Path",
    player_name: 'Charizard',
    publisher: 'Pokémon',
    rating: 5,
  },
  book: {
    id: 'demo-book-000-0000-0000-000000000005',
    item_type: 'book',
    title: 'The Hobbit',
    cover: '',
    ownership: 'owned',
    writer: 'J.R.R. Tolkien',
    publisher: 'Houghton Mifflin',
    format: 'Paperback',
    rating: 5,
  },
};
// Live cover lookup for each fallback slot — always called, since every
// showcase slot now has a real photo source (see the showcaseItems
// logic below).
const FALLBACK_FETCHERS = {
  game: () => fetchIgdbCover(FALLBACK_ITEMS.game.title),
  trading_card: () => fetchPokemonCardCover(FALLBACK_ITEMS.trading_card.title),
  book: () => fetchOpenLibraryCover(FALLBACK_ITEMS.book.title),
};
const SHOWCASE_TYPES = ['game', 'trading_card', 'book'];

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

  // Hero cards always use curated field values (title, platform, genre,
  // etc.) rather than pulling a real person's actual item — a real
  // collection entry can have any number of optional fields filled in
  // (region, condition, completeness, market value...), which made the
  // 3 cards wildly different heights and truncated real long field
  // values in the narrow hero layout. Curated fields keep the row count
  // (and the layout) consistent and predictable. The photo itself is
  // still genuinely real: all 3 slots fetch an actual live cover
  // (IGDB / Pokémon TCG / Open Library).
  const showcaseItems = await Promise.all(
    SHOWCASE_TYPES.map(async (type) => {
      const fetcher = FALLBACK_FETCHERS[type];
      const cover = fetcher ? await fetcher() : null;
      return cover ? { ...FALLBACK_ITEMS[type], cover } : FALLBACK_ITEMS[type];
    })
  );
  // Only swap in the real top-3 once there's enough real data for it to
  // read as a genuine leaderboard rather than a couple of lonely rows —
  // falls back to a representative example in the meantime.
  const realLeaderboard = topOwned && topOwned.length === 3 && topOwned[2].owner_count >= 2 ? topOwned : null;
  const leaderboardRows = realLeaderboard
    ? realLeaderboard.map((row, i) => ({
        rank: i + 1,
        title: row.title,
        cover: row.cover,
        sub: `${row.owner_count} owner${row.owner_count === 1 ? '' : 's'}`,
      }))
    : [
        { rank: 1, title: 'Elden Ring', cover: '/demo/elden-demo.png', sub: '412 owners' },
        { rank: 2, title: 'The Last of Us', cover: '/demo/tlou-demo.png', sub: '388 owners' },
        { rank: 3, title: 'Amazing Spider-Man #300', cover: '/demo/comic-demo-v3.png', sub: '301 owners' },
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
          {showcaseItems.map((item) => (
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
            <div className="value-title">
              Public profiles &amp; leaderboards
              {!realLeaderboard && <span className="category-pill" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Example</span>}
            </div>
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
                <CoverThumb cover={row.cover} title={row.title} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{row.title}</div>
                <div className="sub" style={{ margin: 0 }}>{row.sub}</div>
              </div>
            ))}
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
