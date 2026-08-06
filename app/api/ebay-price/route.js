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
//
// The accessory terms below (case, skin, screen protector, etc.) fix a
// real bug: a console search like "Nintendo Switch 2" pulls back a flood
// of $8-15 cases/skins/docks/grips that sellers tag with the console's
// full name for search visibility. A bare title search has no way to tell
// those apart from an actual console listing, so without this filter they
// can dominate the pool and drag the median down to something like $11 for
// a console that actually sells for hundreds — confirmed happening for a
// Switch 2 console in this app. Fixed-price + mismatch filtering already
// falls back to the unfiltered pool if too few real listings survive, so
// this doesn't risk zeroing out results for a genuinely thin market.
// Kept type-agnostic on purpose — this route has no idea what kind of
// collectible it's pricing unless the caller says so (see itemType below),
// so anything in this base list has to be safe to filter out no matter
// what's being searched. "cover", "figure", "funko", etc. do NOT belong
// here: a comic listing legitimately says "Cover A", a Funko Pop price
// check would have every real result contain the word "Funko". Damaged/
// parts listings are safe across every type, though — a legitimately
// broken item sells for a fraction of a working one and isn't a fair
// "what's this worth" signal for any collectible.
const MISMATCH_TERMS = [
  'lot of', ' lot ', 'bundle', 'bonus disc', 'graded', 'wata', 'vga', 'cgc',
  'reproduction', 'repro ', 'replacement case', 'case only', 'manual only',
  'disc only', 'read description',
  'for parts', 'not working', 'spares or repair', 'faulty', 'as is',
  'parts only', 'for repair', 'cracked', 'damaged', 'defective',
  'no power', "won't turn on", 'wont turn on',
];

// Console-only: a search like "Nintendo Switch 2" pulls back a flood of
// $8-15 cases/skins/docks/grips that sellers tag with the console's full
// name for search visibility — real bug, confirmed dragging a console's
// reported price down to ~$11. These terms are deliberately bare/broad
// ('case' not just 'case for') since narrower phrase-matching still let
// enough through to keep the bug alive. Scoped to consoles specifically
// (not applied to other types) because several of these words are
// perfectly normal in a real listing title for other collectibles — a
// comic's "Cover A", a Funko Pop's own name containing "Funko", etc.
const CONSOLE_ACCESSORY_TERMS = [
  'case', 'skin', 'screen protector', 'tempered glass', 'dock', 'stand',
  'grip', 'cover', 'bag', 'pouch', 'sleeve', 'holder', 'mount', 'charger',
  'charging cable', 'carrying', 'joy-con', 'joycon', 'thumb grip',
  'screen guard', 'sticker', 'decal', 'cooling fan', 'accessory',
  'accessories', 'strap', 'stylus', 'keychain',
];

function isLikelyMismatch(title, itemType) {
  const t = ` ${(title || '').toLowerCase()} `;
  const terms = itemType === 'console' ? [...MISMATCH_TERMS, ...CONSOLE_ACCESSORY_TERMS] : MISMATCH_TERMS;
  return terms.some((term) => t.includes(term));
}

function median(sortedNums) {
  const n = sortedNums.length;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

async function fetchEbayItems(queryStr, marketplace, token) {
  // 100 rather than 50 — a bigger raw sample matters most for exactly the
  // case this file's accessory filter exists for: a popular console's
  // real listings can be outnumbered by cheap accessory listings, so a
  // small top-N page risks not containing enough genuine matches to clear
  // the >= 3 threshold below even after filtering. eBay's Browse API caps
  // a single page at 200; 100 is a reasonable buffer without doubling
  // response size for the common case where 50 was already plenty.
  const params = new URLSearchParams({ q: queryStr, limit: '100' });
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
  if (!res.ok) return { ok: false, items: [] };
  const data = await res.json();
  return { ok: true, items: data.itemSummaries || [] };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ error: 'empty_query' }, { status: 400 });
  }
  // The bare title alone, with none of the platform/completeness terms
  // tacked on — a fallback for when the full query is too narrow. eBay's
  // search wants every word to match, so stacking title + platform +
  // completeness can quietly return nothing even when the title alone has
  // plenty of listings (confirmed happening for a real item: "Pokemon
  // Pokopia Switch 2 CIB" found zero raw results, even though a plain
  // "Pokopia" search on eBay turns up plenty).
  const titleOnly = (searchParams.get('title') || '').trim();
  const marketplaceParam = searchParams.get('marketplace');
  const marketplace = VALID_MARKETPLACES.has(marketplaceParam) ? marketplaceParam : 'EBAY_US';
  const itemType = (searchParams.get('itemType') || '').trim();

  try {
    const token = await getAccessToken();

    let usedQuery = q;
    let { ok, items } = await fetchEbayItems(q, marketplace, token);
    if (!ok) {
      return NextResponse.json({ error: 'search_failed' }, { status: 502 });
    }
    console.log('eBay price search:', { q, marketplace, rawResultCount: items.length });

    if (items.length === 0 && titleOnly && titleOnly !== q) {
      const fallback = await fetchEbayItems(titleOnly, marketplace, token);
      if (fallback.ok) {
        items = fallback.items;
        usedQuery = titleOnly;
        console.log('eBay price search: fell back to bare title', {
          titleOnly,
          marketplace,
          rawResultCount: items.length,
        });
      }
    }

    // Prefer fixed "Buy It Now" prices over live auction bids — a bid
    // mid-auction isn't a reliable stand-in for value, but if there
    // aren't enough fixed-price listings, fall back to everything.
    const fixedPriced = items.filter((it) => (it.buyingOptions || []).includes('FIXED_PRICE'));
    let pool = fixedPriced.length >= 3 ? fixedPriced : items;

    // Drop obvious mismatches (lots, bundles, graded slabs, bonus-disc
    // bundles, etc.) — but only if enough real listings survive, same
    // fallback shape as the fixed-price filter above.
    const filtered = pool.filter((it) => !isLikelyMismatch(it.title, itemType));
    if (filtered.length >= 3) pool = filtered;

    // Even within one marketplace, eBay mixes in cross-border listings
    // priced in a different currency (e.g. a US seller's listing showing
    // up on a EBAY_GB search, priced in USD, not GBP) — for a niche item
    // with little local inventory, those cross-border listings can even
    // outnumber the local ones. Averaging raw numbers together regardless
    // of currency produces a meaningless value, so the math only ever
    // runs over listings that share one currency.
    //
    // Prefer the currency this marketplace is supposed to represent. But
    // if there's genuinely no local-currency inventory for this item —
    // real for anything niche/rare — showing nothing at all is worse than
    // showing an honestly-labeled price in whatever currency the actual
    // listings are in (the app already stores/displays market_price
    // alongside the currency it was checked in, precisely for this case).
    // So: fall back to whichever currency is most common among what's
    // left, and label the result with that currency rather than
    // pretending it's the marketplace's own.
    const expectedCurrency = currencyForMarketplace(marketplace);
    let currencyPool = pool.filter((it) => it.price?.currency === expectedCurrency);
    let currency = expectedCurrency;

    if (currencyPool.length === 0) {
      const currencyCounts = {};
      for (const it of pool) {
        const c = it.price?.currency;
        if (c) currencyCounts[c] = (currencyCounts[c] || 0) + 1;
      }
      const fallbackCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (fallbackCurrency) {
        currencyPool = pool.filter((it) => it.price?.currency === fallbackCurrency);
        currency = fallbackCurrency;
      }
    }

    const prices = currencyPool
      .map((it) => parseFloat(it.price?.value))
      .filter((v) => !Number.isNaN(v) && v > 0);

    if (prices.length === 0) {
      console.log('eBay price search: 0 usable prices after filtering', {
        usedQuery,
        rawResultCount: items.length,
        afterFixedPriceFilter: pool.length,
      });
      return NextResponse.json({ count: 0 });
    }

    prices.sort((a, b) => a - b);

    // Second, keyword-independent line of defense: title-matching can
    // never cover every way a mismatched/accessory/parts listing gets
    // worded, so also drop anything priced way below the pack. A listing
    // at under 20% of the rough median almost never a fair-value match for
    // the same item (it's an accessory, a broken unit, a part, a listing
    // error, etc.) — confirmed needed even after the console accessory
    // terms above, since no fixed word list catches every seller's
    // phrasing. Only kicks in with enough of a sample to make "the pack"
    // meaningful, and — same fallback shape as every filter above — only
    // applied if enough listings survive it.
    let priceFiltered = prices;
    if (prices.length >= 5) {
      const roughMedian = median(prices);
      const survivors = prices.filter((p) => p >= roughMedian * 0.2);
      if (survivors.length >= 3) priceFiltered = survivors;
    }

    const low = priceFiltered[0];
    const high = priceFiltered[priceFiltered.length - 1];
    // A median resists being dragged around by a couple of outlier
    // listings far more than a plain average does — important since the
    // pool here is small (up to 100 raw results) and still not perfectly
    // clean even after the filtering above.
    const typical = median(priceFiltered);

    console.log('eBay price search result:', {
      usedQuery,
      currency,
      count: prices.length,
      low,
      high,
      typical,
    });

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
