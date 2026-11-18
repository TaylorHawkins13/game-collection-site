/**
 * How races shape training.
 *
 * PB-attempt ("A") races get periodised training:
 *   base   > 12 weeks out — normal plan
 *   build  4–12 weeks out — race-specific workouts (seasoned runners), long runs grow toward the race
 *   peak   ≤ 4 weeks out  — same, long runs at their biggest
 *   taper  the week(s) before race week — ~25% less volume, workouts one rep shorter
 *          (taper length: ≤10K 7 days, half 10, marathon 14 — only weeks *before* race week count)
 *   race week — 2–3 days before: short and easy; the day before: rest; race day: the race
 * Fun / training races just get the race-week handling (lighter: day before is easy, not rest).
 * After every race: recovery days (5K 2, 10K 4, half 7, marathon 14; trail ×1.3; halved for
 * fun races ≤10K) — the first ~third are rest, the rest are short easy runs with no workouts.
 */
import { addDays, diffDays } from './dates.ts';
import { predictTime, RACE_METERS, trainingPaces } from './pace.ts';
import type { DateKey, ExperienceLevel, PlannedSession, Race, RaceDistance } from './types.ts';

export type RacePhase = 'base' | 'build' | 'peak' | 'taper' | 'race_week';

export function nearestStandard(distanceM: number): RaceDistance {
  const entries = Object.entries(RACE_METERS) as [RaceDistance, number][];
  return entries.reduce((best, cur) => (Math.abs(Math.log(cur[1] / distanceM)) < Math.abs(Math.log(best[1] / distanceM)) ? cur : best))[0];
}

export function taperDays(r: Race): number {
  return r.distanceM <= 10500 ? 7 : r.distanceM <= 25000 ? 10 : 14;
}

export function recoveryDays(r: Race): number {
  const base = r.distanceM <= 5500 ? 2 : r.distanceM <= 10500 ? 4 : r.distanceM <= 25000 ? 7 : 14;
  const terrain = r.terrain === 'trail' ? 1.3 : 1;
  const fun = !r.pbAttempt && r.distanceM <= 10500 ? 0.5 : 1;
  return Math.max(1, Math.round(base * terrain * fun));
}

export function upcomingRaces(races: Race[] | undefined, from: DateKey): Race[] {
  return (races ?? []).filter((r) => r.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** The A race this week trains toward (nearest PB attempt within 26 weeks). */
export function keyRace(races: Race[] | undefined, weekStart: DateKey): Race | undefined {
  return upcomingRaces(races, weekStart).find((r) => r.pbAttempt && diffDays(weekStart, r.date) <= 26 * 7);
}

export function phaseFor(race: Race, weekStart: DateKey): RacePhase {
  const d = diffDays(weekStart, race.date);
  if (d <= 6) return 'race_week';
  if (d <= 6 + taperDays(race)) return 'taper';
  if (d <= 4 * 7 + 6) return 'peak';
  if (d <= 12 * 7 + 6) return 'build';
  return 'base';
}

export interface RaceWeekPlan {
  race?: Race;
  phase: RacePhase;
  volumeFactor: number;
  /** Force a race-specific workout this week (PB attempts, seasoned runners, build/peak/taper). */
  workout?: { kind: 'tempo' | 'intervals' | 'hills'; targetPace?: number; label: string };
  /** Target minutes for the long run this week (build/peak for 10K+). */
  longRunMin?: number;
  shortenReps: boolean;
}

/** Race pace (sec/km) for a race, from a goal time or the fitness estimate. */
export function racePace(race: Race, fiveKSec: number | null): number | null {
  const km = race.distanceM / 1000;
  if (race.goalTimeSec) return race.goalTimeSec / km;
  if (!fiveKSec) return null;
  return predictTime(fiveKSec, nearestStandard(race.distanceM)) / (RACE_METERS[nearestStandard(race.distanceM)] / 1000);
}

const LONG_TARGET: Record<RaceDistance, number> = { '5k': 50, '10k': 70, half: 100, marathon: 160 };

export function raceWeekPlan(races: Race[] | undefined, weekStart: DateKey, level: ExperienceLevel, fiveKSec: number | null): RaceWeekPlan {
  const race = keyRace(races, weekStart);
  if (!race) return { phase: 'base', volumeFactor: 1, shortenReps: false };
  const phase = phaseFor(race, weekStart);
  const seasoned = level === 'consistent' || level === 'experienced';
  const std = nearestStandard(race.distanceM);
  const plan: RaceWeekPlan = { race, phase, volumeFactor: phase === 'taper' ? 0.75 : 1, shortenReps: phase === 'taper' };
  if (seasoned && (phase === 'build' || phase === 'peak' || phase === 'taper')) {
    const pace = racePace(race, fiveKSec);
    const paces = fiveKSec ? trainingPaces(fiveKSec) : null;
    if (race.terrain === 'trail') plan.workout = { kind: 'hills', label: 'Hills' };
    else if (std === '5k') plan.workout = { kind: 'intervals', targetPace: pace ?? paces?.interval, label: 'Race-pace intervals' };
    else if (std === '10k') plan.workout = { kind: 'intervals', targetPace: pace ?? paces?.interval, label: '10K-pace intervals' };
    else plan.workout = { kind: 'tempo', targetPace: pace ?? paces?.tempo, label: std === 'marathon' ? 'Marathon-pace tempo' : 'Half-pace tempo' };
  }
  if ((phase === 'build' || phase === 'peak') && race.distanceM >= 9500) {
    const weeksOut = Math.ceil(diffDays(weekStart, race.date) / 7);
    // Grow from ~55% of the target 12 weeks out to 100% at 3 weeks out; beginners cap lower.
    const progress = Math.min(1, Math.max(0.55, 1 - (weeksOut - 3) * 0.05));
    const cap = level === 'new' ? 0.6 : level === 'returning' ? 0.8 : 1;
    plan.longRunMin = Math.round((LONG_TARGET[std] * progress * cap) / 5) * 5;
  }
  return plan;
}

export function raceSession(race: Race, fiveKSec: number | null): PlannedSession {
  const pace = racePace(race, fiveKSec);
  const minutes = Math.round(((pace ?? 420) * race.distanceM) / 1000 / 60);
  return {
    id: `race-${race.id}`,
    date: race.date,
    kind: 'run',
    runType: 'race',
    title: race.name,
    durationMin: minutes,
    raceId: race.id,
    targetPaceSecPerKm: race.pbAttempt && pace ? Math.round(pace) : undefined,
    optional: false,
    status: 'planned',
    note: race.pbAttempt ? 'PB attempt. Start controlled, finish strong.' : 'Enjoy it — run by feel.',
  };
}

function shorten(s: PlannedSession, factor: number, note: string): PlannedSession {
  if (s.kind !== 'run' || s.runType === 'race' || s.walkRun) return s.walkRun ? { ...s, note } : s;
  const minutes = Math.max(10, Math.round((s.durationMin * factor) / 5) * 5);
  return {
    ...s,
    runType: 'easy',
    workout: undefined,
    strides: undefined,
    targetPaceSecPerKm: undefined,
    durationMin: minutes,
    title: `Easy run · ${minutes} min`,
    note,
  };
}

/**
 * Insert race days and reshape the days around them. Applies to every race
 * whose race-week or recovery window touches [start, end].
 */
export function applyRaceDays(sessions: PlannedSession[], races: Race[] | undefined, start: DateKey, end: DateKey, fiveKSec: number | null): PlannedSession[] {
  let out = [...sessions];
  for (const race of races ?? []) {
    const rec = recoveryDays(race);
    if (race.date > addDays(end, 3) || addDays(race.date, rec) < start) continue;
    out = out.flatMap((s) => {
      const d = diffDays(race.date, s.date); // negative = before race
      if (s.status !== 'planned' && s.status !== 'missed') return [s];
      if (d === 0) return []; // replaced by the race below
      if (d === -1) {
        if (race.pbAttempt || s.kind === 'strength') return []; // rest the day before
        return [shorten(s, 0.5, 'Day before a race: keep it very short and easy (or rest).')];
      }
      if (d >= -3 && d <= -2) return [shorten(s, race.pbAttempt ? 0.6 : 0.8, `${race.name} is in ${-d} days: short and easy.`)];
      if (d > 0 && d <= rec) {
        if (d <= Math.ceil(rec * 0.3)) return [];
        if (s.kind === 'strength') return [{ ...s, note: 'Post-race: gentle mobility only.' }];
        return [shorten(s, 0.6, `Recovering from ${race.name}. Easy and short.`)];
      }
      return [s];
    });
    if (race.date >= start && race.date <= end && !out.some((s) => s.raceId === race.id)) out.push(raceSession(race, fiveKSec));
  }
  return out.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date < b.date ? -1 : 1));
}

export function phaseLabel(p: RacePhase): string {
  return { base: 'Base building', build: 'Build phase', peak: 'Peak phase', taper: 'Taper', race_week: 'Race week' }[p];
}
