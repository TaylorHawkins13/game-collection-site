/**
 * Match runs recorded elsewhere (Garmin/Apple Watch via Health or Strava) to
 * planned sessions, so running with just a watch still ticks off the plan.
 *
 * auto  — same day, exactly one open run session, and the duration is plausible
 *         (40%–250% of planned). Counted straight away.
 * ask   — something matches but it's ambiguous (two open sessions, an odd
 *         duration, or a strength day) → "Count this as today's run?"
 * extra — nothing planned that day → offer to count it as an extra run.
 * Only recent runs (last 3 days, on or after the plan start) are considered,
 * so importing months of history never back-fills old sessions.
 */
import { diffDays } from './dates.ts';
import { allSessions } from './plan.ts';
import type { AppState, DateKey, ImportedRun, PlannedSession } from './types.ts';

export type Match =
  | { kind: 'auto'; session: PlannedSession; reason: string }
  | { kind: 'ask'; session: PlannedSession | null; reason: string }
  | null;

export function matchImportedRun(state: AppState, run: ImportedRun, today: DateKey): Match {
  if (!state.plan || run.countedActivityId) return null;
  if (run.date < state.plan.startDate || diffDays(run.date, today) > 3 || run.date > today) return null;
  // Already have a Steady-recorded or counted activity overlapping this run? Then it's not new.
  if (state.activities.some((a) => Math.abs(a.startedAt - run.startedAt) < 10 * 60_000)) return null;

  const open = allSessions(state.plan).filter(
    (s) => s.date === run.date && (s.status === 'planned' || s.status === 'missed') && s.kind === 'run',
  );
  const mins = run.durationSec / 60;
  const plausible = (s: PlannedSession) => mins >= s.durationMin * 0.4 && mins <= s.durationMin * 2.5;

  if (open.length === 1 && plausible(open[0])) {
    return { kind: 'auto', session: open[0], reason: `Matches ${open[0].title}` };
  }
  if (open.length >= 1) {
    const best = [...open].sort((a, b) => Math.abs(a.durationMin - mins) - Math.abs(b.durationMin - mins))[0];
    return {
      kind: 'ask',
      session: best,
      reason: open.length > 1 ? 'You had more than one run planned that day.' : `It was ${Math.round(mins)} min vs ${best.durationMin} planned.`,
    };
  }
  const strengthThatDay = allSessions(state.plan).some((s) => s.date === run.date && s.kind === 'strength' && s.status === 'planned');
  return { kind: 'ask', session: null, reason: strengthThatDay ? 'You had strength planned that day, not a run.' : 'Nothing was planned that day.' };
}
