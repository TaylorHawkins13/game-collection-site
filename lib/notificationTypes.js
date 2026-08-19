// The full set of notification types a signed-in user can individually
// mute — shared between DashboardClient.jsx's "Notifications" settings
// checkboxes and NotificationBell.jsx's read-time filtering, so the two
// can't quietly drift apart, and kept in sync with the `type in (...)`
// check constraint on the notifications table (supabase-schema.sql).
export const NOTIFICATION_TYPES = [
  { key: 'follow', label: 'New followers' },
  { key: 'comment', label: 'Comments on your profile' },
  { key: 'trophy', label: 'Trophies you earn' },
  { key: 'reaction', label: 'Reactions to your activity' },
  { key: 'price_drop', label: 'Wishlist price drops' },
];
