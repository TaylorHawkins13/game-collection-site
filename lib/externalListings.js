// Navigates to a real marketplace listing page for a missing series
// entry — someone clicked a greyed-out cover specifically to see what
// it'd cost to fill the gap, so this takes them to the actual place to
// buy it instead of routing through this app's own Add Item form first
// (see CHANGELOG.md for the earlier prefill-based version this
// replaced).
//
// CeX, always — requested directly (Sep 2026): fixed pricing rather than
// eBay's auction/variable pricing is what most people actually want here.
// This used to check eBay first (via the same API the in-form "Check
// eBay price" button uses) and only fall back to CeX when eBay came up
// empty, specifically because CeX has no public API to check stock
// ahead of time — their own site's search endpoint 403s anything that
// isn't their own frontend. That's still true, which is exactly why
// there's no way to build the reverse "check CeX first, fall back to
// eBay" — CeX can't be probed at all, only linked to and left for the
// person to look at themselves. So rather than a real priority order,
// this just always goes to CeX. (`ebaySearchUrl` below is unused by this
// function now, but still backs the wishlist gift list's separate,
// always-both "Buy on eBay"/"Search Amazon" links — see
// lib/affiliateLinks.js — which weren't part of this request.)
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

// Navigates the CURRENT tab/window to a CeX search for `item`.
//
// Used to be openBestListingTab(): opened a blank new tab synchronously,
// checked eBay for listings via /api/ebay-price, then redirected that
// tab to eBay (if it had something) or CeX (otherwise) once the check
// resolved. Renamed and rewritten in two separate rounds since (see
// CHANGELOG.md for both): first to drop the new-tab dependency entirely
// (window.open() doesn't work in the wrapped iOS app's bare WKWebView —
// was showing a blank screen instead of a listing), navigating the
// current window via window.location.href instead; then to always go to
// CeX rather than checking eBay first, since CeX's fixed pricing is what
// most people actually want here and the eBay-first behavior wasn't
// asked for, it was just the only one of the two that could be checked
// programmatically. Still lands on /go first (see goUrl() above), not
// the CeX URL directly, so back still works the same way every other
// outbound listing link does.
export function goToBestListing(item, currency) {
  const query = buildPriceQuery(item);
  if (!query) return;
  const landingUrl = goUrl(cexSearchUrl(query, currency), 'CeX');
  if (typeof window !== 'undefined') {
    window.location.href = landingUrl;
  }
}
