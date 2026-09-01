import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { WHATS_NEW } from '@/lib/whatsNew';
import StarRating from '@/components/StarRating';
import ReactionButton from '@/components/ReactionButton';
import WhatsNewList from '@/components/WhatsNewList';

export const metadata = {
  title: 'Feed',
  description: 'What the collectors you follow have recently added, finished, or rated.',
};

function verb(eventType) {
  if (eventType === 'added') return 'added';
  if (eventType === 'completed') return 'completed';
  if (eventType === 'rated') return 'rated';
  if (eventType === 'trophy') return 'earned the trophy';
  return eventType;
}

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: followRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);
  const followingIds = (followRows || []).map((r) => r.following_id);

  let events = [];
  if (followingIds.length > 0) {
    const { data } = await supabase
      .from('activity_events')
      .select(
        'id, user_id, event_type, created_at, actor:profiles!activity_events_user_id_fkey(username, display_name, avatar_url), game:games(title, cover, item_type, rating), trophy:achievement_defs(name, tier)'
      )
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(50);
    events = (data || []).filter((e) => e.actor && (e.game || (e.event_type === 'trophy' && e.trophy)));
  }

  // Reaction counts + whether the viewer reacted, per event — fetched as
  // one extra query and reduced client-side rather than a per-item
  // query, since a feed page is at most 50 events.
  let reactionsByEvent = {};
  if (events.length > 0) {
    const { data: reactions } = await supabase
      .from('activity_reactions')
      .select('event_id, user_id')
      .in('event_id', events.map((e) => e.id));
    reactionsByEvent = (reactions || []).reduce((acc, r) => {
      const entry = (acc[r.event_id] ||= { count: 0, reacted: false });
      entry.count += 1;
      if (r.user_id === user.id) entry.reacted = true;
      return acc;
    }, {});
  }

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Feed</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Recent activity from collectors you follow.
      </p>

      <div className="feed-layout">
        <div className="feed-main">
          {followingIds.length === 0 ? (
            <div className="empty-state">
              <div>You're not following anyone yet.</div>
              <p className="sub">
                <Link href="/players">Find some collectors</Link> to follow and their activity will show up here.
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div>No activity yet.</div>
              <p className="sub">Nothing to show yet — check back once the people you follow add or update items.</p>
            </div>
          ) : (
            events.map((e) => (
              <div className="feed-item" key={e.id}>
                <Link href={`/u/${e.actor.username}`} className="avatar feed-item-avatar">
                  {e.actor.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.actor.avatar_url} alt={e.actor.username} />
                  ) : (
                    (e.actor.display_name || e.actor.username || '?').slice(0, 1).toUpperCase()
                  )}
                </Link>
                <div className="feed-item-body">
                  <div>
                    <Link href={`/u/${e.actor.username}`} className="feed-item-name">
                      {e.actor.display_name || e.actor.username}
                    </Link>{' '}
                    {e.event_type === 'trophy' && e.trophy ? (
                      <>
                        {verb(e.event_type)}{' '}
                        <span className={`feed-trophy-dot tier-${e.trophy.tier}`} aria-hidden="true" />
                        <strong>{e.trophy.name}</strong>
                      </>
                    ) : (
                      <>
                        {verb(e.event_type)} <strong>{e.game.title}</strong>
                        {e.event_type === 'rated' && Number(e.game.rating) > 0 ? (
                          <span style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'middle' }}>
                            <StarRating value={Number(e.game.rating)} size={13} />
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="sub feed-item-time">{new Date(e.created_at).toLocaleDateString()}</div>
                </div>
                <ReactionButton
                  eventId={e.id}
                  eventOwnerId={e.user_id}
                  viewerId={user.id}
                  initialCount={reactionsByEvent[e.id]?.count || 0}
                  initialReacted={reactionsByEvent[e.id]?.reacted || false}
                />
              </div>
            ))
          )}
        </div>

        <div className="feed-sidebar">
          <h2 className="feed-sidebar-heading">What's new</h2>
          <WhatsNewList items={WHATS_NEW} />
        </div>
      </div>
    </main>
  );
}
