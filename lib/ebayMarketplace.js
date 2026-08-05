// Maps a profile's display currency to an eBay marketplace ID, so price
// checks search the local eBay site (ebay.co.uk for GBP, ebay.com.au for
// AUD, etc.) instead of always searching the US site. This is a rough
// proxy, not a real location lookup — several countries share a currency
// (the Eurozone all uses EUR), so EUR is aimed at eBay's biggest European
// site (Germany) rather than any one specific country. Currencies with no
// close eBay marketplace match (JPY, INR, BRL, etc.) fall back to the US
// site, which is still eBay's largest and most liquid market.
const CURRENCY_TO_MARKETPLACE = {
  USD: 'EBAY_US',
  GBP: 'EBAY_GB',
  EUR: 'EBAY_DE',
  CAD: 'EBAY_CA',
  AUD: 'EBAY_AU',
  CHF: 'EBAY_CH',
};

export function marketplaceForCurrency(currency) {
  return CURRENCY_TO_MARKETPLACE[currency] || 'EBAY_US';
}
