import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import { buildComparison, trophyStats } from '@/lib/collectionCompare';
import CompareClient from './CompareClient';

export async function generateMetadata({ params }) {
  const { username } = params;
  return {
    title: `Compare with @${username}`,
    robots: { index: false }, // a signed-in-only comparison view, nothing worth indexing
  };
}

export default async function ComparePage({ params }) {
  const { username } = params;
  const supabase = createClient();

  const { data: { user: viewer } } = await supabase.auth.getUser();
  if (!viewer) {
    redirect('/login');
  }

  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  if (!target) notFound();

  // Comparing yourself to yourself isn't useful — send back to your own profile.
  if (target.id === viewer.id) {
    redirect(`/u/${username}`);
  }

  if (!target.is_public) {
    return (
      <main className="container">
        <h1 style={{ marginTop: 20 }}>Compare collections</h1>
        <div className="empty-state">
          <div>@{target.username}'s shelf is private, so it can't be compared.</div>
        </div>
      </main>
    );
  }

  const [
    { data: myProfile },
    { data: myGames },
    { data: theirGames },
    { data: achievementDefs },
    { data: myEarned },
    { data: theirEarned },
  ] = await Promise.all([
    supabase.from('profiles').select('username, display_name, avatar_url').eq('id', viewer.id).single(),
    supabase.from('games').select('*').eq('user_id', viewer.id),
    supabase.from('games').select('*').eq('user_id', target.id),
    supabase.from('achievement_defs').select('*'),
    supabase.from('user_achievements').select('key').eq('user_id', viewer.id),
    supabase.from('user_achievements').select('key').eq('user_id', target.id),
  ]);

  const { shared, onlyMine, onlyTheirs } = buildComparison(myGames, theirGames);
  const myTrophyStats = trophyStats(achievementDefs, (myEarned || []).map((r) => r.key));
  const theirTrophyStats = trophyStats(achievementDefs, (theirEarned || []).map((r) => r.key));

  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Compare collections</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        {myProfile?.display_name || myProfile?.username || 'You'} vs{' '}
        <Link href={`/u/${target.username}`}>{target.display_name || target.username}</Link> — based on owned items
        only.
      </p>
      <CompareClient
        me={{ label: myProfile?.display_name || myProfile?.username || 'You', trophies: myTrophyStats }}
        them={{ label: target.display_name || target.username, trophies: theirTrophyStats, username: target.username }}
        shared={shared}
        onlyMine={onlyMine}
        onlyTheirs={onlyTheirs}
      />
    </main>
  );
}
