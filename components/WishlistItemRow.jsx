'use client';

import { useState } from 'react';
import CategoryIcon from './CategoryIcon';
import { getStatRows } from './GameCard';

// See ROADMAP.md "Gift list items have no priority/ranking" — same
// labels GameCard uses for the badge, duplicated here rather than
// imported since GameCard doesn't export them.
const WISHLIST_PRIORITY_LABELS = { 1: 'High priority', 2: 'Medium priority', 3: 'Low priority' };

// A deliberately lightweight row, built specifically for the public
// gift-list page (app/u/[username]/wishlist/page.js) — NOT the same
// GameCard used everywhere else on the site. Reported directly ("the
// layout of that gift list page needs work, its bad", Sep 2026):
// reusing GameCard's full trading-card-slab styling here (the "SHELF
// LIFE" cert header, a 4-6 row stat block, a "WISHLIST" flag that's
// pointless when the entire page already is the wishlist) was a lot of
// visual weight for what this page actually needs to do — let a friend
// or family member glance at a small cover, read what something is, and
// get straight to a real place to buy it. Also fixed alongside this:
// the buy links used to open in a new tab/window (`target="_blank"`),
// which the wrapped iOS app's bare WKWebView has no way to actually
// create — confirmed directly (Sep 2026) that this was sending people
// back to the app's home page instead of to eBay/Amazon. Same-tab
// navigation through `/go` (see lib/externalListings.js's goUrl()) is
// what `/go` was actually built for — its own history-entry trick is
// what makes "back" work with zero reliance on new-tab/window support,
// exactly the bare-WKWebView case this page needs to work in.
//
// `subtitle` reuses GameCard's own exported getStatRows rather than
// duplicating its per-item-type field logic — the first non-rating row
// is always that type's single most useful descriptor (platform for
// games, artist for vinyl, series/issue for comics, set for trading
// cards, and so on — see getStatRows itself), which is plenty for a
// one-line "what is this," without repeating the full stat block a
// shopper here doesn't need.
export default function WishlistItemRow({ game, currency, ebayHref, amazonHref }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const statRows = getStatRows(game, currency);
  const subtitle = statRows.find((row) => !row.isRating);

  return (
    <div className="wishlist-row">
      <div className="wishlist-row-cover">
        {game.cover && !coverFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.cover} alt={game.title} onError={() => setCoverFailed(true)} />
        ) : (
          <div className="wishlist-row-cover-placeholder">
            <CategoryIcon type={game.item_type} size={22} className="cover-placeholder-icon" />
          </div>
        )}
      </div>
      <div className="wishlist-row-body">
        <div className="wishlist-row-title">{game.title}</div>
        {subtitle && (
          <div className="wishlist-row-subtitle">
            {subtitle.label}: {subtitle.value}
          </div>
        )}
        {game.wishlist_priority && (
          <span className={`badge tag priority-${game.wishlist_priority}`}>
            {WISHLIST_PRIORITY_LABELS[game.wishlist_priority]}
          </span>
        )}
      </div>
      {(ebayHref || amazonHref) && (
        <div className="wishlist-row-buy">
          {ebayHref && (
            <a href={ebayHref} rel="sponsored">
              Buy on eBay
            </a>
          )}
          {amazonHref && (
            <a href={amazonHref} rel="sponsored">
              Search Amazon
            </a>
          )}
        </div>
      )}
    </div>
  );
}
