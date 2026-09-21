'use client';

import Link from 'next/link';
import Image from 'next/image';

// A tile in the dashboard's "Wishlist matches" panel — one of the
// viewer's own wishlist items that a public collector they follow
// already owns (see wantlist-matches-migration.sql's
// find_wantlist_matches, closes ROADMAP.md's "Wantlist matching /
// trading"). Reuses .rec-card/.rec-cover/.rec-body/.rec-title/.rec-meta
// wholesale — same tile shape "Recommended for you" already uses, just
// linking to the collector's profile instead of opening Add Item, since
// there's no in-app trading/messaging system to hand off to yet (that's
// its own much bigger ROADMAP.md item).
//
// owned_copies > 1 folds in the roadmap line's second signal ("or a
// duplicate they might trade") into the same tile rather than a second
// feature: a collector who owns more than one copy of something on your
// wishlist is a real hint they might have a spare worth asking about.
export default function WantlistMatchCard({ match }) {
  const ownerName = match.owner_display_name || match.owner_username;
  return (
    <Link href={`/u/${match.owner_username}`} className="rec-card">
      {match.cover ? (
        <div className="rec-cover">
          <Image
            src={match.cover}
            alt={match.title}
            fill
            sizes="42px"
            style={{ objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.parentElement.outerHTML = '<div class="rec-cover placeholder">No Cover</div>';
            }}
            unoptimized={match.cover.startsWith('data:')}
          />
        </div>
      ) : (
        <div className="rec-cover placeholder">No Cover</div>
      )}
      <div className="rec-body">
        <div className="rec-title">{match.title}</div>
        <div className="rec-meta">
          {ownerName} owns this
          {Number(match.owned_copies) > 1 ? ` — ${match.owned_copies}×, maybe a spare` : ''}
        </div>
      </div>
    </Link>
  );
}
