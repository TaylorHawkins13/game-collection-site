import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import FollowButton from './FollowButton';
import RefreshPricesButton from './RefreshPricesButton';
import ProfileTabs from './ProfileTabs';
import ShareProfileButton from '@/components/ShareProfileButton';
import ShowcaseButton from '@/components/ShowcaseButton';
import ShowcaseSection from '@/components/ShowcaseSection';
import CustomListsButton from '@/components/CustomListsButton';
import ReportProfileButton from '@/components/ReportProfileButton';
import ActionMenu from '@/components/ActionMenu';
import GameCard from '@/components/GameCard';
import { estimateCollectionValue } from '@/lib/valueSnapshot';
import { formatMoney } from '@/lib/currency';

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
    { data: customLists },
    { data: rarityRows },
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
    canView
      ? supabase.from('custom_lists').select('*').eq('user_id', profile.id).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.rpc('trophy_rarity'),
  ]);

  const rarity = (rarityRows || []).reduce((acc, r) => {
    acc[r.key] = Number(r.pct);
    return acc;
  }, {});

  // Items per list — looked up from `games` (already fetched above) rather
  // than a second join query, since the whole collection's already in memory.
  let listsWithItems = [];
  if (canView && customLists && customLists.length) {
    const listIds = customLists.map((l) => l.id);
    const { data: listItems } = await supabase
      .from('custom_list_items')
      .select('list_id, game_id, sort_order')
      .in('list_id', listIds)
      .order('sort_order', { ascending: true });
    const gamesById = new Map((games || []).map((g) => [g.id, g]));
    const itemsByList = {};
    (listItems || []).forEach((it) => {
      const game = gamesById.get(it.game_id);
      if (!game) return;
      (itemsByList[it.list_id] ||= []).push(game);
    });
    listsWithItems = customLists
      .map((l) => ({ ...l, items: itemsByList[l.id] || [] }))
      .filter((l) => l.items.length > 0);
  }

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
  // Whether the "Gift list" link (app/u/[username]/wishlist) is worth
  // showing — for a viewer, only if there's actually something on it;
  // the owner always sees it, same as Showcase/Manage lists, since it
  // doubles as the entry point for "here's how to send this to someone."
  const wishlistCount = (games || []).filter((g) => g.ownership === 'wishlist').length;
  // Same blend DashboardClient's own "Collection value" stat uses: the
  // last eBay check where there is one, purchase price otherwise, digital
  // items excluded. Shown in the collector's own currency, not the
  // viewer's — it's their collection, their prices.
  const { total: collectionValue } = estimateCollectionValue(games || []);
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <FollowButton profileId={profile.id} initialFollowing={alreadyFollowing} />
            <ActionMenu label="More actions">
              <Link href={`/compare/${profile.username}`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                Compare collections
              </Link>
              {canView && owned > 0 && (
                <Link href={`/u/${profile.username}/mosaic`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                  Shelf mosaic
                </Link>
              )}
              {canView && wishlistCount > 0 && (
                <Link href={`/u/${profile.username}/wishlist`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                  Gift list
                </Link>
              )}
              {canView && <RefreshPricesButton games={games || []} currency={profile.currency} />}
              <ReportProfileButton profileId={profile.id} />
            </ActionMenu>
          </div>
        )}
        {isOwner && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <ShareProfileButton username={profile.username} itemCount={owned} />
            <Link href="/dashboard?settings=1" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Edit profile
            </Link>
            <ActionMenu label="More actions">
              {owned > 0 && (
                <Link href={`/u/${profile.username}/mosaic`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                  Shelf mosaic
                </Link>
              )}
              <Link href={`/u/${profile.username}/wishlist`} className="btn-ghost" style={{ textDecoration: 'none' }}>
                Gift list
              </Link>
              <ShowcaseButton userId={profile.id} />
              <CustomListsButton userId={profile.id} />
            </ActionMenu>
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
            <div className="stat">
              <div className="num">{formatMoney(collectionValue, profile.currency)}</div>
              <div className="label">Collection value</div>
            </div>
          </div>

          <ShowcaseSection
            showcaseGames={showcaseGames}
            allGames={games || []}
            currency={profile.currency}
            isOwner={isOwner}
            ownerName={profile.display_name || profile.username}
          />

          {listsWithItems.map((list) => (
            <div className="profile-list-block" key={list.id}>
              <h3 className="profile-list-heading">{list.name}</h3>
              <div className="grid">
                {list.items.map((g) => (
                  <GameCard key={g.id} game={g} currency={profile.currency} />
                ))}
              </div>
            </div>
          ))}

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
            rarity={rarity}
            comments={comments || []}
            canComment={!!viewer}
            profileId={profile.id}
            currency={profile.currency}
            ownerName={profile.display_name || profile.username}
            isOwnProfile={viewer?.id === profile.id}
          />
        </>
      )}
    </main>
  );
}
