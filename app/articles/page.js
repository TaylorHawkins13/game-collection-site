import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import StarRating from '@/components/StarRating';
import { getAllArticles } from '@/lib/articles';

export const metadata = {
  title: 'Reviews & Articles — Shelf Life',
};

export default async function ArticlesIndexPage() {
  const supabase = createClient();
  const { data: approved } = await supabase
    .from('article_submissions')
    .select('id, type, title, dek, body, rating, created_at, reviewed_at, profile:profiles(username, display_name)')
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false });

  const articles = getAllArticles(approved || []);

  return (
    <main className="container">
      <div className="home-hub-greeting">
        <h1>Reviews &amp; Articles</h1>
        <p className="sub">Writing about the stuff worth collecting — from the Shelf Life team and the community.</p>
        <Link href="/articles/submit" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 10 }}>
          Submit your own
        </Link>
      </div>

      <div className="article-list">
        {articles.map((a) => (
          <Link href={`/articles/${a.slug}`} key={a.slug} className="article-card">
            <div className="article-card-meta">
              <span className="category-pill">{a.type === 'review' ? 'Review' : 'Article'}</span>
              {a.community && <span className="category-pill article-community-pill">Community</span>}
              <span className="sub">{new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <h2 className="article-card-title">{a.title}</h2>
            <p className="article-card-dek">{a.dek}</p>
            {a.type === 'review' && a.rating != null && (
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
