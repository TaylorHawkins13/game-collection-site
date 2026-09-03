'use client';

import { useMemo } from 'react';
import { formatMoney } from '@/lib/currency';
import { TYPE_LABELS, CATEGORY_ORDER } from '@/lib/mosaicData';

// Same value rule as lib/valueSnapshot.js / InsightsClient: last checked
// eBay price if there is one, purchase price otherwise, and digital
// items never carry a dollar value (no resale market for them) — kept
// consistent with every other place a collection total gets computed, so
// this document's grand total can't quietly disagree with the dashboard.
function itemValue(g) {
  if (g.copy_type === 'digital') return 0;
  const v = g.market_price != null ? g.market_price : g.price != null ? g.price : 0;
  return v > 0 ? v : 0;
}

// Builds one "condition/details" line per item from whichever of its
// fields are actually filled in — different item types use different
// columns for genuinely comparable information (see supabase-schema.sql's
// comment on the games table: grade doubles as a trading-card grade,
// is_variant/variant_notes double as a "special version" flag, etc.), so
// this reads across all of them instead of hard-coding one shape.
function detailsLine(g) {
  const parts = [];
  if (g.platforms?.length) parts.push(g.platforms.join(', '));
  if (g.series) parts.push(g.issue_number ? `${g.series} #${g.issue_number}` : g.series);
  if (g.card_set) parts.push(g.card_number ? `${g.card_set} #${g.card_number}` : g.card_set);
  if (g.publisher) parts.push(g.publisher);
  if (g.edition) parts.push(g.edition);
  if (g.format) parts.push(g.format);
  if (g.region) parts.push(g.region);
  if (g.completeness) parts.push(g.completeness.toUpperCase());
  if (g.condition) parts.push(g.condition);
  if (g.grade) parts.push(`Grade ${g.grade}`);
  if (g.is_variant) parts.push(g.variant_notes ? `Variant: ${g.variant_notes}` : 'Variant');
  if (g.copy_type) parts.push(g.copy_type === 'digital' ? 'Digital' : 'Physical');
  return parts.join(' · ');
}

export default function AppraisalClient({ games, currency, collectorName }) {
  const grouped = useMemo(() => {
    const byType = {};
    games.forEach((g) => {
      (byType[g.item_type] = byType[g.item_type] || []).push(g);
    });
    return CATEGORY_ORDER.filter((t) => byType[t]?.length).map((t) => ({
      type: t,
      label: TYPE_LABELS[t] || t,
      items: [...byType[t]].sort((a, b) => a.title.localeCompare(b.title)),
      subtotal: byType[t].reduce((sum, g) => sum + itemValue(g), 0),
    }));
  }, [games]);

  const grandTotal = useMemo(() => grouped.reduce((sum, cat) => sum + cat.subtotal, 0), [grouped]);
  const pricedCount = useMemo(() => games.filter((g) => itemValue(g) > 0).length, [games]);
  const today = new Date().toLocaleDateString();

  return (
    <main className="container appraisal-page" style={{ maxWidth: 820 }}>
      <div className="profile-header appraisal-no-print" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--fs-5xl)', margin: '0 0 4px' }}>Collection Appraisal</h1>
          <p className="sub" style={{ margin: 0 }}>
            An itemized, printable export of your owned items and their current estimated value — for insurance
            documentation or your own records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="empty-state appraisal-no-print">
          <div>No owned items to appraise yet.</div>
        </div>
      ) : (
        <div className="appraisal-doc">
          <div className="appraisal-doc-header">
            <div>
              <div className="appraisal-doc-title">{collectorName}&apos;s Collection Appraisal</div>
              <div className="sub">Prepared {today} via Shelf Life</div>
            </div>
            <div className="appraisal-doc-total">
              <div className="appraisal-doc-total-num">{formatMoney(grandTotal, currency)}</div>
              <div className="sub">
                {games.length} item{games.length === 1 ? '' : 's'} · {pricedCount} with a recorded value
              </div>
            </div>
          </div>

          {grouped.map((cat) => (
            <div className="appraisal-category" key={cat.type}>
              <div className="appraisal-category-header">
                <h2>{cat.label}</h2>
                <span className="appraisal-category-subtotal">{formatMoney(cat.subtotal, currency)}</span>
              </div>
              <table className="appraisal-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Details</th>
                    <th>Basis</th>
                    <th className="appraisal-table-value">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map((g) => {
                    const value = itemValue(g);
                    const basis =
                      value === 0
                        ? '—'
                        : g.market_price != null
                          ? `eBay check${g.market_price_checked_at ? ` (${new Date(g.market_price_checked_at).toLocaleDateString()})` : ''}`
                          : 'Purchase price';
                    return (
                      <tr key={g.id}>
                        <td>{g.title}</td>
                        <td className="sub">{detailsLine(g) || '—'}</td>
                        <td className="sub">{basis}</td>
                        <td className="appraisal-table-value">{value > 0 ? formatMoney(value, currency) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <p className="sub appraisal-doc-footnote">
            Values marked &quot;eBay check&quot; reflect current active listing prices at the time checked, not
            confirmed sale prices or a professional appraisal — eBay doesn&apos;t offer free public access to sold-
            listing data. Items with neither a purchase price nor a checked market price show no value here rather
            than an inaccurate placeholder. This document is generated from data you entered yourself and is not a
            substitute for a licensed appraiser where one is required (e.g. for a formal insurance rider on
            high-value items).
          </p>
        </div>
      )}
    </main>
  );
}
