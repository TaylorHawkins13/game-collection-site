'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { announceToast } from '@/lib/toast';

// Same idea as DashboardClient's "Refresh all prices", but for a
// collection that isn't yours — persists through the
// refresh_item_market_price SQL function instead of a direct table
// update, since normal RLS only lets the row's own owner update it (see
// publicprice-refresh-migration.sql for why that's safe to bypass just
// for these three columns). Uses the collector's own currency for the
// eBay marketplace searched, not the visitor's — it's their collection.
export default function RefreshPricesButton({ games, currency }) {
  const supabase = createClient();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const stopRef = useRef(false);

  async function fetchPriceWithRetry(item, marketplace) {
    const title = (item.title || '').trim();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `/api/ebay-price?q=${encodeURIComponent(buildPriceQuery(item))}&title=${encodeURIComponent(title)}&marketplace=${marketplace}&itemType=${encodeURIComponent(item.item_type || '')}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (attempt === 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async function handleRefresh() {
    const targets = (games || []).filter((g) => g.ownership !== 'sold' && buildPriceQuery(g));
    if (targets.length === 0) return;
    stopRef.current = false;
    setRefreshing(true);
    setProgress({ done: 0, total: targets.length });

    let updatedCount = 0;
    const skipped = [];
    const marketplace = marketplaceForCurrency(currency);

    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break;
      const item = targets[i];
      try {
        const data = await fetchPriceWithRetry(item, marketplace);
        if (!data.error && data.count) {
          const { error } = await supabase.rpc('refresh_item_market_price', {
            p_game_id: item.id,
            p_market_price: data.avg,
            p_currency: data.currency || 'USD',
          });
          if (error) {
            console.error('Refresh price: RPC failed for', item.title, error);
            skipped.push(item.title);
          } else {
            updatedCount += 1;
          }
        } else {
          if (data.error) console.error('Refresh price: skipped', item.title, data.error);
          skipped.push(item.title);
        }
      } catch (err) {
        console.error('Refresh price: request failed for', item.title, err);
        skipped.push(item.title);
      }
      setProgress({ done: i + 1, total: targets.length });
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    setRefreshing(false);

    if (skipped.length === 0) {
      announceToast(`Refreshed prices for all ${updatedCount} item${updatedCount === 1 ? '' : 's'}.`, 'success');
    } else if (updatedCount === 0) {
      announceToast(
        `Couldn't refresh any prices — no matching eBay listings or a search error for all ${skipped.length} item${skipped.length === 1 ? '' : 's'}.`,
        'error'
      );
    } else {
      const preview = skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? ', …' : '');
      announceToast(
        `Refreshed ${updatedCount} item${updatedCount === 1 ? '' : 's'} — skipped ${skipped.length} (no matching listings or a search error): ${preview}.`,
        'error'
      );
    }
    // Reloads this server-rendered page's data so the new prices actually
    // show up on the cards without a manual browser refresh.
    router.refresh();
  }

  if (refreshing) {
    return (
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="sub" style={{ margin: 0 }}>
          Checking eBay prices… {progress.done}/{progress.total}
        </span>
        <button className="btn-ghost" onClick={() => { stopRef.current = true; }} type="button">
          Stop
        </button>
      </span>
    );
  }

  return (
    <button className="btn-ghost" onClick={handleRefresh} type="button" disabled={(games || []).length === 0}>
      Refresh prices
    </button>
  );
}
