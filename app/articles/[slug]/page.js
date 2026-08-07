import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import StarRating from '@/components/StarRating';
import { getAllArticles } from '@/lib/articles';

// Dynamic rather than statically generated — approved community
// submissions can appear at any time, not just at build/deploy time.
async function loadArticle(slug) {
  const supabase = createClient();
  const { data: approved } = await supabase
    .from('article_submissions')
    .select('id, type, title, dek, body, rating, created_at, reviewed_at, profile:profiles(username, display_name)')
    .eq('status', 'approved');
  return getAllArticles(approved || []).find((a) => a.slug === slug) || null;
}

export async function generateMetadata({ params }) {
  const article = await loadArticle(params.slug);
  return { title: article ? `${article.title} — Shelf Life` : 'Shelf Life' };
}

export default async function ArticlePage({ params }) {
  const article = await loadArticle(params.slug);
  if (!article) notFound();

  return (
    <main className="container">
      <Link href="/articles" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        &larr; Reviews &amp; Articles
      </Link>

      <article className="article-detail">
        <div className="article-card-meta">
          <span className="category-pill">{article.type === 'review' ? 'Review' : 'Article'}</span>
          {article.community && <span className="category-pill article-community-pill">Community</span>}
          <span className="sub">
            {new Date(article.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} &middot; {article.author}
          </span>
        </div>
        <h1 className="article-detail-title">{article.title}</h1>
        <p className="article-detail-dek">{article.dek}</p>
        {article.type === 'review' && article.rating != null && (
          <div className="article-card-rating" style={{ marginBottom: 8 }}>
            <StarRating value={article.rating} size={22} />
          </div>
        )}
        <div className="article-body">
          {article.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
