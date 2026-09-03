'use client';

import Link from 'next/link';
import FollowButton from '@/app/u/[username]/FollowButton';

// A tile in the dashboard's "Collectors you might like" panel — same
// shared-taste signal "Recommended for you" already uses for items,
// turned around to suggest people (see recommend-collectors-migration.sql,
// CHANGELOG.md). recommend_collectors already excludes anyone the viewer
// follows already, so FollowButton always starts unfollowed here.
export default function CollectorSuggestionCard({ collector }) {
  return (
    <div className="collector-suggestion-card">
      <Link
        href={`/u/${collector.username}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}
      >
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 16, flexShrink: 0 }}>
          {collector.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collector.avatar_url} alt="" />
          ) : (
            (collector.display_name || collector.username || '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {collector.display_name || collector.username}
          </div>
          <div className="sub" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
            {collector.shared_count} shared favorite{Number(collector.shared_count) === 1 ? '' : 's'}
          </div>
        </div>
      </Link>
      <FollowButton profileId={collector.user_id} initialFollowing={false} />
    </div>
  );
}
