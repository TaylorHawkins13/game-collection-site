// Builds direct links to real marketplace listing pages for a missing
// series entry — someone clicked a greyed-out cover specifically to see
// what it'd cost to fill the gap, so this opens the actual place to buy
// it (eBay, and CeX for the used/physical-media market) instead of
// routing through this app's own Add Item form first. See ROADMAP.md
// "Full series view" and CHANGELOG.md for the earlier prefill-based
// version this replaced — reported back directly as "just open the
// listing page" being more useful than an extra form to click through.
//
// Both are plain browsable search-results pages (not API calls) — no
// credentials needed, and nothing about the click depends on this app's
// own eBay API keys being configured (unlike the in-form "Check eBay
// price" button, which does need those).
import { marketplaceForCurrency } from './ebayMarketplace';

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

// Opens both in new tabs, called synchronously from a click handler so
// neither gets blocked as an unsolicited popup (browsers allow multiple
// window.open calls made directly inside the same user-gesture event).
export function openListingSearches(query, currency) {
  if (!query) return;
  window.open(ebaySearchUrl(query, currency), '_blank', 'noopener,noreferrer');
  window.open(cexSearchUrl(query, currency), '_blank', 'noopener,noreferrer');
}
