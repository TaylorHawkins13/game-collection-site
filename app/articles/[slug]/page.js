import Link from 'next/link';
import { notFound } from 'next/navigation';
import StarRating from '@/components/StarRating';
import { ARTICLES } from '@/lib/articles';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }) {
  const article = ARTICLES.find((a) => a.slug === params.slug);
  return { title: article ? `${article.title} — Shelf Life` : 'Shelf Life' };
}

export default function ArticlePage({ params }) {
  const article = ARTICLES.find((a) => a.slug === params.slug);
  if (!article) notFound();

  return (
    <main className="container">
      <Link href="/articles" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        &larr; Reviews &amp; Articles
      </Link>

      <article className="article-detail">
        <div className="article-card-meta">
          <span className="category-pill">{article.type === 'review' ? 'Review' : 'Article'}</span>
          <span className="sub">
            {new Date(article.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} &middot; {article.author}
          </span>
        </div>
        <h1 className="article-detail-title">{article.title}</h1>
        <p className="article-detail-dek">{article.dek}</p>
        {article.type === 'review' && (
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
