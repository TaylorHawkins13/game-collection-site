// Builds a search string tailored to the item type for eBay price lookups —
// a bare title finds a lot of unrelated junk, so tack on whatever extra
// detail narrows it down best for that type. Shared between the per-item
// "Check eBay price" button (GameModal) and the "Refresh all prices" bulk
// action (DashboardClient) so both search the same way.
// Completeness swings a game's real value hugely — a loose cart and a
// complete-in-box copy of the same game can be 3-5x apart in price — so
// it's worth folding into the search itself rather than just averaging
// across whatever eBay happens to return.
const COMPLETENESS_TERMS = {
  loose: 'loose',
  cib: 'CIB',
  box: 'box only',
};

export function buildPriceQuery(item) {
  const title = (item.title || '').trim();
  if (!title) return '';
  // Digital copies have no eBay resale market — nothing to search for, so
  // this quietly disables "Check eBay price" (and skips them in "Refresh
  // all prices") for anything marked digital, everywhere buildPriceQuery
  // is used. Doesn't apply to consoles or Funko Pops — those are always
  // physical, and the Copy field doesn't even show for either type, but
  // the underlying copy_type can briefly still hold a stale 'digital'
  // value from before the item's Type was switched (cleared for real on
  // save).
  const alwaysPhysical = item.item_type === 'console' || item.item_type === 'funko_pop';
  if (item.copy_type === 'digital' && !alwaysPhysical) return '';

  const parts = [title];
  if (item.item_type === 'game' || item.item_type === 'console') {
    if (item.item_type === 'game' && item.platforms?.[0]) parts.push(item.platforms[0]);
    // Completeness (loose/CIB/box only) is common marketplace shorthand
    // sellers actually write in their listing titles, so it's safe to
    // search on directly.
    if (item.completeness && COMPLETENESS_TERMS[item.completeness]) {
      parts.push(COMPLETENESS_TERMS[item.completeness]);
    }
    // Condition (Sealed/Mint/Good/Fair/Poor) is deliberately NOT added
    // here, even though it once was — eBay's search is closer to "match
    // every word" than a smart natural-language search, and a grading
    // adjective like "good" or "fair" almost never appears verbatim in a
    // listing title. Tacking it on quietly zeroed out results for
    // anything without a lot of active listings (a niche/indie title, for
    // instance) instead of narrowing the search the way it was intended
    // to. Completeness terms are actual marketplace shorthand sellers
    // write; condition words generally aren't.
  }
  if (item.item_type === 'trading_card' && item.card_set) parts.push(item.card_set);
  if (item.item_type === 'vinyl' && item.format) parts.push(item.format);
  if (item.item_type === 'comic' && item.issue_number) parts.push(item.issue_number);
  // The Pop! # is the one thing collectors reliably write in a listing
  // title (it's the definitive identifier for a specific figure), unlike
  // a condition adjective — safe to search on directly.
  if (item.item_type === 'funko_pop' && item.card_number) parts.push(item.card_number);
  return parts.filter(Boolean).join(' ');
}
