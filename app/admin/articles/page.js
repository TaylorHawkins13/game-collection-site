import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isAdminViewer } from '@/lib/adminAuth';
import AdminArticlesClient from './AdminArticlesClient';

export default async function AdminArticlesPage() {
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) redirect('/login');
  if (!isAdminViewer(viewer)) notFound();

  let submissions = [];
  try {
    // Admin client — needs to see every pending submission, not just the
    // viewer's own (the normal RLS-scoped client only shows a user their
    // own rows, by design).
    const admin = createAdminClient();
    const { data } = await admin
      .from('article_submissions')
      .select('id, type, title, dek, body, rating, status, created_at, reviewed_at, user_id, profile:profiles(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(100);
    submissions = data || [];
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set — let the page render anyway so
    // the setup note is visible instead of a hard crash.
  }

  return <AdminArticlesClient submissions={submissions} />;
}
