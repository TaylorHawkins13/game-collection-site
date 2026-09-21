import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabaseServer';
import ShareProfileButton from '@/components/ShareProfileButton';
import WishlistItemRow from '@/components/WishlistItemRow';
import { ebayBuyLink, amazonBuyLink } from '@/lib/affiliateLinks';
import { goUrl } from '@/lib/externalListings';

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
  const { username } = await params;
  const supabase = await createClient();
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
  const { username } = await params;
  const supabase = await createClient();

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
        // High priority first (see ROADMAP.md "Gift list items have no
        // priority/ranking") — unranked items (null) sort to the end
        // rather than mixing in wherever their title happens to fall, so
        // whoever's shopping sees "get this one first" items up top.
        .order('wishlist_priority', { ascending: true, nullsFirst: false })
        .order('title', { ascending: true })
    : { data: [] };

  const name = profile.display_name || profile.username;

  return (
    <main className="container">
      <div className="profile-header" style={{ marginTop: 20 }}>
        <div className="avatar">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt={profile.username} fill sizes="72px" style={{ objectFit: 'cover' }} />
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
          <span className="empty-state-icon-badge"><Lock aria-hidden="true" /></span>
          <div>This collector's shelf is private.</div>
        </div>
      ) : (wishlistItems || []).length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon-badge"><Gift aria-hidden="true" /></span>
          <div>{isOwner ? "Nothing on your wishlist yet — mark an item as \"Wishlist\" and it'll show up here." : `${name} doesn't have anything on their wishlist right now.`}</div>
        </div>
      ) : (
        <div className="wishlist-list">
          {(wishlistItems || []).map((g) => {
            const ebayLink = ebayBuyLink(g, profile.currency);
            const amazonLink = amazonBuyLink(g, profile.currency);
            return (
              <WishlistItemRow
                key={g.id}
                game={g}
                currency={profile.currency}
                // Same-tab navigation deliberately — no target="_blank"
                // (see WishlistItemRow.jsx's comment): the wrapped iOS
                // app's bare WKWebView has no way to open a new tab/
                // window, and /go was already built to keep "back"
                // working without one. Confirmed directly (Sep 2026)
                // that target="_blank" here was sending people back to
                // the app's home page instead of to eBay/Amazon.
                ebayHref={ebayLink ? goUrl(ebayLink, 'eBay') : null}
                amazonHref={amazonLink ? goUrl(amazonLink, 'Amazon') : null}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
