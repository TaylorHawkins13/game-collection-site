/**
 * Training paces from personal bests.
 *
 * Every PB is converted to an equivalent 5K with Riegel's formula
 * (T2 = T1 × (D2/D1)^1.06), slowed a little for older results (and for
 * returning runners), and the best equivalent is used. Training paces are
 * fixed ratios of 5K pace, close to common coaching tables:
 *   easy 1.22–1.38× · tempo ≈1.07× · intervals ≈1.00× (5K pace)
 * All paces are seconds per km.
 */
import type { ExperienceLevel, GoalId, PersonalBest, RaceDistance } from './types.ts';

export const RACE_METERS: Record<RaceDistance, number> = { '5k': 5000, '10k': 10000, half: 21097.5, marathon: 42195 };
export const RACE_LABEL: Record<RaceDistance, string> = { '5k': '5K', '10k': '10K', half: 'Half marathon', marathon: 'Marathon' };

const RECENCY_FACTOR = { recent: 1, one_two_years: 1.05, older: 1.1 } as const;

export function riegel(timeSec: number, fromM: number, toM: number): number {
  return timeSec * Math.pow(toM / fromM, 1.06);
}

/** Current-fitness 5K equivalent in seconds, or null without PBs. */
export function fiveKEquivalent(pbs: PersonalBest[], level: ExperienceLevel): number | null {
  const valid = pbs.filter((p) => p.timeSec > 0 && isPlausible(p));
  if (!valid.length) return null;
  const returning = level === 'returning' ? 1.03 : 1;
  return Math.min(...valid.map((p) => riegel(p.timeSec, RACE_METERS[p.distance], 5000) * RECENCY_FACTOR[p.recency] * returning));
}

/** Reject typos: faster than world-class or slower than a brisk walk. */
export function isPlausible(p: PersonalBest): boolean {
  const perKm = p.timeSec / (RACE_METERS[p.distance] / 1000);
  return perKm >= 160 && perKm <= 720;
}

export interface TrainingPaces {
  fiveKSec: number;
  easy: [number, number];
  tempo: number;
  interval: number;
}

export function trainingPaces(fiveKSec: number): TrainingPaces {
  const p5 = fiveKSec / 5;
  return { fiveKSec, easy: [Math.round(p5 * 1.22), Math.round(p5 * 1.38)], tempo: Math.round(p5 * 1.07), interval: Math.round(p5) };
}

export function pacesFor(pbs: PersonalBest[], level: ExperienceLevel): TrainingPaces | null {
  const f = fiveKEquivalent(pbs, level);
  return f ? trainingPaces(f) : null;
}

export function predictTime(fiveKSec: number, distance: RaceDistance): number {
  return riegel(fiveKSec, 5000, RACE_METERS[distance]);
}

export const GOAL_DISTANCE: Partial<Record<GoalId, RaceDistance>> = {
  '5k': '5k',
  '5k_faster': '5k',
  '10k': '10k',
  '10k_faster': '10k',
  half: 'half',
  half_faster: 'half',
  marathon: 'marathon',
};

export function isFasterGoal(goal: GoalId): boolean {
  return goal === '5k_faster' || goal === '10k_faster' || goal === 'half_faster';
}

/** A realistic default target: ~3% quicker than current predicted fitness. */
export function suggestedGoalTime(pbs: PersonalBest[], level: ExperienceLevel, goal: GoalId): number | null {
  const d = GOAL_DISTANCE[goal];
  const f = fiveKEquivalent(pbs, level);
  if (!d || !f) return null;
  return Math.round(predictTime(f, d) * 0.97);
}

/** Parse "25:30", "1:52:10" or "52" (minutes). Returns seconds or null. */
export function parseTime(input: string): number | null {
  const parts = input.trim().split(':').map((x) => x.trim());
  if (!parts.length || parts.some((x) => x === '' || !/^\d+$/.test(x))) return null;
  const n = parts.map(Number);
  if (n.length === 1) return n[0] > 0 ? n[0] * 60 : null;
  if (n.length === 2) return n[1] < 60 && n[0] * 60 + n[1] > 0 ? n[0] * 60 + n[1] : null;
  if (n.length === 3) return n[1] < 60 && n[2] < 60 ? n[0] * 3600 + n[1] * 60 + n[2] : null;
  return null;
}

export function formatTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function paceLabel(secPerKm: number, units: 'km' | 'mi'): string {
  const v = Math.round(units === 'km' ? secPerKm : secPerKm * 1.609344);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}
