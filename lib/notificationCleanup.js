// Deletes notifications older than the retention window, regardless of
// read state — see ROADMAP.md "Notification rows are never cleaned up,
// muted or not." A muted notification type (profiles.muted_notification_
// types, see lib/notificationTypes.js) is filtered out of NotificationBell's
// queries entirely, so those rows are never marked read by anyone opening
// the bell — without a purge, a heavily-muted (or just old/inactive)
// account accumulates `notifications` rows forever with no other cleanup
// path. 180 days is generous on purpose: this is a bell inbox, not an
// email archive, so losing a very old unread "so-and-so followed you" is
// low-stakes, but there's no reason to be aggressive about it either.
//
// Folded into the existing daily process-account-deletions cron rather
// than adding a fifth cron job/vercel.json entry just for this — both are
// "quiet daily housekeeping that touches no one's actual collection data."
const RETENTION_DAYS = 180;

export async function purgeOldNotifications(admin) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await admin
    .from('notifications')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);
  if (error) {
    console.error('purgeOldNotifications: failed', error);
    return { error };
  }
  return { deleted: count || 0 };
}
