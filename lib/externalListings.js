// Navigates to a real marketplace listing page for a missing series
// entry — someone clicked a greyed-out cover specifically to see what
// it'd cost to fill the gap, so this takes them to the actual place to
// buy it instead of routing through this app's own Add Item form first
// (see CHANGELOG.md for the earlier prefill-based version this
// replaced).
//
// eBay first, CeX as the fallback — deliberately not "check both": eBay
// has a real, official, already-integrated API (the same one the in-form
// "Check eBay price" button uses, via /api/ebay-price) so it's possible
// to actually check whether it has listings before sending someone
// there. CeX has no public API at all — the endpoint their own site uses
// internally 403s anything that isn't their own frontend, so there's no
// way to check it ahead of time, only to open a search page and let the
// person look for themselves. So: check eBay, go to eBay if it has
// something, and fall back to a CeX search (not a guaranteed listing,
// just the best next place to look) only when eBay comes up empty or the
// check itself can't be completed (API not configured, network hiccup,
// etc. — same "can't tell, so default to the one thing that mostly
// works" logic).
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

// Same /api/ebay-price route the in-form price checker uses — asks
// whether *any* usable listings exist for this search, not the actual
// price (nothing here needs low/avg/high, just yes-or-no). Returns null
// (not true/false) when the check itself couldn't be completed, so the
// caller can tell "confirmed nothing on eBay" apart from "couldn't ask."
async function ebayHasListings(item, currency) {
  const q = buildPriceQuery(item);
  if (!q) return null;
  try {
    const marketplace = marketplaceForCurrency(currency);
    const title = (item.title || '').trim();
    const res = await fetch(
      `/api/ebay-price?q=${encodeURIComponent(q)}&title=${encodeURIComponent(title)}&marketplace=${marketplace}&itemType=${encodeURIComponent(item.item_type || '')}`
    );
    const data = await res.json();
    if (data.error) return null;
    return (data.count || 0) > 0;
  } catch {
    return null;
  }
}

// Navigates the CURRENT tab/window to a listing for `item`: eBay if it
// has listings, CeX otherwise (including "couldn't check" — see
// ebayHasListings above).
//
// This used to be openBestListingTab(), which opened a blank new tab
// synchronously (before the async eBay check), then redirected that tab
// once the check resolved — the standard trick to dodge popup blockers,
// since window.open() called after an await (outside a "fresh user
// gesture") can get silently blocked in regular browsers. Reported
// directly (Sep 2026) as "test one just gives me a blank white screen"
// when tapping a missing series entry inside the wrapped iOS app: its
// bare WKWebView has no UIDelegate to actually create a new window for
// window.open() to hand back, so the call either returns null or a
// phantom window handle that's never attached to anything visible — the
// blank tab this was built around opening is, in that environment, just
// a blank screen that nothing ever navigates. Exactly the same root
// cause as the gift list's target="_blank" bug (see
// WishlistItemRow.jsx/globals.css), just reached through window.open()
// instead of an anchor tag.
//
// Fixed the same way: no new tab/window at all, same-tab navigation via
// window.location.href once the eBay check resolves, landing on /go
// first (see goUrl() above) so back still works — exactly what /go was
// built for. Desktop/browser users lose the "opens in a new tab,
// dashboard stays open behind it" convenience, but every call site
// (GameModal, ItemDetailModal, CatalogueClient) already used this
// fire-and-forget — none awaited it or used a return value — so nothing
// else needed to change.
export async function goToBestListing(item, currency) {
  const query = buildPriceQuery(item);
  if (!query) return;
  const hasListings = await ebayHasListings(item, currency);
  const isEbay = hasListings === true;
  const url = isEbay ? ebaySearchUrl(query, currency) : cexSearchUrl(query, currency);
  // Land on this app's own /go interstitial first, not the external URL
  // directly — see goUrl()'s comment above for why.
  const landingUrl = goUrl(url, isEbay ? 'eBay' : 'CeX');
  if (typeof window !== 'undefined') {
    window.location.href = landingUrl;
  }
}
