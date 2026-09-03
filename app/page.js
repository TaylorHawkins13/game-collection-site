import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import GameCard from '@/components/GameCard';
import TrophyCase from '@/components/TrophyCase';
import { CoverThumb } from '@/components/LeaderboardThumb';
import StarRating from '@/components/StarRating';
import { fetchIgdbCover, fetchOpenLibraryCover } from '@/lib/showcaseCovers';
import { WHATS_NEW } from '@/lib/whatsNew';
import WhatsNewList from '@/components/WhatsNewList';
import { getAllArticles } from '@/lib/articles';
import { TYPE_LABELS } from '@/lib/mosaicData';

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

// Curated fallback for each showcase slot. Game and book get a
// genuinely real photo, fetched live from a free API the app already
// uses elsewhere — game (IGDB), book (Open Library). Comic was the 4th
// candidate but has no equivalent free cover API in the app yet, so it
// sat out in favor of a type that can show a real photo instead of
// generated art.
//
// The trading-card slot deliberately does NOT do the same — it used to
// pull a real Charizard card (Pokémon TCG API), which is what got the
// 1.0 App Store resubmission rejected under Guideline 4.1(a) (Copycats:
// "screenshots includes references to Pokemon"). A different real card
// game's art would carry the same category of risk with a different
// trademark holder, so this uses fully generic, made-up card details
// and no fetched image instead — same as how any item with no cover art
// already renders elsewhere on the site.
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
    title: 'Mint Condition Holo',
    cover: '',
    ownership: 'owned',
    card_set: 'First Edition',
    card_number: '4/102',
    player_name: 'Rare Holo',
    publisher: 'Trading Card Co.',
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
// Live cover lookup for each fallback slot that has one — the
// trading-card slot intentionally has no fetcher (see above), so it
// always falls through to its blank `cover` and renders the same "No
// Cover" placeholder any item without art gets.
const FALLBACK_FETCHERS = {
  game: () => fetchIgdbCover(FALLBACK_ITEMS.game.title),
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

// Only the shortcuts that AREN'T already one tap away from the navbar
// (Search, Leaderboard, Feed, My Collection, My Profile all live there
// already) — this used to be a 7-tile grid that mostly just re-listed the
// nav, which was the core complaint that led to this rewrite: the home
// hub should offer something you can't already get from the dashboard or
// the navbar, not duplicate them.
const QUICK_ACTIONS = [
  { href: '/dashboard?add=1', label: 'Add an item' },
];

export default async function HomePage() {
  const supabase = await createClient();
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
  const [{ count: itemCount }, { count: collectorCount }, { count: trophyCount }, { data: topOwned }] = await Promise.all([
    supabase.from('games').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_public', true),
    // user_achievements is a fully public-readable table (see
    // supabase-schema.sql) — same trust/RLS rationale as the two counts
    // above, no admin client needed for a site-wide, non-identifying total.
    supabase.from('user_achievements').select('user_id', { count: 'exact', head: true }),
    supabase.from('leaderboard_most_owned').select('*').limit(3),
  ]);
  const showItemStat = (itemCount || 0) >= 20;
  const showCollectorStat = (collectorCount || 0) >= 3;
  const showTrophyStat = (trophyCount || 0) >= 10;

  // Hero cards always use curated field values (title, platform, genre,
  // etc.) rather than pulling a real person's actual item — a real
  // collection entry can have any number of optional fields filled in
  // (region, condition, completeness, market value...), which made the
  // 3 cards wildly different heights and truncated real long field
  // values in the narrow hero layout. Curated fields keep the row count
  // (and the layout) consistent and predictable. The game and book
  // slots' photos are still genuinely real (IGDB / Open Library) — the
  // trading-card slot uses generic placeholder text and no photo at all
  // on purpose, see the FALLBACK_ITEMS comment above.
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
          {(showItemStat || showCollectorStat || showTrophyStat) && (
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
              {showTrophyStat && (
                <div className="hero-stat">
                  <span className="hero-stat-num">{trophyCount.toLocaleString()}</span> trophies earned
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
                <div style={{ flex: 1, fontSize: 'var(--fs-base)', fontWeight: 600 }}>{row.title}</div>
                <div className="sub" style={{ margin: 0 }}>{row.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Closes a real gap flagged in ROADMAP.md: /whats-new was only ever
          reachable from a small footer link, so a first-time signed-out
          visitor deciding whether to sign up had no way to see that this
          is actively maintained. Same WHATS_NEW data and WhatsNewList
          component the logged-in home page and /whats-new itself already
          use — just the newest 3 instead of 4, since this is a teaser
          pointing at the full page, not the full list. */}
      <div className="home-articles-head" style={{ marginBottom: 12 }}>
        <h2 className="home-section-heading" style={{ margin: 0 }}>What&apos;s new</h2>
        <Link href="/whats-new" className="btn-ghost home-split-more" style={{ margin: 0 }}>
          See all updates
        </Link>
      </div>
      <div style={{ marginBottom: 40 }}>
        <WhatsNewList items={WHATS_NEW.slice(0, 3)} />
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
// (which is the collection-management workspace, and already has its own
// stats bar) and /dashboard/insights (which already has the deep analytics
// charts). Repeating either of those here was the original version's main
// problem: this page couldn't justify its own existence next to a page
// that does the same job better. So this one leans entirely into what
// neither of those pages have — site-wide discovery (Recently added /
// Recent ratings, Backloggd-home-inspired: real public data, not just
// people you follow) and editorial content (Reviews & Articles). The
// "Recent activity" feed preview that used to live here was cut — on
// reflection it was still just a smaller copy of /feed rather than
// something distinct, same complaint as the stats bar — and a "Popular
// lists" row was considered and deliberately left out too, at least for
// now. Doubles as the installed PWA's launch screen, since manifest.js's
// start_url is "/".
async function LoggedInHome({ supabase, viewer }) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', viewer.id)
    .single();

  const { data: approvedSubmissions } = await supabase
    .from('article_submissions')
    .select('id, type, title, dek, body, rating, created_at, reviewed_at, profile:profiles(username, display_name)')
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(4);

  // Discovery rows, Backloggd-home-style: a live wall of what other public
  // collectors are actually adding/rating right now, not your own data (the
  // dashboard already covers that) and not a followed-only feed (that's
  // /feed's job). RLS on `games` already limits this to public profiles
  // (see supabase-schema.sql's "Games readable if profile is public or
  // owner" policy) — excluding your own rows here on top of that just keeps
  // this feeling like real community activity rather than a mirror of your
  // own recent adds.
  const { data: recentItems } = await supabase
    .from('games')
    .select('id, item_type, title, cover')
    .neq('user_id', viewer.id)
    .not('cover', 'is', null)
    .neq('cover', '')
    .order('created_at', { ascending: false })
    .limit(14);

  const { data: recentRatings } = await supabase
    .from('games')
    .select('id, item_type, title, cover, rating, notes, profile:profiles(username, display_name)')
    .neq('user_id', viewer.id)
    .gte('rating', 4)
    .not('notes', 'is', null)
    .neq('notes', '')
    .order('updated_at', { ascending: false })
    .limit(8);

  // Purely decorative banner across the top — real cover art, but a
  // different slice of it than "Recently added" below (highly-rated
  // instead of newest, so the two rows don't just repeat each other),
  // and non-interactive since it's meant to read as a visual, not another
  // set of links to click through.
  const { data: spotlightRows } = await supabase
    .from('games')
    .select('id, title, cover')
    .neq('user_id', viewer.id)
    .gte('rating', 4)
    .not('cover', 'is', null)
    .neq('cover', '')
    .order('rating', { ascending: false })
    .limit(16);
  const spotlightCovers = spotlightRows || [];

  const name = profile?.display_name || profile?.username || 'there';

  const quickActions = [...QUICK_ACTIONS];
  if (profile?.username) {
    quickActions.push({ href: `/u/${profile.username}/mosaic`, label: 'Shelf mosaic' });
  }
  const latestArticles = getAllArticles(approvedSubmissions || []).slice(0, 2);

  return (
    <main className="container">
      {spotlightCovers.length >= 6 && (
        <div className="home-banner" aria-hidden="true">
          <div className="home-banner-track">
            {[...spotlightCovers, ...spotlightCovers].map((item, i) => (
              <CoverThumb
                key={`${item.id}-${i}`}
                cover={item.cover}
                title={item.title}
                className="home-banner-cover"
              />
            ))}
          </div>
        </div>
      )}

      <div className="home-hub-greeting">
        <h1>Welcome back, {name}</h1>
        <p className="sub">What other collectors are adding, rating, and writing about.</p>
      </div>

      {/* Just the shortcuts that aren't already a tap away via the navbar —
          "My Collection" and "Articles"/"Feed" already live there (see
          Navbar.jsx), so none of those are repeated as tiles/links down
          here too. Your actual numbers (items, owned, completed, value)
          live on /dashboard and /dashboard/insights already, so this page
          doesn't re-show them either; it earns its place with things
          dashboard doesn't have instead (see the Reviews & Articles
          section below). */}
      <div className="quick-actions home-quick-actions">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href} className="quick-action-tile">
            {a.label}
          </Link>
        ))}
      </div>

      {/* Two horizontal-scroll rows, same layout at every width (this is
          what makes it work on mobile without a separate breakpoint —
          it's just "swipe sideways," narrower viewports simply show fewer
          cards at once). Links reuse /collectible's existing type+title
          route rather than a per-owner item page, since that's the one
          canonical page for "this title, as a thing" regardless of who
          owns which copy. */}
      {recentItems && recentItems.length > 0 && (
        <div className="home-discovery-row">
          <h2 className="home-section-heading">Recently added</h2>
          <div className="home-wall">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                href={`/collectible?type=${encodeURIComponent(item.item_type)}&title=${encodeURIComponent(item.title)}`}
                className="home-wall-item"
                title={item.title}
              >
                <CoverThumb cover={item.cover} title={item.title} className="home-wall-cover" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentRatings && recentRatings.length > 0 && (
        <div className="home-discovery-row">
          <h2 className="home-section-heading">Recent ratings</h2>
          <div className="home-ratings-strip">
            {recentRatings.map((item) => (
              <Link
                key={item.id}
                href={`/collectible?type=${encodeURIComponent(item.item_type)}&title=${encodeURIComponent(item.title)}`}
                className="home-rating-card"
              >
                <CoverThumb cover={item.cover} title={item.title} className="home-rating-cover" />
                <div className="home-rating-body">
                  <div className="home-rating-meta">
                    <span className="category-pill">{TYPE_LABELS[item.item_type] || item.item_type}</span>
                  </div>
                  <div className="home-rating-title">{item.title}</div>
                  <StarRating value={item.rating} size={13} />
                  <p className="home-rating-notes">{item.notes}</p>
                  <span className="sub">
                    — {item.profile?.display_name || item.profile?.username || 'A Shelf Life collector'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {latestArticles.length > 0 && (
        <div className="home-articles">
          <div className="home-articles-head">
            <h2 className="home-section-heading" style={{ margin: 0 }}>Reviews &amp; Articles</h2>
            <Link href="/articles/submit" className="btn-ghost home-split-more" style={{ margin: 0 }}>
              Submit yours
            </Link>
          </div>
          <div className="home-articles-grid">
            {latestArticles.map((a) => (
              <Link href={`/articles/${a.slug}`} key={a.slug} className="article-card">
                <div className="article-card-meta">
                  <span className="category-pill">{a.type === 'review' ? 'Review' : 'Article'}</span>
                  {a.community && <span className="category-pill article-community-pill">Community</span>}
                </div>
                <h3 className="article-card-title">{a.title}</h3>
                <p className="article-card-dek">{a.dek}</p>
                {a.type === 'review' && a.rating != null && (
                  <div className="article-card-rating">
                    <StarRating value={a.rating} size={15} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="home-articles-head">
        <h2 className="home-section-heading" style={{ margin: 0 }}>What's new</h2>
        <Link href="/whats-new" className="btn-ghost home-split-more" style={{ margin: 0 }}>
          See all updates
        </Link>
      </div>
      <div>
        <WhatsNewList items={WHATS_NEW.slice(0, 4)} />
      </div>
    </main>
  );
}
