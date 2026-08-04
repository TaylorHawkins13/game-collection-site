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
  const parts = [title];
  if (item.item_type === 'game') {
    if (item.platforms?.[0]) parts.push(item.platforms[0]);
    if (item.completeness && COMPLETENESS_TERMS[item.completeness]) {
      parts.push(COMPLETENESS_TERMS[item.completeness]);
    }
  }
  if (item.item_type === 'trading_card' && item.card_set) parts.push(item.card_set);
  if (item.item_type === 'vinyl' && item.format) parts.push(item.format);
  if (item.item_type === 'comic' && item.issue_number) parts.push(item.issue_number);
  return parts.filter(Boolean).join(' ');
}
