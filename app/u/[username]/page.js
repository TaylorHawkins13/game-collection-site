import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import FollowButton from './FollowButton';
import ProfileTabs from './ProfileTabs';
import ShareProfileButton from '@/components/ShareProfileButton';
import ShowcaseButton from '@/components/ShowcaseButton';
import GameCard from '@/components/GameCard';

export async function generateMetadata({ params }) {
  const { username } = params;
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, is_public')
    .eq('username', username)
    .single();

  if (!profile) return { title: 'Collector not found' };

  const name = profile.display_name || profile.username;
  if (!profile.is_public) {
    return {
      title: `@${profile.username}`,
      description: `${name}'s shelf on Shelf Life is private.`,
      robots: { index: false },
    };
  }

  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('ownership', 'owned');

  const description =
    profile.bio ||
    `See ${name}'s collection on Shelf Life${count ? ` — ${count} item${count === 1 ? '' : 's'} and counting.` : '.'}`;

  return {
    title: `@${profile.username}`,
    description,
    openGraph: {
      title: `${name} (@${profile.username}) on Shelf Life`,
      description,
      type: 'profile',
      images: profile.avatar_url ? [profile.avatar_url] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} (@${profile.username}) on Shelf Life`,
      description,
    },
  };
}

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

  const [
    { data: games },
    { count: followerCount },
    { count: followingCount },
    { data: comments },
    { data: achievementDefs },
    { data: earnedAchievements },
  ] = await Promise.all([
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
    supabase.from('achievement_defs').select('*'),
    supabase.from('user_achievements').select('key').eq('user_id', profile.id),
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
  const showcaseGames = (games || [])
    .filter((g) => g.showcase_order != null)
    .sort((a, b) => a.showcase_order - b.showcase_order);

  // Real Xbox/PlayStation trophy/achievement stats — separate from the
  // Shelf Life collection-milestone trophies shown in the Trophies tab.
  // Only shown once someone's actually used the fields, so a collector
  // who's never touched this doesn't get a "0% average" callout.
  const trackedTrophyGames = (games || []).filter(
    (g) => g.item_type === 'game' && (g.trophy_platinum || g.trophy_completion != null)
  );
  const platinumCount = trackedTrophyGames.filter((g) => g.trophy_platinum).length;
  const avgCompletion =
    trackedTrophyGames.length > 0
      ? Math.round(
          trackedTrophyGames.reduce((sum, g) => sum + (g.trophy_platinum ? 100 : g.trophy_completion || 0), 0) /
            trackedTrophyGames.length
        )
      : null;

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
            @{profile.username} ·{' '}
            <Link href={`/u/${profile.username}/followers`} style={{ color: 'inherit' }}>
              {followerCount || 0} followers
            </Link>{' '}
            ·{' '}
            <Link href={`/u/${profile.username}/following`} style={{ color: 'inherit' }}>
              {followingCount || 0} following
            </Link>
          </div>
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
        </div>
        {viewer && !isOwner && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FollowButton profileId={profile.id} initialFollowing={alreadyFollowing} />
            <Link href={`/compare/${profile.username}`} className="btn-ghost" style={{ textDecoration: 'none' }}>
              Compare collections
            </Link>
          </div>
        )}
        {isOwner && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ShareProfileButton username={profile.username} itemCount={owned} />
            <ShowcaseButton userId={profile.id} />
            <Link href="/dashboard?settings=1" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Edit profile
            </Link>
          </div>
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
              <div className="label">Total items</div>
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

          {showcaseGames.length > 0 && (
            <div className="profile-showcase">
              <h3 className="profile-showcase-heading">Showcase</h3>
              <div className="grid showcase-grid">
                {showcaseGames.map((g) => (
                  <GameCard key={g.id} game={g} featured />
                ))}
              </div>
            </div>
          )}

          {trackedTrophyGames.length > 0 && (
            <div className="trophy-stats-panel">
              <h3 className="trophy-stats-heading">Xbox/PlayStation trophies &amp; achievements</h3>
              <div className="trophy-stats-row">
                <div className="trophy-stat">
                  <div className="num">{platinumCount}</div>
                  <div className="label">Platinum{platinumCount === 1 ? '' : 's'}</div>
                </div>
                <div className="trophy-stat">
                  <div className="num">{avgCompletion}%</div>
                  <div className="label">Avg completion</div>
                </div>
                <div className="trophy-stat">
                  <div className="num">{trackedTrophyGames.length}</div>
                  <div className="label">Games tracked</div>
                </div>
              </div>
            </div>
          )}

          <ProfileTabs
            games={games || []}
            achievementDefs={achievementDefs || []}
            earnedKeys={(earnedAchievements || []).map((r) => r.key)}
            comments={comments || []}
            canComment={!!viewer}
            profileId={profile.id}
          />
        </>
      )}
    </main>
  );
}
