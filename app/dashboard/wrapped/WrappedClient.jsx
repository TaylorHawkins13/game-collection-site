'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { formatMoney } from '@/lib/currency';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function yearOf(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

// See ROADMAP.md "Yearly 'Wrapped'-style recap" — a shareable end-of-year
// summary, small build for what it gives back. Two of the four stats
// (items added, most active month) lean on `games.created_at`, which has
// existed since day one; "completed"/"rated" counts and the "biggest
// completion" highlight lean on `activity_events`, which only started
// being written once the activity feed shipped (see CHANGELOG.md) — an
// older year can genuinely show fewer of those moments than actually
// happened, called out below rather than presented as complete history.
export default function WrappedClient({ games, events, snapshots, currency, year }) {
  const addedThisYear = useMemo(() => games.filter((g) => yearOf(g.created_at) === year), [games, year]);
  const eventsThisYear = useMemo(() => events.filter((e) => yearOf(e.created_at) === year), [events, year]);
  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const mostActiveMonth = useMemo(() => {
    const counts = new Array(12).fill(0);
    addedThisYear.forEach((g) => {
      counts[new Date(g.created_at).getMonth()] += 1;
    });
    eventsThisYear.forEach((e) => {
      counts[new Date(e.created_at).getMonth()] += 1;
    });
    let best = -1;
    let bestCount = 0;
    counts.forEach((c, i) => {
      if (c > bestCount) {
        bestCount = c;
        best = i;
      }
    });
    return best >= 0 ? { label: MONTH_NAMES[best], count: bestCount } : null;
  }, [addedThisYear, eventsThisYear]);

  const completedEvents = useMemo(() => eventsThisYear.filter((e) => e.event_type === 'completed'), [eventsThisYear]);
  const ratedCount = useMemo(() => eventsThisYear.filter((e) => e.event_type === 'rated').length, [eventsThisYear]);

  // "Biggest completion" — the highest-rated thing you finished this
  // year, ties broken by most recent. Skipped entirely if nothing
  // completed this year rather than guessing at a lesser highlight.
  const biggestCompletion = useMemo(() => {
    const withGames = completedEvents.map((e) => ({ ...e, game: gamesById.get(e.game_id) })).filter((e) => e.game);
    if (!withGames.length) return null;
    return withGames.sort(
      (a, b) => (Number(b.game.rating) || 0) - (Number(a.game.rating) || 0) || new Date(b.created_at) - new Date(a.created_at)
    )[0].game;
  }, [completedEvents, gamesById]);

  // Value at the start of the year (the last snapshot before it, or the
  // first snapshot recorded during it if there's nothing earlier) versus
  // the latest snapshot actually taken during the year. Needs a real
  // start AND end point — same "at least two snapshots" caution
  // DashboardClient's own value chart already uses — so this stays null
  // rather than guessing from a single data point.
  const valueChange = useMemo(() => {
    const beforeYear = snapshots.filter((s) => yearOf(s.taken_at) < year).slice(-1)[0] || null;
    const withinYear = snapshots.filter((s) => yearOf(s.taken_at) === year);
    const start = beforeYear || withinYear[0] || null;
    const end = withinYear.length ? withinYear[withinYear.length - 1] : null;
    if (!start || !end || start === end) return null;
    return end.total_value - start.total_value;
  }, [snapshots, year]);

  const hasAnything = addedThisYear.length > 0 || eventsThisYear.length > 0;
  const currentYear = new Date().getFullYear();

  return (
    <main className="container" style={{ maxWidth: 640 }}>
      <div className="profile-header" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Your {year} Wrapped</h1>
          <p className="sub" style={{ margin: 0 }}>
            Built entirely from what you already track — nothing new to enter.
          </p>
        </div>
      </div>

      <div className="toolbar" style={{ margin: '16px 0' }}>
        <Link href={`/dashboard/wrapped?year=${year - 1}`} className="btn-ghost" style={{ textDecoration: 'none' }}>
          ← {year - 1}
        </Link>
        {year < currentYear && (
          <Link href={`/dashboard/wrapped?year=${year + 1}`} className="btn-ghost" style={{ textDecoration: 'none' }}>
            {year + 1} →
          </Link>
        )}
      </div>

      {!hasAnything ? (
        <div className="empty-state">
          <div>Nothing logged in {year} yet.</div>
        </div>
      ) : (
        <>
          <div className="wrapped-card">
            <div className="wrapped-header">Shelf Life Wrapped</div>
            <div className="wrapped-year">{year}</div>

            <div className="wrapped-stat">
              <div className="wrapped-stat-num">{addedThisYear.length}</div>
              <div className="wrapped-stat-label">item{addedThisYear.length === 1 ? '' : 's'} added</div>
            </div>

            {mostActiveMonth && (
              <div className="wrapped-stat">
                <div className="wrapped-stat-num">{mostActiveMonth.label}</div>
                <div className="wrapped-stat-label">your busiest month</div>
              </div>
            )}

            {completedEvents.length > 0 && (
              <div className="wrapped-stat">
                <div className="wrapped-stat-num">{completedEvents.length}</div>
                <div className="wrapped-stat-label">item{completedEvents.length === 1 ? '' : 's'} completed</div>
              </div>
            )}

            {biggestCompletion && (
              <div className="wrapped-stat">
                <div className="wrapped-stat-num wrapped-stat-title">{biggestCompletion.title}</div>
                <div className="wrapped-stat-label">your top completion of the year</div>
              </div>
            )}

            {ratedCount > 0 && (
              <div className="wrapped-stat">
                <div className="wrapped-stat-num">{ratedCount}</div>
                <div className="wrapped-stat-label">item{ratedCount === 1 ? '' : 's'} rated</div>
              </div>
            )}

            {valueChange != null && (
              <div className="wrapped-stat">
                <div className="wrapped-stat-num">
                  {valueChange >= 0 ? '+' : ''}
                  {formatMoney(valueChange, currency)}
                </div>
                <div className="wrapped-stat-label">estimated collection value change</div>
              </div>
            )}
          </div>

          <p className="sub" style={{ marginTop: 12 }}>
            Screenshot this to share. "Items added" always reflects your full history, but "completed," "rated," and
            "busiest month" are only as complete as your activity history — tracked since the activity feed shipped,
            so an older year may show fewer moments than actually happened.
          </p>
        </>
      )}
    </main>
  );
}
