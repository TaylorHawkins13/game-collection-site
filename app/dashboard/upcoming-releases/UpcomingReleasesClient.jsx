'use client';

import { useEffect, useMemo, useState } from 'react';
import { computeSpendTotals } from '@/lib/upcomingReleases';
import { currencySymbol, formatMoney } from '@/lib/currency';

// Per-device "expected price" guesses for entries the cron hasn't (and,
// per lib/upcomingReleases.js's own header comment, structurally can't)
// attach a real price to — neither IGDB nor Comic Vine expose MSRP/price
// data for something that hasn't released yet, confirmed while
// researching this feature, so a real number here is unavoidably
// something a person types in, not something the app can look up.
// Stored in localStorage rather than on `games`/a new table — same
// per-device-preference call lib/textSize.js/ThemeToggle.jsx already
// make: this is a personal budgeting guess, not account data anyone else
// needs to see, and it means it works the same way on every device
// without a new sync-across-devices table for what's a low-stakes,
// easily-retyped number.
const STORAGE_KEY = 'shelf-life-upcoming-releases-prices';

function getStoredPrices() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // Private browsing / storage disabled / corrupted JSON — fall back to
    // no saved guesses rather than breaking the page over it.
    return {};
  }
}

function setStoredPrices(prices) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  } catch {
    // Still usable for this page view via React state — it just won't
    // persist to the next visit on a device that can't write storage.
  }
}

function formatReleaseDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function entryLabel(entry) {
  if (entry.itemType === 'game') return entry.name;
  const issueLabel = entry.number ? `#${entry.number}` : '';
  return [issueLabel, entry.title].filter(Boolean).join(': ') || entry.seriesName;
}

// Named/labeled "Upcoming Releases" in the UI (Sep 2026) — see page.js's
// header comment for why (clearer than the earlier "Pull List" name to
// anyone not already familiar with comic-shop pull-list terminology).
export default function UpcomingReleasesClient({ groups, currency }) {
  // Loaded on mount, not during the initial render, so the server-
  // rendered markup and the first client render match (same "brief flash
  // from a default to the stored value" trade-off ThemeToggle.jsx/
  // lib/textSize.js already make for a device-local preference) — a
  // hydration mismatch here is a worse trade than a one-frame flash from
  // "no prices yet" to whatever was actually saved.
  const [prices, setPrices] = useState({});
  useEffect(() => {
    setPrices(getStoredPrices());
  }, []);

  const allEntries = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const totals = useMemo(() => computeSpendTotals(allEntries, prices), [allEntries, prices]);
  const symbol = currencySymbol(currency);

  function handlePriceChange(entryKey, value) {
    setPrices((prev) => {
      const next = { ...prev };
      if (value.trim() === '') {
        delete next[entryKey];
      } else {
        next[entryKey] = value;
      }
      setStoredPrices(next);
      return next;
    });
  }

  return (
    <main className="container" style={{ maxWidth: 820 }}>
      <div className="profile-header" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Upcoming releases</h1>
          <p className="sub" style={{ margin: 0 }}>
            Upcoming releases for the game franchises and comic series you already own something from — type in an
            expected price to track what&apos;s coming up in your budget.
          </p>
        </div>
      </div>

      <div className="form-card" style={{ marginTop: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div className="sub" style={{ margin: 0 }}>
            This week
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{formatMoney(totals.thisWeek, currency)}</div>
        </div>
        <div>
          <div className="sub" style={{ margin: 0 }}>
            This month
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{formatMoney(totals.thisMonth, currency)}</div>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="form-card" style={{ marginTop: 16 }}>
          <div className="sub" style={{ margin: 0 }}>
            Nothing upcoming yet. Games and comic series get added to this calendar automatically once you own an
            item from them and the weekly refresh has had a chance to check for future releases — a newly-logged
            series can take up to a week to show up here for the first time.
          </div>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.monthKey} className="form-card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{group.monthLabel}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.entries.map((entry) => (
              <div
                key={entry.entryKey}
                style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}
              >
                {entry.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.cover} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 56,
                      borderRadius: 4,
                      flexShrink: 0,
                      background: 'var(--card-hover)',
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entryLabel(entry)}
                  </div>
                  <div className="sub" style={{ margin: 0 }}>
                    {entry.seriesName} · {formatReleaseDate(entry.releaseTs)} · {entry.itemType === 'game' ? 'Game' : 'Comic'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span className="sub">{symbol}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Expected"
                    value={prices[entry.entryKey] ?? ''}
                    onChange={(e) => handlePriceChange(entry.entryKey, e.target.value)}
                    style={{ width: 90 }}
                    aria-label={`Expected price for ${entryLabel(entry)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
