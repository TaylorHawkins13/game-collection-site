// Affiliate-tagged "buy it" links for wishlist items — see ROADMAP.md
// "Affiliate 'buy it' links on wishlist items." Shown on the public gift
// list (/u/[username]/wishlist), which is the actual use case this was
// built for: a family member or friend deciding what to get someone gets
// a direct link to a real place to buy it, rather than routing through
// this app's own "Check eBay price" first.
//
// Both links work as plain, untracked search links even with neither
// program configured — the buy links themselves are a real feature on
// their own; the affiliate tracking on top is purely additive once
// NEXT_PUBLIC_EBAY_EPN_CAMPAIGN_ID / NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG are
// set (see README.md and .env.local.example). NEXT_PUBLIC_-prefixed
// (unlike EBAY_CLIENT_ID/etc.) because these need to reach the browser
// bundle to build the link — and because a campaign ID/associate tag
// isn't a secret; it's visible in the URL itself the moment anyone
// clicks it.
import { buildPriceQuery } from './marketPrice';
import { ebaySearchUrl } from './externalListings';

export function ebayBuyLink(item, currency) {
  const query = buildPriceQuery(item);
  // buildPriceQuery returns '' for digital copies (no eBay resale market
  // for them) — same reasoning "Check eBay price" already uses, reused
  // here rather than duplicated.
  if (!query) return null;
  const base = ebaySearchUrl(query, currency);
  const campaignId = process.env.NEXT_PUBLIC_EBAY_EPN_CAMPAIGN_ID;
  // eBay Partner Network's simplest supported form — appending `campid`
  // to any ebay.com search/listing URL attributes the click to that
  // campaign (developer.ebay.com/epn). No API key or OAuth needed for
  // this, unlike the "Check eBay price" button's actual price lookup.
  return campaignId ? `${base}&campid=${encodeURIComponent(campaignId)}` : base;
}

export function amazonBuyLink(item) {
  // Deliberately not gated on copy_type the way the eBay link above is —
  // Amazon genuinely does sell digital versions of a lot of what Shelf
  // Life tracks (games, books, movies, music), so a digital wishlist
  // item still gets a useful search here even when it gets no eBay link.
  const title = (item.title || '').trim();
  if (!title) return null;
  const tag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG;
  const params = new URLSearchParams({ k: title });
  if (tag) params.set('tag', tag);
  return `https://www.amazon.com/s?${params.toString()}`;
}
