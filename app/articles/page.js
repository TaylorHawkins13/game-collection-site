import Link from 'next/link';
import StarRating from '@/components/StarRating';
import { ARTICLES } from '@/lib/articles';

export const metadata = {
  title: 'Reviews & Articles — Shelf Life',
};

export default function ArticlesIndexPage() {
  return (
    <main className="container">
      <div className="home-hub-greeting">
        <h1>Reviews &amp; Articles</h1>
        <p className="sub">Writing about the stuff worth collecting — from the Shelf Life team.</p>
      </div>

      <div className="article-list">
        {ARTICLES.map((a) => (
          <Link href={`/articles/${a.slug}`} key={a.slug} className="article-card">
            <div className="article-card-meta">
              <span className="category-pill">{a.type === 'review' ? 'Review' : 'Article'}</span>
              <span className="sub">{new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <h2 className="article-card-title">{a.title}</h2>
            <p className="article-card-dek">{a.dek}</p>
            {a.type === 'review' && (
              <div className="article-card-rating">
                <StarRating value={a.rating} size={16} />
              </div>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
