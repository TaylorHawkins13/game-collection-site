'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/currency';
import { TYPE_LABELS, CATEGORY_ORDER } from '@/lib/mosaicData';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const PLAY_STATUS_LABELS = { backlog: 'Backlog', playing: 'Playing', completed: 'Completed', abandoned: 'Abandoned' };

function itemValue(g) {
  return g.market_price != null ? g.market_price : g.price != null ? g.price : 0;
}

// Plain "how many of each value" tally for one field across a list of
// items — the shared shape behind most of the type-specific panels below
// (top card sets, comic/book series, record labels, manufacturer,
// studio, character), since they're all the same operation on a
// different field/subset.
function countBy(items, field) {
  const counts = {};
  items.forEach((g) => {
    const v = g[field];
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
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

  // Type-specific "smart" widgets below (see ROADMAP.md/CHANGELOG.md) —
  // requested directly, right after the dashboard's shelf hero shipped:
  // "not one generic breakdown for everyone," the metrics that actually
  // matter to a comic collector aren't the same ones that matter to a
  // trading-card collector. Every one of these is still purely derived
  // from fields already on the games table (no new columns, no live API
  // calls to IGDB/TCGdex/Comic Vine/etc. for this round — that's a bigger
  // follow-up, see ROADMAP.md), reusing the same field-doubling the Add
  // form already relies on (e.g. `publisher` doubles as a vinyl "label,"
  // a console "manufacturer," and a DVD/VHS "studio" — see
  // supabase-schema.sql's comment on the games table). Each panel below
  // is gated on actually owning at least one item of the relevant
  // type(s) — a non-collector of that type sees nothing for it at all,
  // not an empty panel, matching how the dashboard's shelf hero and
  // Filters panel already only show what's actually relevant.
  const gamesOwned = useMemo(() => owned.filter((g) => g.item_type === 'game'), [owned]);
  const cardsOwned = useMemo(() => owned.filter((g) => g.item_type === 'trading_card'), [owned]);
  const comicsOwned = useMemo(() => owned.filter((g) => g.item_type === 'comic'), [owned]);
  const booksOwned = useMemo(() => owned.filter((g) => g.item_type === 'book'), [owned]);
  const musicOwned = useMemo(() => owned.filter((g) => g.item_type === 'vinyl' || g.item_type === 'cd'), [owned]);
  const consolesOwned = useMemo(() => owned.filter((g) => g.item_type === 'console'), [owned]);
  const screenOwned = useMemo(() => owned.filter((g) => g.item_type === 'dvd' || g.item_type === 'vhs'), [owned]);
  const funkoOwned = useMemo(() => owned.filter((g) => g.item_type === 'funko_pop'), [owned]);

  const backlogHealth = useMemo(() => {
    const counts = {};
    gamesOwned.forEach((g) => {
      const status = g.play_status || 'backlog';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.keys(PLAY_STATUS_LABELS)
      .filter((k) => counts[k])
      .map((k) => ({ label: PLAY_STATUS_LABELS[k], value: counts[k] }));
  }, [gamesOwned]);

  const trophyCompletion = useMemo(() => {
    const tracked = gamesOwned.filter((g) => g.trophy_completion != null);
    if (!tracked.length) return null;
    const sum = tracked.reduce((s, g) => s + Number(g.trophy_completion), 0);
    return { avg: sum / tracked.length, count: tracked.length };
  }, [gamesOwned]);

  const rawVsGraded = useMemo(() => {
    let raw = 0;
    let graded = 0;
    cardsOwned.forEach((c) => {
      if (c.grade && c.grade.trim()) graded += 1;
      else raw += 1;
    });
    return [
      { label: 'Raw', value: raw },
      { label: 'Graded', value: graded },
    ].filter((r) => r.value > 0);
  }, [cardsOwned]);

  const topCardSets = useMemo(() => countBy(cardsOwned, 'card_set'), [cardsOwned]);
  const comicSeries = useMemo(() => countBy(comicsOwned, 'series'), [comicsOwned]);
  const bookSeries = useMemo(() => countBy(booksOwned, 'series'), [booksOwned]);
  const recordLabels = useMemo(() => countBy(musicOwned, 'publisher'), [musicOwned]);
  const musicFormat = useMemo(() => countBy(musicOwned, 'format'), [musicOwned]);
  const byManufacturer = useMemo(() => countBy(consolesOwned, 'publisher'), [consolesOwned]);
  const byStudio = useMemo(() => countBy(screenOwned, 'publisher'), [screenOwned]);
  const byCharacter = useMemo(() => countBy(funkoOwned, 'player_name'), [funkoOwned]);

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

      {/* Type-specific panels — only ever shows what's actually relevant
          to what's in this collection, see the comment above the useMemo
          block that computes these. */}
      {(gamesOwned.length > 0 ||
        cardsOwned.length > 0 ||
        comicsOwned.length > 0 ||
        booksOwned.length > 0 ||
        musicOwned.length > 0 ||
        consolesOwned.length > 0 ||
        screenOwned.length > 0 ||
        funkoOwned.length > 0) && (
        <>
          <h2 style={{ fontSize: 18, margin: '28px 0 12px' }}>Made for what you collect</h2>
          <div className="insights-grid">
            {gamesOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Backlog health</h3>
                <BarList rows={backlogHealth} emptyText="Nothing to show yet." />
              </div>
            )}

            {gamesOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Trophy completion</h3>
                {trophyCompletion ? (
                  <>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{Math.round(trophyCompletion.avg)}%</div>
                    <div className="sub" style={{ margin: '4px 0 0' }}>
                      average across {trophyCompletion.count} game{trophyCompletion.count === 1 ? '' : 's'} with completion tracked
                    </div>
                  </>
                ) : (
                  <div className="sub" style={{ margin: 0 }}>No trophy completion logged yet.</div>
                )}
              </div>
            )}

            {cardsOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Raw vs. graded</h3>
                <BarList rows={rawVsGraded} emptyText="Nothing to show yet." />
              </div>
            )}

            {cardsOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Top card sets</h3>
                <BarList rows={topCardSets} emptyText="No sets logged for your trading cards yet." />
              </div>
            )}

            {comicsOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Top comic series</h3>
                <BarList rows={comicSeries} emptyText="No series logged for your comics yet." />
              </div>
            )}

            {booksOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Top book series</h3>
                <BarList rows={bookSeries} emptyText="No series logged for your books yet." />
              </div>
            )}

            {musicOwned.length > 0 && (
              <div className="insights-panel">
                <h3>Record labels</h3>
                <BarList rows={recordLabels} emptyText="No labels logged for your vinyl/CDs yet." />
              </div>
            )}

            {musicOwned.length > 0 && (
              <div className="insights-panel">
                <h3>By format</h3>
                <BarList rows={musicFormat} emptyText="No formats logged for your vinyl/CDs yet." />
              </div>
            )}

            {consolesOwned.length > 0 && (
              <div className="insights-panel">
                <h3>By manufacturer</h3>
                <BarList rows={byManufacturer} emptyText="No manufacturers logged for your consoles yet." />
              </div>
            )}

            {screenOwned.length > 0 && (
              <div className="insights-panel">
                <h3>By studio</h3>
                <BarList rows={byStudio} emptyText="No studios logged for your DVDs/VHS yet." />
              </div>
            )}

            {funkoOwned.length > 0 && (
              <div className="insights-panel">
                <h3>By character</h3>
                <BarList rows={byCharacter} emptyText="No characters logged for your Funko Pops yet." />
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
