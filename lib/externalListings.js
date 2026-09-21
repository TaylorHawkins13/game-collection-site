// Navigates to a real marketplace listing page for a missing series
// entry — someone clicked a greyed-out cover specifically to see what
// it'd cost to fill the gap, so this takes them to the actual place to
// buy it instead of routing through this app's own Add Item form first
// (see CHANGELOG.md for the earlier prefill-based version this
// replaced).
//
// CeX where CeX actually stocks the item type, eBay everywhere else —
// fixed (Sep 2026, flagged directly: "obviously you cant buy things like
// books from cex"). This used to send every item type to CeX unconditionally
// (requested directly, an earlier round: fixed pricing rather than eBay's
// auction/variable pricing is what most people actually want when it's
// available) — a real gap for anything CeX doesn't carry, which turned
// out to be most of this app's item types, not just Books: checked
// against CeX's own support docs, its Play Store listing, and Wikipedia's
// description of the business (couldn't check their live site directly —
// it's a JS-rendered SPA this sandbox's fetch tooling can't execute), and
// every source consistently names the same handful of categories —
// games/consoles, phones, computers/electronics, DVDs/Blu-rays — with no
// mention anywhere of books, comics, trading cards, vinyl, CDs, VHS, or
// Funko Pops/toys. CEX_ITEM_TYPES below is deliberately conservative
// about it: only the three item types with real, repeated confirmation
// (game/console/dvd) stay on CeX; everything else falls back to eBay,
// which at least has real inventory across all of this app's collectible
// types even without CeX's fixed-pricing convenience. `vhs` is grouped
// with the unconfirmed set rather than folded in alongside `dvd` — CeX's
// own "DVDs and Blu-rays" language never mentions VHS, and it's enough of
// a legacy format that assuming it rides along on the same shelf space
// felt like the wrong side of "conservative" to guess on.
//
// CeX still can't be probed ahead of time either way — no public API,
// their own site's search endpoint 403s anything that isn't their own
// frontend — so this is still a one-shot redirect, not a real
// price-check, for whichever site an item type resolves to.
import { buildPriceQuery } from './marketPrice';
import { marketplaceForCurrency } from './ebayMarketplace';
import { SITE_URL } from './siteUrl';

// eBay's own site search has used this exact `/sch/i.html?_nkw=` shape
// for many years across every country site — just the domain changes.
const EBAY_DOMAIN_BY_MARKETPLACE = {
  EBAY_US: 'www.ebay.com',
  EBAY_GB: 'www.ebay.co.uk',
  EBAY_DE: 'www.ebay.de',
  EBAY_CA: 'www.ebay.ca',
  EBAY_AU: 'www.ebay.com.au',
  EBAY_CH: 'www.ebay.ch',
};

export function ebaySearchUrl(query, currency) {
  const marketplace = marketplaceForCurrency(currency);
  const domain = EBAY_DOMAIN_BY_MARKETPLACE[marketplace] || 'www.ebay.com';
  return `https://${domain}/sch/i.html?_nkw=${encodeURIComponent(query)}`;
}

// CeX (trading as WeBuy) has no US site at all — it's a UK-rooted chain
// with a handful of other country storefronts (Ireland, Spain, Poland,
// Australia, etc.), all on the same webuy.com search shape (confirmed
// via their robots.txt, which explicitly disallows crawling
// `/search*?stext=` — that's the real query param). Only currencies with
// an actual CeX storefront get their own subdomain; everything else
// (including USD, which CeX doesn't serve) falls back to the UK site —
// still a real, working search, just not necessarily local stock.
const CEX_SUBDOMAIN_BY_CURRENCY = {
  GBP: 'uk',
  EUR: 'ie',
  AUD: 'au',
};

export function cexSearchUrl(query, currency) {
  const subdomain = CEX_SUBDOMAIN_BY_CURRENCY[currency] || 'uk';
  return `https://${subdomain}.webuy.com/search?stext=${encodeURIComponent(query)}`;
}

// Every hostname anything in this app can ever send someone to externally
// (eBay's per-marketplace domains, CeX's per-region subdomains, plus
// Amazon — see lib/affiliateLinks.js) — the allowlist app/go/page.js
// checks an outgoing URL against before it ever redirects anywhere, so a
// crafted `/go?to=https://evil.example` link can't turn this app into an
// open redirector.
export const ALLOWED_REDIRECT_HOSTS = [
  ...new Set([
    ...Object.values(EBAY_DOMAIN_BY_MARKETPLACE),
    // 'uk' is also cexSearchUrl's fallback subdomain (used for any
    // currency not in this map), so 'uk.webuy.com' is already covered.
    ...Object.values(CEX_SUBDOMAIN_BY_CURRENCY).map((sub) => `${sub}.webuy.com`),
    'www.amazon.com',
  ]),
];

// Wraps an external destination in this app's own `/go` interstitial
// instead of linking to it directly. Why this exists: a plain new tab
// that jumps straight to eBay/CeX/Amazon has nothing of ours in its
// history, so its back button (or the iOS/Android back gesture) has
// nowhere useful to go — reported directly as "no way back" after
// visiting an eBay link, and confirmed to happen everywhere (desktop and
// mobile browsers, and the wrapped iOS app). Routing through `/go` first
// means that tab's history is [this app's own page, the external site],
// so back always lands somewhere in this app — and `/go` itself shows an
// explicit "Back to Shelf Life" link that works with zero reliance on
// browser back-button/gesture support at all, which matters for the
// wrapped iOS app (a bare WKWebView with no browser chrome — see
// app-store-xcode-walkthrough.md).
export function goUrl(externalUrl, label) {
  const params = new URLSearchParams({ to: externalUrl });
  if (label) params.set('label', label);
  return `${SITE_URL}/go?${params.toString()}`;
}

// Only these three item types have real, repeated confirmation of actual
// CeX stock (see the module comment above for the sources checked) —
// everything else in NUMBER_FIELD_BY_TYPE/CREATOR_FIELD_BY_TYPE's combined
// item-type list (comic, trading_card, vinyl, book, vhs, cd, funko_pop)
// falls back to eBay instead, which carries real inventory across every
// collectible type this app supports even without CeX's fixed-pricing
// convenience.
const CEX_ITEM_TYPES = new Set(['game', 'console', 'dvd']);

// Navigates the CURRENT tab/window to a marketplace search for `item` —
// CeX for the item types it's actually confirmed to stock, eBay for
// everything else (see CEX_ITEM_TYPES and the module comment above).
//
// Used to be openBestListingTab(): opened a blank new tab synchronously,
// checked eBay for listings via /api/ebay-price, then redirected that
// tab to eBay (if it had something) or CeX (otherwise) once the check
// resolved. Rewritten across three separate rounds since (see
// CHANGELOG.md for all three): first to drop the new-tab dependency
// entirely (window.open() doesn't work in the wrapped iOS app's bare
// WKWebView — was showing a blank screen instead of a listing),
// navigating the current window via window.location.href instead; then
// to always go to CeX rather than checking eBay first, since CeX's fixed
// pricing is what most people actually want here and the eBay-first
// behavior wasn't asked for, it was just the only one of the two that
// could be checked programmatically; then this round, splitting by item
// type instead of always CeX, since "always CeX" turned out to mean
// "usually a dead-end search on a site that's never carried this thing."
// Still lands on /go first (see goUrl() above) either way, not the
// destination URL directly, so back still works the same way every other
// outbound listing link does.
export function goToBestListing(item, currency) {
  const query = buildPriceQuery(item);
  if (!query) return;
  const useCex = CEX_ITEM_TYPES.has(item?.item_type);
  const landingUrl = useCex
    ? goUrl(cexSearchUrl(query, currency), 'CeX')
    : goUrl(ebaySearchUrl(query, currency), 'eBay');
  if (typeof window !== 'undefined') {
    window.location.href = landingUrl;
  }
}
