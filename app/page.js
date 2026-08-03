import Link from 'next/link';

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
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 40 }}>
        <div className="feature-card">
          <div className="feature-title">Every kind of collection</div>
          <div className="feature-text">
            Video games, comics, trading cards, vinyl, books, DVDs and CDs — each with its own tailored details, side by side in one shelf.
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-title">Public profiles &amp; trophies</div>
          <div className="feature-text">
            Share a link to your shelf, earn bronze-to-platinum trophies for milestones, and let other collectors follow you and leave comments.
          </div>
        </div>
        <div className="feature-card">
          <div className="feature-title">Community leaderboards</div>
          <div className="feature-text">
            See the most-owned items, the biggest collections, and what's trending right now.
          </div>
        </div>
      </div>
    </main>
  );
}
