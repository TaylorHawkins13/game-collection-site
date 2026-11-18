/**
 * Activities recorded elsewhere (Garmin, Apple Watch, any app writing to
 * Apple Health / Health Connect, or Strava) count in Steady exactly like ones
 * recorded here. Each is matched to an open planned session of the same kind
 * on the same day (closest length wins) — or counted as an extra session.
 *
 * Not counted: anything before the plan started (history only sets fitness),
 * anything already counted, and anything overlapping a session Steady recorded
 * itself (we write those to Health/Strava, so they'd come back as duplicates).
 */
import { allSessions } from './plan.ts';
import type { AppState, DateKey, ImportedRun, PlannedSession } from './types.ts';

export type Match = { session: PlannedSession | null } | null;

export function matchImportedRun(state: AppState, run: ImportedRun, today: DateKey): Match {
  if (!state.plan || run.countedActivityId) return null;
  if (run.date < state.plan.startDate || run.date > today) return null;
  if (state.activities.some((a) => Math.abs(a.startedAt - run.startedAt) < 10 * 60_000)) return null;
  const kind = run.kind ?? 'run';
  const mins = run.durationSec / 60;
  const open = allSessions(state.plan).filter(
    (s) => s.date === run.date && s.kind === kind && (s.status === 'planned' || s.status === 'missed' || s.status === 'skipped'),
  );
  const best = [...open].sort((a, b) => Math.abs(a.durationMin - mins) - Math.abs(b.durationMin - mins))[0];
  return { session: best ?? null };
}
