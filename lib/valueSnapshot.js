// Blends the two price signals a game item can have into a single
// "estimated value": the last eBay "Check price" result when there is
// one (a live market signal), falling back to the manually-entered
// purchase price otherwise. Only counts owned items — wishlist/sold
// items aren't part of "what your collection is worth."
export function estimateCollectionValue(games) {
  const owned = (games || []).filter((g) => g.ownership === 'owned');
  let total = 0;
  let pricedCount = 0;
  for (const g of owned) {
    const raw = g.market_price != null ? g.market_price : g.price;
    const v = raw != null ? parseFloat(raw) : NaN;
    if (!Number.isNaN(v)) {
      total += v;
      pricedCount += 1;
    }
  }
  return {
    total: Math.round(total * 100) / 100,
    itemCount: owned.length,
    pricedCount,
  };
}
