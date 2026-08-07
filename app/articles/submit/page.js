import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import SubmitArticleForm from './SubmitArticleForm';

export const metadata = {
  title: 'Submit an Article — Shelf Life',
};

export default async function SubmitArticlePage() {
  const supabase = createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) redirect('/login');

  const { data: mine } = await supabase
    .from('article_submissions')
    .select('id, title, type, status, created_at')
    .eq('user_id', viewer.id)
    .order('created_at', { ascending: false });

  return (
    <main className="container">
      <Link href="/articles" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        &larr; Reviews &amp; Articles
      </Link>
      <SubmitArticleForm pastSubmissions={mine || []} />
    </main>
  );
}
