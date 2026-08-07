import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import { CoverThumb } from '@/components/LeaderboardThumb';
import { fetchIgdbCover, fetchOpenLibraryCover, fetchPokemonCardCover } from '@/lib/showcaseCovers';
import { formatMoney } from '@/lib/currency';
import { WHATS_NEW } from '@/lib/whatsNew';

const CATEGORIES = [
  'Video Games',
  'Comics',
  'Trading Cards',
  'Vinyl Records',
  'Books',
  'DVDs',
  'VHS',
  'CDs',
  'Consoles',
  'Funko Pops',
];

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

// Shortcuts into the rest of the app — same destinations already reachable
// via the navbar/dashboard, just gathered in one tappable grid so the home
// hub also works as a real "launcher" screen when opened as the installed
// PWA (its start_url is "/"), not just a web page.
const QUICK_ACTIONS = [
  { href: '/dashboard?add=1', label: 'Add an item' },
  { href: '/dashboard', label: 'My Collection' },
  { href: '/feed', label: 'Feed' },
  { href: '/players', label: 'Search' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

function activityVerb(eventType) {
  if (eventType === 'added') return 'added';
  if (eventType === 'completed') return 'completed';
  if (eventType === 'rated') return 'rated';
  if (eventType === 'trophy') return 'earned the trophy';
  return eventType;
}

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (viewer) {
    return <LoggedInHome supabase={supabase} viewer={viewer} />;
  }

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
            cards, vinyl, books, DVDs, VHS, CDs, consoles and Funko Pops — then share your shelf
            with other collectors, earn trophies, and see how it stacks up.
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

        <div className="hero-showcase-wrap">
          <div className="hero-showcase">
            {showcaseItems.map((item) => (
              <div className="hero-showcase-item" key={item.id}>
                <GameCard game={item} />
              </div>
            ))}
          </div>
          {/* Below 640px the 3 cards become a swipeable row (see globals.css)
              rather than shrinking past a readable size — this fade is the
              "there's more, swipe me" hint. Without it, a card getting cut
              off mid-frame with no visual cue just reads as broken/cramped
              rather than an intentional scrollable row. Hidden entirely
              above 640px, where all 3 already fit with no scrolling. */}
          <div className="hero-showcase-fade" aria-hidden="true" />
        </div>
      </div>

      <div className="value-rows">
        <div className="value-row">
          <div className="value-text">
            <div className="value-title">Every kind of collection, one shelf</div>
            <div className="value-body">
              Video games, comics, trading cards, vinyl, books, DVDs, VHS, CDs, consoles and
              Funko Pops — each with its own tailored fields (platforms, issue numbers, grades,
              pressings, and more) instead of a generic catch-all form.
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

// The actual "home" for a signed-in visitor — distinct from /dashboard
// (which is the collection-management workspace) and /feed (which is the
// full activity stream). This is a lighter landing spot: a greeting, your
// real numbers at a glance, one-tap shortcuts into the rest of the app, and
// a peek at both feed activity and site updates so there's a reason to
// actually land here instead of skipping straight to the dashboard. Doubles
// as the installed PWA's launch screen, since manifest.js's start_url is "/".
async function LoggedInHome({ supabase, viewer }) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, currency')
    .eq('id', viewer.id)
    .single();

  // Minimal column set — this page only needs counts and a value total,
  // not full item detail (that's what /dashboard's grid is for).
  const { data: games } = await supabase
    .from('games')
    .select('id, ownership, play_status, market_price, price, copy_type')
    .eq('user_id', viewer.id);

  const allGames = games || [];
  const owned = allGames.filter((g) => g.ownership === 'owned');
  const completed = allGames.filter((g) => g.play_status === 'completed').length;
  const collectionValue = owned
    .filter((g) => g.copy_type !== 'digital')
    .reduce((sum, g) => {
      const raw = g.market_price != null ? g.market_price : g.price;
      const v = raw != null ? parseFloat(raw) : NaN;
      return Number.isNaN(v) ? sum : sum + v;
    }, 0);

  const { data: followRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', viewer.id);
  const followingIds = (followRows || []).map((r) => r.following_id);

  let events = [];
  if (followingIds.length > 0) {
    const { data } = await supabase
      .from('activity_events')
      .select(
        'id, event_type, created_at, actor:profiles!activity_events_user_id_fkey(username, display_name, avatar_url), game:games(title, item_type, rating), trophy:achievement_defs(name, tier)'
      )
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(4);
    events = (data || []).filter((e) => e.actor && (e.game || (e.event_type === 'trophy' && e.trophy)));
  }

  const name = profile?.display_name || profile?.username || 'there';
  const currency = profile?.currency || 'USD';

  // Personal shortcuts (your own stuff) come first, discovery/social ones
  // after — was previously Add/Collection/Profile/Feed/Search/Leaderboard/
  // Mosaic, which scattered "yours" and "everyone else's" back and forth.
  const quickActions = [...QUICK_ACTIONS];
  if (profile?.username) {
    quickActions.splice(2, 0, { href: `/u/${profile.username}`, label: 'My Profile' });
    quickActions.splice(3, 0, { href: `/u/${profile.username}/mosaic`, label: 'Shelf mosaic' });
  }

  return (
    <main className="container">
      <div className="home-hub-greeting">
        <h1>Welcome back, {name}</h1>
        <p className="sub">Here's where your shelf stands today.</p>
      </div>

      {/* Shortcuts lead, since they're the actual reason to land on this
          page rather than skip straight to /dashboard — stats and activity
          are useful context, but not what someone's here to click. */}
      <div className="quick-actions">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href} className="quick-action-tile">
            {a.label}
          </Link>
        ))}
      </div>

      <div className="stats-bar">
        <div className="stat">
          <div className="num">{allGames.length}</div>
          <div className="label">Total items</div>
        </div>
        <div className="stat">
          <div className="num">{owned.length}</div>
          <div className="label">Owned</div>
        </div>
        <div className="stat">
          <div className="num">{completed}</div>
          <div className="label">Completed</div>
        </div>
        <div className="stat">
          <div className="num">{formatMoney(collectionValue, currency)}</div>
          <div className="label">Collection value</div>
        </div>
      </div>

      {/* A tighter, deliberately compact split rather than reusing the full
          /feed page's layout — that one stacks to a single column below
          800px, which on a phone turned this into a long scroll of full
          feed-item rows followed by full whats-new entries. Trimmed content
          (one line per row, no dates/body text here) keeps both columns
          readable side by side down to phone width instead. */}
      <div className="home-split">
        <div>
          <h2 className="home-section-heading">Recent activity</h2>
          {followingIds.length === 0 ? (
            <div className="home-split-empty">
              Not following anyone yet.{' '}
              <Link href="/players">Find some collectors</Link>.
            </div>
          ) : events.length === 0 ? (
            <div className="home-split-empty">Nothing yet — check back soon.</div>
          ) : (
            <>
              {events.map((e) => (
                <div className="home-activity-row" key={e.id}>
                  <Link href={`/u/${e.actor.username}`} className="avatar home-activity-avatar">
                    {e.actor.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.actor.avatar_url} alt={e.actor.username} />
                    ) : (
                      (e.actor.display_name || e.actor.username || '?').slice(0, 1).toUpperCase()
                    )}
                  </Link>
                  <div className="home-activity-text">
                    <Link href={`/u/${e.actor.username}`} className="feed-item-name">
                      {e.actor.display_name || e.actor.username}
                    </Link>{' '}
                    {e.event_type === 'trophy' && e.trophy ? (
                      <>
                        {activityVerb(e.event_type)} <strong>{e.trophy.name}</strong>
                      </>
                    ) : (
                      <>
                        {activityVerb(e.event_type)} <strong>{e.game.title}</strong>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <Link href="/feed" className="btn-ghost home-split-more">
                See full feed
              </Link>
            </>
          )}
        </div>

        <div>
          <h2 className="home-section-heading">What's new</h2>
          {WHATS_NEW.slice(0, 4).map((item) => (
            <div className="home-whatsnew-row" key={item.title}>
              {item.title}
            </div>
          ))}
          <Link href="/feed" className="btn-ghost home-split-more">
            See all updates
          </Link>
        </div>
      </div>
    </main>
  );
}
