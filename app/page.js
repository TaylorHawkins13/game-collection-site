import Link from 'next/link';

const CATEGORIES = ['Video Games', 'Comics', 'Trading Cards', 'Vinyl Records', 'Books', 'DVDs', 'CDs'];

const FEATURES = [
  {
    title: 'Every kind of collection',
    text: 'Video games, comics, trading cards, vinyl, books, DVDs and CDs — each with its own tailored details (platforms, issue numbers, grades, pressings, and more), side by side in one shelf.',
  },
  {
    title: 'Trophies for your collection',
    text: "Earn bronze-to-platinum trophies for milestones like your first item, hitting 100 owned, or completing your first game — a trophy case shows on every public profile.",
  },
  {
    title: 'Public profiles & social',
    text: 'Share a link to your shelf, follow other collectors, and leave comments — or keep your collection private, it\'s your call.',
  },
  {
    title: 'Community leaderboards',
    text: "See the most-owned items, the biggest public collections, and what's trending across everyone's shelves right now.",
  },
  {
    title: 'Built for real collectors',
    text: 'Condition and grading fields, purchase price and date, your own currency, tags, barcodes, and cover art that pulls color into the card design.',
  },
  {
    title: 'Find your people',
    text: "Search for other collectors by name, browse who's active, and see how your shelf compares to theirs.",
  },
];

const STEPS = [
  { num: '1', title: 'Create your shelf', text: 'Sign up free and pick a username — your public profile is ready instantly.' },
  { num: '2', title: 'Add what you own', text: 'Log games, comics, cards, vinyl, books, DVDs, and CDs with the details that matter for each.' },
  { num: '3', title: 'Share & compete', text: 'Show off your shelf, earn trophies, follow other collectors, and climb the leaderboard.' },
];

const TROPHY_PREVIEW = [
  { tier: 'bronze', name: 'First Pickup' },
  { tier: 'silver', name: 'Double Digits' },
  { tier: 'gold', name: 'Centurion' },
  { tier: 'platinum', name: 'Platinum Shelf' },
];

export default function HomePage() {
  return (
    <main className="container">
      <div className="hero">
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

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 8 }}>
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-title">{f.title}</div>
            <div className="feature-text">{f.text}</div>
          </div>
        ))}
      </div>

      <section className="section-block">
        <h2 className="section-heading">How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.num}>
              <div className="step-num">{s.num}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-text">{s.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h2 className="section-heading">Earn trophies as you build your shelf</h2>
        <p className="section-sub">
          A PlayStation Trophies-style system, awarded automatically for real collection milestones.
        </p>
        <div className="trophy-grid" style={{ marginBottom: 0 }}>
          {TROPHY_PREVIEW.map((t) => (
            <div className={`trophy trophy-earned trophy-${t.tier}`} key={t.name}>
              <div className="trophy-icon" aria-hidden="true" />
              <div className="trophy-body">
                <div className="trophy-name">{t.name}</div>
                <div className="trophy-tier">{t.tier}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

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
