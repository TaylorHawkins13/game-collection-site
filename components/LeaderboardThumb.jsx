'use client';

import Image from 'next/image';

// Small presentational bits for the leaderboard page. Split out into their
// own client component because CoverThumb uses an onError handler on the
// <img> tag — event handlers can't be passed to elements rendered directly
// inside a Server Component (app/leaderboard/page.js has no 'use client'
// and reads from Supabase server-side). That mistake doesn't show up in a
// local `next build` because /leaderboard is server-rendered per request
// rather than statically prerendered, so it only breaks once a real
// request actually renders the page in production.
//
// Both switched from a raw <img> to next/image (Sept 2026, see ROADMAP.md's
// "App feels laggy" item) — every source here is a hotlinked third-party
// URL (IGDB, Open Library, Wikimedia, a collector's own avatar upload, etc.)
// that used to load at full original resolution with no lazy-loading.
// `fill` mode needs a sized, positioned ancestor instead of the img sizing
// itself directly, so `.leaderboard-thumb`/`.collectible-cover` (globals.css)
// now also carry `position: relative; overflow: hidden` and apply to this
// wrapper div instead of to the image tag directly — CoverThumb's className
// prop is unchanged, so every existing caller (leaderboard rows, the podium,
// app/collectible/page.js's detail header) picks this up automatically.

export function CoverThumb({ cover, title, className = 'leaderboard-thumb' }) {
  return cover ? (
    <div className={className}>
      <Image
        src={cover}
        alt={title}
        fill
        sizes="140px"
        style={{ objectFit: 'cover' }}
        onError={(e) => {
          e.currentTarget.parentElement.outerHTML = `<div class="${className} placeholder">No Cover</div>`;
        }}
        // A handful of real rows store `cover` as a data: URI rather than
        // a real URL (an old aborted-upload edge case) — next/image's
        // remote loader can't handle those.
        unoptimized={cover.startsWith('data:')}
      />
    </div>
  ) : (
    <div className={`${className} placeholder`}>No Cover</div>
  );
}

export function PersonAvatar({ avatarUrl, name }) {
  return (
    <div className="avatar leaderboard-avatar">
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill sizes="72px" style={{ objectFit: 'cover' }} />
      ) : (
        (name || '?').slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
