'use client';

// Small presentational bits for the leaderboard page. Split out into their
// own client component because CoverThumb uses an onError handler on the
// <img> tag — event handlers can't be passed to elements rendered directly
// inside a Server Component (app/leaderboard/page.js has no 'use client'
// and reads from Supabase server-side). That mistake doesn't show up in a
// local `next build` because /leaderboard is server-rendered per request
// rather than statically prerendered, so it only breaks once a real
// request actually renders the page in production.

export function CoverThumb({ cover, title, className = 'leaderboard-thumb' }) {
  return cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={cover}
      alt={title}
      onError={(e) => {
        e.currentTarget.outerHTML = `<div class="${className} placeholder">No Cover</div>`;
      }}
    />
  ) : (
    <div className={`${className} placeholder`}>No Cover</div>
  );
}

export function PersonAvatar({ avatarUrl, name }) {
  return (
    <div className="avatar leaderboard-avatar">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} />
      ) : (
        (name || '?').slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
