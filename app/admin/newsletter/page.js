import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isAdminViewer } from '@/lib/adminAuth';
import NewsletterForm from './NewsletterForm';

export default async function AdminNewsletterPage() {
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) redirect('/login');
  // 404 rather than a "not authorized" page — this route isn't linked
  // from anywhere in the UI, and a 404 doesn't confirm to a non-admin
  // visitor that an admin area exists at this path at all.
  if (!isAdminViewer(viewer)) notFound();

  // Admin client, not the session-scoped one above — the counts need to
  // include private profiles too, which the normal RLS-scoped client
  // wouldn't see.
  let optedInCount = 0;
  let totalCount = 0;
  try {
    const admin = createAdminClient();
    const [{ count: opted }, { count: total }] = await Promise.all([
      admin.from('profiles').select('*', { count: 'exact', head: true }).eq('newsletter_opt_in', true),
      admin.from('profiles').select('*', { count: 'exact', head: true }),
    ]);
    optedInCount = opted || 0;
    totalCount = total || 0;
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set yet — let the page render anyway
    // so the setup note is visible instead of a hard crash.
  }

  return <NewsletterForm optedInCount={optedInCount} totalCount={totalCount} />;
}
