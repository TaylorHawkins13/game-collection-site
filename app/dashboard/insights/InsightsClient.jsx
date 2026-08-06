'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/currency';
import { TYPE_LABELS, CATEGORY_ORDER } from '@/lib/mosaicData';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function itemValue(g) {
  return g.market_price != null ? g.market_price : g.price != null ? g.price : 0;
}

// Every breakdown here is derived from data already sitting in the
// `games` table — nothing new to enter, this is purely "what does what
// you've already logged add up to." Scoped to owned items only, same as
// the dashboard's own "Collection value" stat, so a wishlist full of
// aspirational items doesn't skew what's supposed to describe your
// actual shelf.
function BarList({ rows, formatValue = (v) => v, emptyText, limit = 8 }) {
  if (!rows.length) {
    return <div className="sub" style={{ margin: 0 }}>{emptyText}</div>;
  }
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, limit);
  const max = shown[0]?.value || 1;
  const restCount = sorted.length - shown.length;
  return (
    <div className="insights-barlist">
      {shown.map((row) => (
        <div className="insights-bar-row" key={row.label}>
          <div className="insights-bar-label">{row.label}</div>
          <div className="insights-bar-track">
            <div className="insights-bar-fill" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
          <div className="insights-bar-value">{formatValue(row.value)}</div>
        </div>
      ))}
      {restCount > 0 && (
        <div className="sub" style={{ margin: '4px 0 0' }}>+{restCount} more</div>
      )}
    </div>
  );
}

export default function InsightsClient({ games, currency }) {
  const owned = useMemo(() => games.filter((g) => g.ownership === 'owned'), [games]);

  const byType = useMemo(() => {
    const counts = {};
    owned.forEach((g) => {
      counts[g.item_type] = (counts[g.item_type] || 0) + 1;
    });
    return CATEGORY_ORDER.filter((t) => counts[t]).map((t) => ({ label: TYPE_LABELS[t] || t, value: counts[t] }));
  }, [owned]);

  const byPlatform = useMemo(() => {
    const counts = {};
    owned.forEach((g) => {
      (g.platforms || []).forEach((p) => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [owned]);

  const byGenre = useMemo(() => {
    const counts = {};
    owned.forEach((g) => {
      if (g.item_type === 'game' && g.genre) counts[g.genre] = (counts[g.genre] || 0) + 1;
    });
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [owned]);

  // Same rule as lib/valueSnapshot.js's estimateCollectionValue: digital
  // items are excluded from anything dollar-denominated (no resale
  // market for them), even though they still count in the "By type"
  // item counts above.
  const valueByType = useMemo(() => {
    const sums = {};
    owned.forEach((g) => {
      if (g.copy_type === 'digital') return;
      const v = itemValue(g);
      if (v > 0) sums[g.item_type] = (sums[g.item_type] || 0) + v;
    });
    return CATEGORY_ORDER.filter((t) => sums[t]).map((t) => ({ label: TYPE_LABELS[t] || t, value: sums[t] }));
  }, [owned]);

  const totalValue = useMemo(() => valueByType.reduce((sum, r) => sum + r.value, 0), [valueByType]);

  const spendingByMonth = useMemo(() => {
    const sums = {};
    owned.forEach((g) => {
      if (g.copy_type === 'digital' || !g.purchase_date) return;
      const v = g.price != null ? g.price : 0;
      if (v <= 0) return;
      const d = new Date(g.purchase_date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      sums[key] = (sums[key] || 0) + v;
    });
    return Object.entries(sums)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => {
        const [y, m] = key.split('-');
        return { label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`, value };
      });
  }, [owned]);

  const busiestMonth = useMemo(() => {
    const counts = new Array(12).fill(0);
    owned.forEach((g) => {
      if (!g.created_at) return;
      const d = new Date(g.created_at);
      if (Number.isNaN(d.getTime())) return;
      counts[d.getMonth()] += 1;
    });
    return MONTH_NAMES.map((label, i) => ({ label, value: counts[i] })).filter((r) => r.value > 0);
  }, [owned]);

  return (
    <main className="container">
      <div className="profile-header" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Collection Insights</h1>
          <p className="sub" style={{ margin: 0 }}>
            Breakdown of your {owned.length} owned item{owned.length === 1 ? '' : 's'} — derived entirely from what's
            already in your collection.
          </p>
        </div>
        <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>

      {owned.length === 0 ? (
        <div className="empty-state">
          <div>Add some items to your collection to see insights here.</div>
        </div>
      ) : (
        <div className="insights-grid">
          <div className="insights-panel">
            <h3>By type</h3>
            <BarList rows={byType} emptyText="Nothing to show yet." />
          </div>

          <div className="insights-panel">
            <h3>Value by type</h3>
            <p className="sub" style={{ marginTop: -6, marginBottom: 10 }}>
              {totalValue > 0 ? `${formatMoney(totalValue, currency)} tracked total, digital items excluded.` : 'No priced items yet.'}
            </p>
            <BarList rows={valueByType} formatValue={(v) => formatMoney(v, currency)} emptyText="No priced items yet." />
          </div>

          <div className="insights-panel">
            <h3>By platform</h3>
            <BarList rows={byPlatform} emptyText="No platforms logged yet (games/consoles only)." />
          </div>

          <div className="insights-panel">
            <h3>By genre</h3>
            <BarList rows={byGenre} emptyText="No genres logged yet (video games only)." />
          </div>

          <div className="insights-panel">
            <h3>Spending by month</h3>
            <p className="sub" style={{ marginTop: -6, marginBottom: 10 }}>Last 12 months with a recorded purchase price.</p>
            <BarList rows={spendingByMonth} formatValue={(v) => formatMoney(v, currency)} emptyText="No purchase prices with dates logged yet." limit={12} />
          </div>

          <div className="insights-panel">
            <h3>Busiest month for adding items</h3>
            <p className="sub" style={{ marginTop: -6, marginBottom: 10 }}>Across every year, which calendar month you add the most.</p>
            <BarList rows={busiestMonth} emptyText="Nothing to show yet." limit={12} />
          </div>
        </div>
      )}
    </main>
  );
}
