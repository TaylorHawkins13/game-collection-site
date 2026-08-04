import { NextResponse } from 'next/server';

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
    throw new Error('EBAY_AUTH_FAILED');
  }
  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a bit before it actually expires (tokens normally last ~2 hours).
  tokenExpiresAt = Date.now() + Math.max((data.expires_in || 7200) - 60, 60) * 1000;
  return cachedToken;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ error: 'empty_query' }, { status: 400 });
  }

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ q, limit: '50' });

    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
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
    const pool = fixedPriced.length >= 3 ? fixedPriced : items;

    const prices = pool
      .map((it) => parseFloat(it.price?.value))
      .filter((v) => !Number.isNaN(v) && v > 0);

    if (prices.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    prices.sort((a, b) => a - b);
    const low = prices[0];
    const high = prices[prices.length - 1];
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const currency = pool.find((it) => it.price?.currency)?.price?.currency || 'USD';

    return NextResponse.json({
      count: prices.length,
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      currency,
    });
  } catch (err) {
    if (err.message === 'EBAY_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'not_configured' });
    }
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
