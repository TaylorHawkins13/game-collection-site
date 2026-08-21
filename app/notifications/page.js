import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { describeNotification } from '@/lib/notificationTypes';

const PAGE_SIZE = 50;

export async function generateMetadata() {
  return {
    title: 'Notifications',
    robots: { index: false }, // a signed-in-only history view, nothing worth indexing
  };
}

// The full notification history — closes the gap flagged in ROADMAP.md:
// NotificationBell.jsx's dropdown only ever shows the most recent 30
// rows, and now that old rows get purged after 180 days (see
// lib/notificationCleanup.js), anything past both the last-30 cutoff and
// the retention window is gone for good. This page shows everything
// still in the table, 50 at a time via a "before" cursor on created_at
// (a plain link, not client-side pagination — this is a simple
// chronological list, no reason to ship JS for it).
//
// Respects the same per-category mute (profiles.muted_notification_types,
// lib/notificationTypes.js) NotificationBell.jsx already does — a muted
// type stays hidden here too, not just in the dropdown. Opening this page
// marks whatever's shown as read, same as opening the bell.
export default async function NotificationsPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, muted_notification_types')
    .eq('id', user.id)
    .single();

  const muted = profile?.muted_notification_types || [];
  const before = searchParams?.before || null;

  let query = supabase
    .from('notifications')
    .select(
      '*, actor:profiles!notifications_actor_id_fkey(username, display_name), achievement:achievement_defs!notifications_trophy_key_fkey(name, tier), game:games(title)'
    )
    .eq('user_id', user.id);
  if (muted.length) query = query.not('type', 'in', `(${muted.join(',')})`);
  if (before) query = query.lt('created_at', before);

  const { data: rows } = await query.order('created_at', { ascending: false }).limit(PAGE_SIZE);
  const notifications = rows || [];

  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length) {
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  }

  // Only offer "Load more" once a full page came back — a short page
  // means this was the last one, so there's nothing left to page into.
  const hasMore = notifications.length === PAGE_SIZE;
  const nextBefore = hasMore ? notifications[notifications.length - 1].created_at : null;

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Notifications</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Full history — the bell only shows the most recent 30. Rows older than 180 days are cleaned up
        automatically and won&apos;t appear here either.
      </p>

      {notifications.length === 0 && !before ? (
        <div className="empty-state">
          <div>No notifications yet.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {notifications.map((n) => {
            const { text, href } = describeNotification(n, profile?.username);
            const row = (
              <div className="notif-row" key={n.id}>
                <div>{text}</div>
                <div className="sub" style={{ margin: 0 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            );
            return href ? (
              <Link href={href} key={n.id} className="notif-row-link">
                {row}
              </Link>
            ) : (
              row
            );
          })}
        </div>
      )}

      {hasMore && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href={`/notifications?before=${encodeURIComponent(nextBefore)}`} className="btn-ghost">
            Load more
          </Link>
        </div>
      )}
    </main>
  );
}
