import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import ProfileCard from '@/components/ProfileCard';

export default async function FollowersPage({ params }) {
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
    .select('follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)')
    .eq('following_id', profile.id)
    .order('created_at', { ascending: false });

  const followers = (rows || []).map((r) => r.follower).filter(Boolean);
  const name = profile.display_name || profile.username;

  return (
    <main className="container">
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <Link href={`/u/${profile.username}`} className="sub" style={{ textDecoration: 'none' }}>
          ← Back to {name}
        </Link>
      </div>
      <h1>{name}'s followers</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        {followers.length} follower{followers.length === 1 ? '' : 's'}
      </p>

      {followers.length === 0 ? (
        <div className="empty-state">
          <div>No followers yet.</div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {followers.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </main>
  );
}
