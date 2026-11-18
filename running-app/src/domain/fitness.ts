/**
 * Fitness tracking: keeps a 5K-equivalent estimate in step with real runs so
 * paces and the plan react to improvement and regression.
 *
 * Moves are small and evidence-based:
 *  up    · a run (≥3 km) faster than the current estimate → jump to it (max 5% at once)
 *        · the last two workouts both logged "Easy" → 1.5% quicker
 *        · last 4 easy runs comfortable AND naturally quicker than the easy range → 1.5% quicker
 *  down  · the last two workouts both logged "Hard" → 2% slower
 *        · last 3 easy runs all "Hard" AND slower than the easy range → 2% slower
 *        · 14+ days without running → 2% slower per extra week (max 10%), once per break
 * Trend rules wait 10 days between moves in the same direction so one week can't swing it.
 * Runners without PBs (not "new") get a first estimate after 3 comfortable easy runs.
 */
import { diffDays } from './dates.ts';
import { allSessions } from './plan.ts';
import { fiveKEquivalent, formatTime, paceLabel, RACE_LABEL, RACE_METERS, riegel, trainingPaces } from './pace.ts';
import type { Activity, AppState, DateKey, Fitness, FitnessReason, PlannedSession, RaceDistance } from './types.ts';

export interface FitnessMove {
  fiveKSec: number;
  reason: FitnessReason;
}

const UP: FitnessReason[] = ['faster_run', 'workouts_easy', 'easy_trend'];
const DOWN: FitnessReason[] = ['workouts_hard', 'easy_struggle', 'break'];

export function direction(reason: FitnessReason): 'up' | 'down' | 'set' {
  return UP.includes(reason) ? 'up' : DOWN.includes(reason) ? 'down' : 'set';
}

export function fitnessFromPbs(state: AppState, today: DateKey): Fitness | undefined {
  const p = state.profile;
  const f = p ? fiveKEquivalent(p.pbs ?? [], p.level) : null;
  return f ? { fiveKSec: Math.round(f), updatedAt: today, log: [{ date: today, fiveKSec: Math.round(f), reason: 'pb' }] } : undefined;
}

/** The 5K-equivalent the plan should use right now. */
export function currentFiveK(state: AppState): number | null {
  if (state.fitness) return state.fitness.fiveKSec;
  const p = state.profile;
  return p ? fiveKEquivalent(p.pbs ?? [], p.level) : null;
}

export function currentPaces(state: AppState) {
  const f = currentFiveK(state);
  return f ? trainingPaces(f) : null;
}

function sessionFor(state: AppState, a: Activity): PlannedSession | undefined {
  return a.plannedSessionId ? allSessions(state.plan).find((s) => s.id === a.plannedSessionId) : undefined;
}

function paceOf(a: Activity): number | null {
  return a.distanceM && a.distanceM >= 1000 && a.durationSec > 0 ? a.durationSec / (a.distanceM / 1000) : null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function recentlyMoved(state: AppState, dir: 'up' | 'down', today: DateKey, days = 10): boolean {
  return (state.fitness?.log ?? []).some((l) => direction(l.reason) === dir && l.reason !== 'faster_run' && diffDays(l.date, today) < days);
}

const runsNewestFirst = (state: AppState) => state.activities.filter((a) => a.kind === 'run').sort((a, b) => b.startedAt - a.startedAt);

/** Evaluate after a run's check-in. Returns the move to apply, if any. */
export function evaluateAfterRun(state: AppState, activityId: string, today: DateKey): FitnessMove | null {
  const p = state.profile;
  const a = state.activities.find((x) => x.id === activityId);
  if (!p || !a || a.kind !== 'run' || p.level === 'new') return null;
  const s = sessionFor(state, a);
  if (s?.walkRun) return null;
  const fit = currentFiveK(state);
  const runs = runsNewestFirst(state);
  const isEasy = (x: Activity) => {
    const t = sessionFor(state, x)?.runType;
    return !t || t === 'easy' || t === 'long';
  };

  // Bootstrap from comfortable easy runs (easy pace ≈ 1.3 × 5K pace).
  if (!fit) {
    const easy = runs.filter((x) => isEasy(x) && paceOf(x) && (x.distanceM ?? 0) >= 1500 && (x.feel === 'easy' || x.feel === 'just_right')).slice(0, 3);
    if (easy.length < 3) return null;
    return { fiveKSec: Math.round((median(easy.map((x) => paceOf(x)!)) / 1.3) * 5), reason: 'estimated' };
  }

  // A genuinely faster run is direct evidence.
  if ((a.distanceM ?? 0) >= 3000 && paceOf(a)) {
    const equiv = riegel(a.durationSec, a.distanceM!, 5000);
    if (equiv < fit * 0.985) return { fiveKSec: Math.round(Math.max(equiv, fit * 0.95)), reason: 'faster_run' };
  }

  // Workout feel, two in a row.
  const workouts = runs.filter((x) => sessionFor(state, x)?.workout && x.feel).slice(0, 2);
  if (s?.workout && workouts.length === 2 && workouts[0].id === a.id) {
    if (workouts.every((x) => x.feel === 'easy') && !recentlyMoved(state, 'up', today)) return { fiveKSec: Math.round(fit * 0.985), reason: 'workouts_easy' };
    if (workouts.every((x) => x.feel === 'hard') && !recentlyMoved(state, 'down', today)) return { fiveKSec: Math.round(fit * 1.02), reason: 'workouts_hard' };
  }

  // Easy-run trends.
  if (isEasy(a)) {
    const paces = trainingPaces(fit);
    const easy = runs.filter((x) => isEasy(x) && paceOf(x) && (x.distanceM ?? 0) >= 1500 && x.feel);
    const last3 = easy.slice(0, 3);
    if (last3.length === 3 && last3.every((x) => x.feel === 'hard') && median(last3.map((x) => paceOf(x)!)) > paces.easy[1] && !recentlyMoved(state, 'down', today)) {
      return { fiveKSec: Math.round(fit * 1.02), reason: 'easy_struggle' };
    }
    const last4 = easy.slice(0, 4);
    if (
      last4.length === 4 &&
      last4.every((x) => (x.feel === 'easy' || x.feel === 'just_right') && x.soreness !== 'noticeable') &&
      median(last4.map((x) => paceOf(x)!)) < paces.easy[0] &&
      !recentlyMoved(state, 'up', today)
    ) {
      return { fiveKSec: Math.round(fit * 0.985), reason: 'easy_trend' };
    }
  }
  return null;
}

/** Weekly check for a break in running. */
export function evaluateBreak(state: AppState, today: DateKey): FitnessMove | null {
  const fit = state.fitness;
  if (!fit || !state.profile || state.profile.level === 'new') return null;
  const last = runsNewestFirst(state)[0];
  if (!last) return null;
  const gap = diffDays(last.date, today);
  if (gap < 14) return null;
  // Once per break: skip if we already applied a break move after the last run.
  if (fit.log.some((l) => l.reason === 'break' && l.date > last.date)) return null;
  const weeks = Math.min(5, Math.floor((gap - 7) / 7));
  return { fiveKSec: Math.round(fit.fiveKSec * (1 + 0.02 * weeks)), reason: 'break' };
}

export function describeMove(move: FitnessMove, units: 'km' | 'mi'): string {
  const p = trainingPaces(move.fiveKSec);
  const easy = `${paceLabel(p.easy[0], units)}–${paceLabel(p.easy[1], units)}/${units}`;
  switch (move.reason) {
    case 'estimated':
      return `From your first few runs, your easy pace looks like about ${easy}. The plan will use this from now on.`;
    case 'faster_run':
      return `That run was quicker than your current fitness estimate — you’re getting fitter. Paces updated: easy ${easy}, and workout targets are a touch quicker.`;
    case 'workouts_easy':
      return `Your last two workouts felt easy, so workout targets are slightly quicker now. Easy runs: ${easy}.`;
    case 'easy_trend':
      return `Your easy runs are naturally getting quicker while still feeling easy. Paces nudged: easy ${easy}.`;
    case 'workouts_hard':
      return `Your last two workouts felt hard, so targets are a little gentler (easy ${easy}) and the plan holds steady this week. Totally normal — fitness isn’t a straight line.`;
    case 'easy_struggle':
      return `Easy runs have been feeling hard lately, so paces are eased a little (easy ${easy}) and the plan holds steady. Sleep, stress and heat all count.`;
    case 'break':
      return `Welcome back after a break. Paces are eased a little (easy ${easy}) so getting going feels good. They’ll come back as you run.`;
    case 'pb':
      return `Paces set from your PB: easy ${easy}.`;
    case 'history':
      return `From your imported runs, your easy pace looks like about ${easy}. Workout targets now use this too.`;
  }
}

/** Did this run beat a PB at (roughly) a race distance? */
export function possiblePb(state: AppState, a: Activity): { distance: RaceDistance; timeSec: number } | null {
  if (a.kind !== 'run' || !a.distanceM) return null;
  for (const d of Object.keys(RACE_METERS) as RaceDistance[]) {
    const m = RACE_METERS[d];
    if (a.distanceM >= m * 0.99 && a.distanceM <= m * 1.05) {
      // Normalise to the exact distance.
      const t = Math.round(a.durationSec * (m / a.distanceM));
      const pb = state.profile?.pbs?.find((p) => p.distance === d);
      if (!pb || t < pb.timeSec) return { distance: d, timeSec: t };
    }
  }
  return null;
}

export function pbText(pb: { distance: RaceDistance; timeSec: number }): string {
  return `${RACE_LABEL[pb.distance]} in ${formatTime(pb.timeSec)}`;
}

export function hadSlipSince(state: AppState, since: DateKey): boolean {
  return (state.fitness?.log ?? []).some((l) => l.date >= since && (l.reason === 'workouts_hard' || l.reason === 'easy_struggle'));
}

