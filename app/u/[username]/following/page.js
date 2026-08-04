import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import ProfileCard from '@/components/ProfileCard';

export default async function FollowingPage({ params }) {
  const { username } = params;
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  // Follow relationships are readable regardless of profile privacy (same
  // as the follower/following counts already shown on the profile page),
  // so this doesn't need the same public/owner gate the collection itself
  // does.
  const { data: rows } = await supabase
    .from('follows')
    .select('followee:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)')
    .eq('follower_id', profile.id)
    .order('created_at', { ascending: false });

  const following = (rows || []).map((r) => r.followee).filter(Boolean);
  const name = profile.display_name || profile.username;

  return (
    <main className="container">
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <Link href={`/u/${profile.username}`} className="sub" style={{ textDecoration: 'none' }}>
          ← Back to {name}
        </Link>
      </div>
      <h1>{name} is following</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        {following.length} following
      </p>

      {following.length === 0 ? (
        <div className="empty-state">
          <div>Not following anyone yet.</div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {following.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </main>
  );
}
