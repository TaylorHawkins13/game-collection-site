import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isAdminViewer } from '@/lib/adminAuth';
import AdminReportsClient from './AdminReportsClient';

export const dynamic = 'force-dynamic';

// Private, unlinked admin page — same 404-not-"unauthorized" gating as
// /admin/articles, /admin/newsletter, and /admin/stats. The moderation
// queue for reports.js/api/reports — see report-migration.sql for why
// target_id has no foreign key: a report can outlive the comment or
// profile it pointed at, so this resolves each target defensively and
// falls back to "no longer exists" rather than crashing.
export default async function AdminReportsPage() {
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) redirect('/login');
  if (!isAdminViewer(viewer)) notFound();

  let reports = null;
  try {
    const admin = createAdminClient();
    const { data: reportRows } = await admin
      .from('reports')
      .select('id, target_type, target_id, reason, status, created_at, reviewed_at, reporter:profiles!reports_reporter_id_fkey(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(150);

    const rows = reportRows || [];
    const commentIds = [...new Set(rows.filter((r) => r.target_type === 'comment').map((r) => r.target_id))];
    const profileIds = [...new Set(rows.filter((r) => r.target_type === 'profile').map((r) => r.target_id))];

    const [{ data: commentRows }, { data: profileRows }] = await Promise.all([
      commentIds.length
        ? admin
            .from('comments')
            .select('id, body, profile_id, author:profiles!comments_author_id_fkey(username, display_name)')
            .in('id', commentIds)
        : Promise.resolve({ data: [] }),
      profileIds.length
        ? admin.from('profiles').select('id, username, display_name').in('id', profileIds)
        : Promise.resolve({ data: [] }),
    ]);

    const commentsById = new Map((commentRows || []).map((c) => [c.id, c]));
    const profilesById = new Map((profileRows || []).map((p) => [p.id, p]));

    reports = rows.map((r) => ({
      ...r,
      target: r.target_type === 'comment' ? commentsById.get(r.target_id) || null : profilesById.get(r.target_id) || null,
    }));
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not set yet — let the page render anyway
    // so the setup note is visible instead of a hard crash, same pattern
    // as every other admin page.
  }

  return <AdminReportsClient reports={reports || []} configured={reports !== null} />;
}
