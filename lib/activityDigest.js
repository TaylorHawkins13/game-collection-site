// Backs the opt-in weekly activity digest email
// (app/api/cron/email-activity-digest — profiles.email_activity_digest_enabled,
// see activity-digest-migration.sql). Two halves: your own week (counts
// off activity_events, same table the trophy/completion/rating moments
// on your own profile already come from) and what the public collectors
// you follow have been up to (the same thing app/feed/page.js already
// shows on the page itself, just summarized instead of a live list).
// Reusing activity_events for both means the email can never quietly
// disagree with what /feed itself would show for the same week.
//
// Runs against the service-role client (see lib/supabaseAdmin.js), which
// bypasses RLS entirely — every query below is explicitly scoped by
// userId (your own activity) or restricted to `is_public = true`
// profiles (followed collectors' activity), the same discipline
// lib/accountBackup.js documents for the same reason. Deliberately two
// separate queries rather than one join-and-filter — keeps the "only
// public profiles" rule as a plain, readable `.eq('is_public', true)` on
// its own query instead of relying on PostgREST's embedded-table filter
// syntax working as expected in a context with no RLS backstop under it.
const DAYS = 7;
const MAX_FRIEND_EVENTS = 15;

function verbFor(eventType) {
  if (eventType === 'added') return 'added';
  if (eventType === 'completed') return 'completed';
  if (eventType === 'rated') return 'rated';
  if (eventType === 'trophy') return 'earned the trophy';
  return eventType;
}

export async function buildActivityDigest(admin, userId) {
  const sinceIso = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: ownEvents }, { data: followRows }] = await Promise.all([
    admin.from('activity_events').select('event_type').eq('user_id', userId).gte('created_at', sinceIso),
    admin.from('follows').select('following_id').eq('follower_id', userId),
  ]);

  const ownCounts = { added: 0, completed: 0, rated: 0, trophy: 0 };
  for (const e of ownEvents || []) {
    if (ownCounts[e.event_type] != null) ownCounts[e.event_type] += 1;
  }
  const ownTotal = ownCounts.added + ownCounts.completed + ownCounts.rated + ownCounts.trophy;

  const followingIds = (followRows || []).map((r) => r.following_id);
  let friendEvents = [];
  if (followingIds.length > 0) {
    const { data: publicProfiles } = await admin.from('profiles').select('id').in('id', followingIds).eq('is_public', true);
    const publicIds = (publicProfiles || []).map((p) => p.id);

    if (publicIds.length > 0) {
      const { data: events } = await admin
        .from('activity_events')
        .select(
          'id, event_type, created_at, actor:profiles!activity_events_user_id_fkey(username, display_name), game:games(title), trophy:achievement_defs(name, tier)'
        )
        .in('user_id', publicIds)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(MAX_FRIEND_EVENTS);

      friendEvents = (events || [])
        .filter((e) => e.actor && (e.game || (e.event_type === 'trophy' && e.trophy)))
        .map((e) => ({
          id: e.id,
          name: e.actor.display_name || e.actor.username,
          verb: verbFor(e.event_type),
          subject: e.event_type === 'trophy' && e.trophy ? e.trophy.name : e.game?.title,
        }));
    }
  }

  return {
    ownCounts,
    ownTotal,
    friendEvents,
    // Nothing worth emailing about — a quiet week for you and everyone
    // you follow. The cron route uses this to skip sending rather than
    // deliver an empty "nothing happened" email every single week.
    hasAnything: ownTotal > 0 || friendEvents.length > 0,
  };
}
