import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseServer';
import ShareProfileButton from '@/components/ShareProfileButton';
import GameCard from '@/components/GameCard';

// A separate, lightweight link that shows only the wishlist — not the
// whole collection — for sending to family/friends around birthdays or
// holidays (see ROADMAP.md "Shareable public wishlist / gift-list link").
// Before this, the only way to see someone's wishlist was the full
// profile's Collection tab, mixed in alongside everything they already
// own, which is a lot to hand someone who just wants "what should I get
// them."
//
// Visible if the full profile is public (is_public), OR if
// wishlist_public is on — a separate opt-in for sharing just the gift
// list while keeping the rest of the collection private (see
// ROADMAP.md/CHANGELOG.md: this used to be tied to is_public alone).
// Enforcing this for real requires the matching games RLS policy widening
// in supabase-schema.sql — this page's own canView check is a UI
// convenience, not the actual security boundary.
export async function generateMetadata({ params }) {
  const { username } = params;
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, is_public, wishlist_public')
    .eq('username', username)
    .single();

  if (!profile) return { title: 'Collector not found' };

  const name = profile.display_name || profile.username;
  if (!profile.is_public && !profile.wishlist_public) {
    return {
      title: `@${profile.username}'s gift list`,
      description: `${name}'s gift list on Shelf Life is private.`,
      robots: { index: false },
    };
  }

  return {
    title: `${name}'s gift list`,
    description: `See what ${name} is hoping to get next — a wishlist, straight from their Shelf Life collection.`,
    openGraph: {
      title: `${name}'s gift list on Shelf Life`,
      description: `See what ${name} is hoping to get next.`,
      type: 'website',
    },
  };
}

export default async function WishlistPage({ params }) {
  const { username } = params;
  const supabase = createClient();

  const { data: { user: viewer } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_public, wishlist_public, currency')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  const isOwner = viewer?.id === profile.id;
  const canView = profile.is_public || profile.wishlist_public || isOwner;
  // Whether the full profile at /u/[username] is worth linking to — a
  // gift list shared via wishlist_public alone (profile otherwise
  // private) has nowhere useful to send that link, so it's left out
  // rather than pointing at a page that will just say "private."
  const canViewFullProfile = profile.is_public || isOwner;

  const { data: wishlistItems } = canView
    ? await supabase
        .from('games')
        .select('*')
        .eq('user_id', profile.id)
        .eq('ownership', 'wishlist')
        .order('title', { ascending: true })
    : { data: [] };

  const name = profile.display_name || profile.username;

  return (
    <main className="container">
      <div className="profile-header" style={{ marginTop: 20 }}>
        <div className="avatar">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.username} />
          ) : (
            (name || '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="profile-name">{name}&apos;s gift list</div>
          <div className="profile-username">
            {canViewFullProfile ? (
              <Link href={`/u/${profile.username}`} style={{ color: 'inherit' }}>
                @{profile.username} — full profile
              </Link>
            ) : (
              `@${profile.username}`
            )}
          </div>
        </div>
        {canView && (
          <ShareProfileButton
            username={profile.username}
            path={`/u/${profile.username}/wishlist`}
            text={`Here's my gift list on Shelf Life — everything I'm hoping to get next.`}
            label="Share gift list"
          />
        )}
      </div>

      {!canView ? (
        <div className="empty-state">
          <div>This collector's shelf is private.</div>
        </div>
      ) : (wishlistItems || []).length === 0 ? (
        <div className="empty-state">
          <div>{isOwner ? "Nothing on your wishlist yet — mark an item as \"Wishlist\" and it'll show up here." : `${name} doesn't have anything on their wishlist right now.`}</div>
        </div>
      ) : (
        <div className="grid" style={{ marginTop: 8, marginBottom: 40 }}>
          {(wishlistItems || []).map((g) => (
            <GameCard key={g.id} game={g} currency={profile.currency} />
          ))}
        </div>
      )}
    </main>
  );
}
