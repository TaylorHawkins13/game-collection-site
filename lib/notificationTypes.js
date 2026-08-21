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

// One row's display text + link, by type — moved out of
// NotificationBell.jsx so app/notifications/page.js (the "see all history"
// view — see ROADMAP.md "No way to see notification history beyond the
// last 30 in the bell") can render exactly the same wording instead of a
// second, driftable copy of this switch. Expects the same `*:profiles!...`
// / `achievement_defs` / `games` join shape both call sites already
// select.
export function describeNotification(n, ownUsername) {
  const actorName = n.actor?.display_name || n.actor?.username || 'Someone';
  if (n.type === 'follow') {
    return { text: `${actorName} followed you.`, href: n.actor?.username ? `/u/${n.actor.username}` : null };
  }
  if (n.type === 'comment') {
    return {
      text: `${actorName} commented on your profile.`,
      href: ownUsername ? `/u/${ownUsername}` : null,
    };
  }
  if (n.type === 'trophy') {
    const name = n.achievement?.name || 'a trophy';
    return { text: `You earned "${name}".`, href: ownUsername ? `/u/${ownUsername}` : null };
  }
  if (n.type === 'reaction') {
    return { text: `${actorName} reacted to your activity.`, href: '/feed' };
  }
  if (n.type === 'price_drop') {
    const title = n.game?.title || 'A wishlist item';
    // Deep-links straight to the item (DashboardClient.jsx's ?item=<id>
    // effect opens its detail view on load) instead of a bare /dashboard —
    // every other type here already links somewhere specific. Falls back
    // to /dashboard if game_id is missing for some reason, same as before.
    return { text: `${title} dropped in price.`, href: n.game_id ? `/dashboard?item=${n.game_id}` : '/dashboard' };
  }
  return { text: 'Something happened.', href: null };
}
