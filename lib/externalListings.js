// Opens a real marketplace listing page for a missing series entry —
// someone clicked a greyed-out cover specifically to see what it'd cost
// to fill the gap, so this opens the actual place to buy it instead of
// routing through this app's own Add Item form first (see CHANGELOG.md
// for the earlier prefill-based version this replaced).
//
// eBay first, CeX as the fallback — deliberately not "open both": eBay
// has a real, official, already-integrated API (the same one the in-form
// "Check eBay price" button uses, via /api/ebay-price) so it's possible
// to actually check whether it has listings before opening a tab for it.
// CeX has no public API at all — the endpoint their own site uses
// internally 403s anything that isn't their own frontend, so there's no
// way to check it ahead of time, only to open a search page and let the
// person look for themselves. So: check eBay, open eBay if it has
// something, and fall back to opening a CeX search (not a guaranteed
// listing, just the best next place to look) only when eBay comes up
// empty or the check itself can't be completed (API not configured,
// network hiccup, etc. — same "can't tell, so default to the one thing
// that mostly works" logic).
import { buildPriceQuery } from './marketPrice';
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

// Opens one new tab for `item`: eBay if it has listings, CeX otherwise
// (including "couldn't check" — see ebayHasListings above). Opens a
// blank tab synchronously, before the async eBay check, so the eventual
// navigation isn't blocked as a popup (browsers only allow window.open
// without a fresh user gesture if the window handle was already created
// during one) — then redirects that same tab once the check resolves.
// `tab.opener = null` severs the reverse-tabnabbing risk of leaving the
// new tab able to reach back into this one, without losing the ability
// to redirect it (unlike passing 'noopener' to window.open, which also
// throws away the handle needed for that redirect).
export function openBestListingTab(item, currency) {
  const query = buildPriceQuery(item);
  if (!query) return;
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (tab) tab.opener = null;

  ebayHasListings(item, currency).then((hasListings) => {
    const url = hasListings === true ? ebaySearchUrl(query, currency) : cexSearchUrl(query, currency);
    if (tab && !tab.closed) {
      tab.location.href = url;
    } else {
      // Either window.open above was blocked (no handle to redirect), or
      // the person closed the blank tab before the check finished — try
      // opening the final URL directly as a last resort.
      window.open(url, '_blank');
    }
  });
}
