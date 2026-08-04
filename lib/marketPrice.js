// Builds a search string tailored to the item type for eBay price lookups —
// a bare title finds a lot of unrelated junk, so tack on whatever extra
// detail narrows it down best for that type. Shared between the per-item
// "Check eBay price" button (GameModal) and the "Refresh all prices" bulk
// action (DashboardClient) so both search the same way.
export function buildPriceQuery(item) {
  const title = (item.title || '').trim();
  if (!title) return '';
  const parts = [title];
  if (item.item_type === 'game' && item.platforms?.[0]) parts.push(item.platforms[0]);
  if (item.item_type === 'trading_card' && item.card_set) parts.push(item.card_set);
  if (item.item_type === 'vinyl' && item.format) parts.push(item.format);
  if (item.item_type === 'comic' && item.issue_number) parts.push(item.issue_number);
  return parts.filter(Boolean).join(' ');
}
