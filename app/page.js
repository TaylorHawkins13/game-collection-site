import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container">
      <div className="hero">
        <h1>Track your game collection. Show it off.</h1>
        <p>
          GameShelf is a free way to catalog what you own, what you want, and what you've
          beaten — then share your shelf with other collectors and see how it stacks up.
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
        <div className="card" style={{ padding: 20 }}>
          <div className="card-body">
            <div className="card-title">📚 Full collection tracking</div>
            <div className="card-meta">
              Platforms, genres, condition, purchase price, play status, ratings, tags, and barcodes — all in one place.
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="card-body">
            <div className="card-title">🌐 Public profiles</div>
            <div className="card-meta">
              Share a link to your shelf. Other collectors can follow you and leave comments.
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="card-body">
            <div className="card-title">🏆 Community leaderboards</div>
            <div className="card-meta">
              See the most-owned games, the biggest collections, and what's trending right now.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
