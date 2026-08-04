import Link from 'next/link';

const CATEGORIES = ['Video Games', 'Comics', 'Trading Cards', 'Vinyl Records', 'Books', 'DVDs', 'CDs'];

const SHOWCASE_ITEMS = [
  {
    title: 'Charizard VMAX',
    cover: 'linear-gradient(135deg, #f0a04b, #d6572c)',
    stats: [
      { label: 'Set', value: "Champion's Path" },
      { label: 'Grade', value: 'PSA 10' },
    ],
  },
  {
    title: 'Amazing Spider-Man #300',
    cover: 'linear-gradient(135deg, #6c5ce7, #4834d4)',
    stats: [
      { label: 'Publisher', value: 'Marvel' },
      { label: 'Grade', value: '9.8' },
    ],
  },
  {
    title: 'Rumours',
    cover: 'linear-gradient(135deg, #00d2a8, #009e7f)',
    stats: [
      { label: 'Artist', value: 'Fleetwood Mac' },
      { label: 'Format', value: 'LP' },
    ],
  },
];

export default function HomePage() {
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
              Create your shelf
            </Link>
            <Link href="/leaderboard" className="btn-ghost" style={{ textDecoration: 'none', padding: '12px 22px' }}>
              See the leaderboard
            </Link>
          </div>
          <div className="category-pills">
            {CATEGORIES.map((c) => (
              <span className="category-pill" key={c}>{c}</span>
            ))}
          </div>
        </div>

        <div className="hero-showcase">
          {SHOWCASE_ITEMS.map((item) => (
            <div className="showcase-card" key={item.title}>
              <div className="showcase-cover" style={{ background: item.cover }} />
              <div className="showcase-title" style={{ background: item.cover }}>{item.title}</div>
              <div className="showcase-stats">
                {item.stats.map((s) => (
                  <div className="showcase-stat" key={s.label}>
                    <span>{s.label}</span>
                    <span>{s.value}</span>
                  </div>
                ))}
              </div>
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
            <div className="trophy-grid" style={{ marginBottom: 0, gridTemplateColumns: '1fr' }}>
              <div className="trophy trophy-earned trophy-bronze">
                <div className="trophy-icon" aria-hidden="true" />
                <div className="trophy-body">
                  <div className="trophy-name">First Pickup</div>
                  <div className="trophy-tier">Bronze</div>
                </div>
              </div>
              <div className="trophy trophy-earned trophy-gold">
                <div className="trophy-icon" aria-hidden="true" />
                <div className="trophy-body">
                  <div className="trophy-name">Centurion</div>
                  <div className="trophy-tier">Gold</div>
                </div>
              </div>
            </div>
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
          </div>
          <div className="value-visual">
            <div className="leaderboard-row">
              <div className="leaderboard-rank">1</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Elden Ring</div>
              <div className="sub" style={{ margin: 0 }}>412 owners</div>
            </div>
            <div className="leaderboard-row">
              <div className="leaderboard-rank">2</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>The Last of Us</div>
              <div className="sub" style={{ margin: 0 }}>388 owners</div>
            </div>
            <div className="leaderboard-row" style={{ marginBottom: 0 }}>
              <div className="leaderboard-rank">3</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Amazing Spider-Man #300</div>
              <div className="sub" style={{ margin: 0 }}>301 owners</div>
            </div>
          </div>
        </div>
      </div>

      <div className="cta-band">
        <div className="cta-band-title">Ready to catalog your collection?</div>
        <div className="cta-band-text">It's free, takes a minute to set up, and your shelf is yours to make public or keep private.</div>
        <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 22px', display: 'inline-block' }}>
          Create your shelf
        </Link>
      </div>
    </main>
  );
}
