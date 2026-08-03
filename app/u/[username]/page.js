import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import GameCard from '@/components/GameCard';
import FollowButton from './FollowButton';
import CommentSection from './CommentSection';

export default async function ProfilePage({ params }) {
  const { username } = params;
  const supabase = createClient();

  const { data: { user: viewer } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;
  const canView = profile.is_public || isOwner;

  const [{ data: games }, { count: followerCount }, { count: followingCount }, { data: comments }] = await Promise.all([
    canView
      ? supabase.from('games').select('*').eq('user_id', profile.id).order('title', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    canView
      ? supabase
          .from('comments')
          .select('id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name, avatar_url)')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ]);

  let alreadyFollowing = false;
  if (viewer && !isOwner) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewer.id)
      .eq('following_id', profile.id)
      .maybeSingle();
    alreadyFollowing = !!followRow;
  }

  const owned = (games || []).filter((g) => g.ownership === 'owned').length;
  const completed = (games || []).filter((g) => g.play_status === 'completed').length;

  return (
    <main className="container">
      <div className="profile-header" style={{ marginTop: 20 }}>
        <div className="avatar">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.username} />
          ) : (
            (profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{profile.display_name || profile.username}</div>
          <div className="profile-username">
            @{profile.username} · {followerCount || 0} followers · {followingCount || 0} following
          </div>
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
        </div>
        {viewer && !isOwner && (
          <FollowButton profileId={profile.id} initialFollowing={alreadyFollowing} />
        )}
      </div>

      {!canView ? (
        <div className="empty-state">
          <div>This collector's shelf is private.</div>
        </div>
      ) : (
        <>
          <div className="stats-bar">
            <div className="stat">
              <div className="num">{games.length}</div>
              <div className="label">Total games</div>
            </div>
            <div className="stat">
              <div className="num">{owned}</div>
              <div className="label">Owned</div>
            </div>
            <div className="stat">
              <div className="num">{completed}</div>
              <div className="label">Completed</div>
            </div>
          </div>

          {games.length === 0 ? (
            <div className="empty-state">
              <div>No games on this shelf yet.</div>
            </div>
          ) : (
            <div className="grid" style={{ marginBottom: 40 }}>
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}

          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Comments</h2>
          <CommentSection
            profileId={profile.id}
            initialComments={comments || []}
            canComment={!!viewer}
          />
        </>
      )}
    </main>
  );
}
