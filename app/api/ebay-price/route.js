import { NextResponse } from 'next/server';
import { currencyForMarketplace } from '@/lib/ebayMarketplace';

// eBay's Browse API needs an OAuth client-credentials token, same shape as
// the IGDB integration — the client secret stays server-side and the
// browser only ever talks to this route.
//
// Note on what this actually returns: eBay retired public access to
// "sold/completed listings" search years ago, so this can only see
// *current active* listings (mostly Buy It Now asking prices), not
// confirmed sale prices. It's a real market signal, but treat it as
// "what people are asking right now" rather than "what it sold for."

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('EBAY_NOT_CONFIGURED');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  });

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    // Logged server-side (visible in Vercel's function logs) since the
    // client only ever sees a generic "couldn't reach eBay" message —
    // the actual reason (bad credentials, disabled keyset, etc.) is in
    // eBay's response body here.
    const body = await res.text().catch(() => '');
    console.error('eBay OAuth token request failed', res.status, body);
    throw new Error('EBAY_AUTH_FAILED');
  }
  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a bit before it actually expires (tokens normally last ~2 hours).
  tokenExpiresAt = Date.now() + Math.max((data.expires_in || 7200) - 60, 60) * 1000;
  return cachedToken;
}

// Whitelisted so an arbitrary query param can't smuggle something odd into
// the header — only ever one of eBay's real marketplace IDs, or the US
// default.
const VALID_MARKETPLACES = new Set([
  'EBAY_US', 'EBAY_GB', 'EBAY_DE', 'EBAY_CA', 'EBAY_AU', 'EBAY_CH',
  'EBAY_AT', 'EBAY_BE', 'EBAY_ES', 'EBAY_FR', 'EBAY_HK', 'EBAY_IE',
  'EBAY_IT', 'EBAY_NL', 'EBAY_PL', 'EBAY_SG',
]);

// Listings containing these terms are almost never a fair-value match for
// a single copy of whatever's being priced: lots/bundles price by the
// group (not the one item), graded/slabbed copies (WATA/VGA/CGC) sell at a
// huge premium over a raw copy, and "bonus disc" bundles (a real thing for
// some GameCube games — e.g. Pokémon Colosseum shipped with a separate,
// much rarer Jirachi bonus disc some sellers bundle in) are effectively a
// different, rarer item. Left in the search results, a few of these can
// drag a small sample's average way up.
const MISMATCH_TERMS = [
  'lot of', ' lot ', 'bundle', 'bonus disc', 'graded', 'wata', 'vga', 'cgc',
  'reproduction', 'repro ', 'replacement case', 'case only', 'manual only',
  'disc only', 'read description',
];

function isLikelyMismatch(title) {
  const t = ` ${(title || '').toLowerCase()} `;
  return MISMATCH_TERMS.some((term) => t.includes(term));
}

function median(sortedNums) {
  const n = sortedNums.length;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ error: 'empty_query' }, { status: 400 });
  }
  const marketplaceParam = searchParams.get('marketplace');
  const marketplace = VALID_MARKETPLACES.has(marketplaceParam) ? marketplaceParam : 'EBAY_US';

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ q, limit: '50' });

    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': marketplace,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'search_failed' }, { status: 502 });
    }

    const data = await res.json();
    const items = data.itemSummaries || [];

    // Prefer fixed "Buy It Now" prices over live auction bids — a bid
    // mid-auction isn't a reliable stand-in for value, but if there
    // aren't enough fixed-price listings, fall back to everything.
    const fixedPriced = items.filter((it) => (it.buyingOptions || []).includes('FIXED_PRICE'));
    let pool = fixedPriced.length >= 3 ? fixedPriced : items;

    // Drop obvious mismatches (lots, bundles, graded slabs, bonus-disc
    // bundles, etc.) — but only if enough real listings survive, same
    // fallback shape as the fixed-price filter above.
    const filtered = pool.filter((it) => !isLikelyMismatch(it.title));
    if (filtered.length >= 3) pool = filtered;

    // Even within one marketplace, eBay mixes in cross-border listings
    // priced in a different currency (e.g. a US seller's listing showing
    // up on a EBAY_GB search, priced in USD, not GBP) — for a niche item
    // with little local inventory, those cross-border listings can even
    // outnumber the local ones. Averaging raw numbers together regardless
    // of currency produces a meaningless value, so only listings actually
    // priced in the currency this marketplace is supposed to represent
    // are used — not just whichever currency happens to be most common in
    // the results, since for a low-inventory item "most common" could
    // still be the wrong currency entirely.
    const expectedCurrency = currencyForMarketplace(marketplace);
    const currencyPool = pool.filter((it) => it.price?.currency === expectedCurrency);

    const prices = currencyPool
      .map((it) => parseFloat(it.price?.value))
      .filter((v) => !Number.isNaN(v) && v > 0);

    if (prices.length === 0) {
      // There may well be listings for this item — just none priced in
      // the marketplace's own currency. Reporting "no listings" here is
      // more honest than falling back to a different currency's price
      // and mislabeling it.
      return NextResponse.json({ count: 0 });
    }

    prices.sort((a, b) => a - b);
    const low = prices[0];
    const high = prices[prices.length - 1];
    // A median resists being dragged around by a couple of outlier
    // listings far more than a plain average does — important since the
    // pool here is small (up to 50 raw results) and still not perfectly
    // clean even after the mismatch filtering above.
    const typical = median(prices);
    const currency = expectedCurrency;

    return NextResponse.json({
      count: prices.length,
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      avg: Math.round(typical * 100) / 100,
      currency,
    });
  } catch (err) {
    if (err.message === 'EBAY_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'not_configured' });
    }
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
