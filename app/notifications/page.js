import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { describeNotification, NOTIFICATION_TYPES } from '@/lib/notificationTypes';

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
// type stays hidden here too, not just in the dropdown, regardless of the
// type filter below (picking "Trophies" while trophies are muted still
// shows nothing — the mute is a standing preference, not overridden by a
// one-off filter pick). Opening this page marks whatever's shown as read,
// same as opening the bell.
//
// ?type=<key> narrows the list to one notification type — closes the gap
// flagged in ROADMAP.md right after this page shipped: the bell dropdown
// is short enough that one undifferentiated list is fine, but this page
// can run to hundreds of rows across months with no way to jump straight
// to, say, just comments. Plain links (?type=...), not a client-side
// dropdown, consistent with "Load more" already being a plain link here.
export default async function NotificationsPage({ searchParams }) {
  const sp = await searchParams;
  const supabase = await createClient();
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
  const before = sp?.before || null;
  const typeParam = sp?.type || '';
  const activeType = NOTIFICATION_TYPES.some((t) => t.key === typeParam) ? typeParam : '';

  let query = supabase
    .from('notifications')
    .select(
      '*, actor:profiles!notifications_actor_id_fkey(username, display_name), achievement:achievement_defs!notifications_trophy_key_fkey(name, tier), game:games(title)'
    )
    .eq('user_id', user.id);
  if (muted.length) query = query.not('type', 'in', `(${muted.join(',')})`);
  if (activeType) query = query.eq('type', activeType);
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
  const typeQS = activeType ? `&type=${encodeURIComponent(activeType)}` : '';

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Notifications</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Full history — the bell only shows the most recent 30. Rows older than 180 days are cleaned up
        automatically and won&apos;t appear here either.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <Link href="/notifications" className={`btn-ghost${activeType ? '' : ' active'}`}>
          All
        </Link>
        {NOTIFICATION_TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/notifications?type=${encodeURIComponent(t.key)}`}
            className={`btn-ghost${activeType === t.key ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {notifications.length === 0 && !before ? (
        <div className="empty-state">
          {/* A muted type looks identical to "never got one of these" without this —
              see ROADMAP.md: filtering to a type you've muted showed a plain "Nothing
              here yet" with no explanation. Points straight at the Notifications tab
              of Settings (DashboardClient.jsx's ?settingsTab= deep link) so unmuting
              is one click away instead of hunting for it. */}
          <div>
            {activeType && muted.includes(activeType) ? (
              <>
                You&apos;ve muted {NOTIFICATION_TYPES.find((t) => t.key === activeType)?.label.toLowerCase()} — that&apos;s
                why nothing shows up here.{' '}
                <Link href="/dashboard?settingsTab=notifications">Manage what notifies you</Link>.
              </>
            ) : activeType ? (
              'Nothing here for this type yet.'
            ) : (
              'No notifications yet.'
            )}
          </div>
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
          <Link href={`/notifications?before=${encodeURIComponent(nextBefore)}${typeQS}`} className="btn-ghost">
            Load more
          </Link>
        </div>
      )}
    </main>
  );
}
