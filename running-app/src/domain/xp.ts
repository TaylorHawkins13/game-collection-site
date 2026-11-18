/**
 * Consistency XP (tunable).
 *
 * Planned runs: base from the PLANNED length, then weighted 70/30 toward
 *   (a) how it went against the session's target — reaching the length (+10%;
 *       short sessions scale down to −30%; going over adds nothing) and pace
 *       (easy runs in your easy range +10%; races at target pace +15%), and
 *   (b) how it compares with your own recent averages (length ±15%, pace).
 *   Plus +10 for doing a planned session. Floor 80% of base (50% if cut short).
 * Unplanned runs: half the base by actual length, adjusted against your averages.
 * Guardrails: no extra for rushing easy runs, no pace effect for walk-runs,
 * distance-less treadmill runs or "New to running"; unplanned XP up to 3 a day.
 */
import type { ExperienceLevel, RunType } from './types.ts';

export const XP = {
  strength: 30,
  /** Unplanned strength/mobility session. */
  extraSession: 15,
  /** Unplanned sessions that earn XP per day (so splitting one run into many can't game ranks). */
  extraPerDay: 3,
  plannedBonus: 10,
  weeklyTarget: 100,
  weeklyChallenge: 75,
  feedback: 10,
  restDay: 10,
  partialThreshold: 0.5,
  partialFactor: 0.6,
} as const;

/** Base XP by run length (moving time). */
export const LENGTH_TIERS: { minMin: number; xp: number; label: string }[] = [
  { minMin: 720, xp: 240, label: '12+ h' },
  { minMin: 480, xp: 210, label: '8–12 h' },
  { minMin: 360, xp: 180, label: '6–8 h' },
  { minMin: 240, xp: 155, label: '4–6 h' },
  { minMin: 180, xp: 130, label: '3–4 h' },
  { minMin: 120, xp: 110, label: '2–3 h' },
  { minMin: 90, xp: 90, label: '90–119 min' },
  { minMin: 60, xp: 75, label: '60–89 min' },
  { minMin: 45, xp: 60, label: '45–59 min' },
  { minMin: 30, xp: 50, label: '30–44 min' },
  { minMin: 15, xp: 40, label: '15–29 min' },
  { minMin: 0, xp: 30, label: 'under 15 min' },
];

export function lengthBase(durationSec: number): { xp: number; label: string } {
  const min = durationSec / 60;
  const t = LENGTH_TIERS.find((x) => min >= x.minMin)!;
  return { xp: t.xp, label: t.label };
}

export interface RunBaseline {
  /** Mean moving time of recent runs (sec). */
  avgDurationSec: number | null;
  /** Median pace of recent runs (sec/km). */
  avgPaceSecPerKm: number | null;
}

export interface XpPart {
  label: string;
  amount: number;
}

export interface RunTarget {
  durationSec: number;
  /** Easy/long runs: the easy range (fast, slow), sec/km. */
  paceRange?: [number, number];
  /** Races: target pace, sec/km. */
  paceTarget?: number;
  /** Workouts: target pace for the hard reps, and the average rep pace actually run (sec/km). */
  repPaceTarget?: number;
  repPace?: number | null;
}

export interface RunXpInput {
  durationSec: number;
  distanceM?: number;
  planned: boolean;
  runType?: RunType;
  level: ExperienceLevel;
  baseline: RunBaseline;
  /** The planned session's targets (planned runs only). */
  target?: RunTarget;
  /** Quick end of the easy range (sec/km), if known — caps the pace-vs-average bonus on easy/long runs. */
  easyFastPace?: number | null;
  treadmill?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Weight of "how it went vs the target" vs "how it compares with your averages" for planned runs. */
export const TARGET_WEIGHT = 0.7;

function vsAverages(i: RunXpInput, pace: number | null, paceEligible: boolean): { length: number; pace: number } {
  let length = 0;
  let p = 0;
  if (i.baseline.avgDurationSec) {
    const m = clamp((i.durationSec / i.baseline.avgDurationSec - 1) * 0.3, -0.15, 0.15);
    if (Math.abs(m) >= 0.02) length = m;
  }
  if (paceEligible && pace && i.baseline.avgPaceSecPerKm) {
    let effective = pace;
    if ((i.runType === 'easy' || i.runType === 'long') && i.easyFastPace) effective = Math.max(effective, i.easyFastPace);
    let m = clamp((i.baseline.avgPaceSecPerKm / effective - 1) * 1.5, -0.1, 0.15);
    // The easy-run cap only limits the bonus; a run that was actually quicker than usual is never penalised.
    if (pace <= i.baseline.avgPaceSecPerKm) m = Math.max(0, m);
    if (Math.abs(m) >= 0.02) p = m;
  }
  return { length, pace: p };
}

function vsTarget(i: RunXpInput, t: RunTarget, pace: number | null, paceEligible: boolean): { length: number; lengthLabel: string; pace: number; paceLabel: string | null } {
  const r = i.durationSec / t.durationSec;
  // Reach ≥95% → +10%; 80–95% → 0; below that down to −30% at half the session. Going over adds nothing.
  const length = r >= 0.95 ? 0.1 : r >= 0.8 ? 0 : clamp(-0.3 * ((0.8 - r) / 0.3), -0.3, 0);
  const lengthLabel = r >= 0.95 ? 'Hit the target length' : r >= 0.8 ? 'Nearly the full session' : 'Shorter than planned';
  let p = 0;
  let paceLabel: string | null = null;
  if (paceEligible && pace) {
    if (t.paceRange) {
      const [fast, slow] = t.paceRange;
      if (pace >= fast && pace <= slow * 1.05) {
        p = 0.1;
        paceLabel = 'Easy pace, as planned';
      } else if (pace < fast) {
        paceLabel = 'Quicker than easy — no pace bonus';
      }
      // Slower than the range is fine on an easy run: no penalty, no label.
    } else if (t.repPaceTarget) {
      // handled below (rep pace, not overall pace)
    } else if (t.paceTarget) {
      const rel = t.paceTarget / pace - 1; // + = quicker than target
      p = rel >= -0.02 ? 0.15 : clamp(rel * 2, -0.1, 0);
      paceLabel = rel >= -0.02 ? 'Hit your target pace' : 'Off your target pace';
    }
  }
  if (t.repPaceTarget && t.repPace && i.level !== 'new') {
    const rel = t.repPaceTarget / t.repPace - 1; // + = quicker than target
    p = rel >= -0.03 ? 0.15 : clamp(rel * 2, -0.1, 0);
    paceLabel = rel >= -0.03 ? 'Reps on target pace' : 'Reps slower than target';
  }
  return { length, lengthLabel, pace: p, paceLabel };
}

export function runXp(i: RunXpInput): { total: number; parts: XpPart[] } {
  const pace = i.distanceM && i.distanceM >= 1000 ? i.durationSec / (i.distanceM / 1000) : null;
  const paceEligible = !!pace && i.level !== 'new' && i.runType !== 'walk_run' && i.runType !== 'walk';
  const parts: XpPart[] = [];

  if (!i.planned || !i.target) {
    // Unplanned: half the base by actual length, adjusted against your own averages.
    const base = lengthBase(i.durationSec);
    const baseXp = i.planned ? base.xp : Math.round(base.xp / 2);
    parts.push({ label: `${i.planned ? 'Run' : 'Extra run'} · ${base.label}`, amount: baseXp });
    const avg = vsAverages(i, pace, paceEligible);
    if (avg.length) parts.push({ label: avg.length > 0 ? 'Longer than your usual' : 'Shorter than your usual', amount: Math.round(baseXp * avg.length) });
    if (avg.pace) parts.push({ label: avg.pace > 0 ? 'Quicker than your usual' : 'Slower than your usual', amount: Math.round(baseXp * avg.pace) });
    return finish(parts, baseXp, 0.8, i.planned);
  }

  // Planned: base from the PLANNED length, weighted mostly toward hitting the target.
  const base = lengthBase(i.target.durationSec);
  const baseXp = base.xp;
  parts.push({ label: `Planned run · ${base.label}`, amount: baseXp });
  const tgt = vsTarget(i, i.target, pace, paceEligible);
  const avg = vsAverages(i, pace, paceEligible);
  // Easy/long runs: going slower than your usual is the point — never a penalty.
  if (i.target.paceRange && avg.pace < 0) avg.pace = 0;
  const w = TARGET_WEIGHT;
  const add = (label: string | null, frac: number, weight: number) => {
    const amount = Math.round(baseXp * frac * weight);
    if (label && amount !== 0) parts.push({ label, amount });
  };
  add(tgt.lengthLabel, tgt.length, w);
  add(tgt.paceLabel, tgt.pace, w);
  if (tgt.paceLabel && tgt.pace === 0 && tgt.paceLabel.startsWith('Quicker')) parts.push({ label: tgt.paceLabel, amount: 0 });
  add(avg.length > 0 ? 'Longer than your usual' : 'Shorter than your usual', avg.length, 1 - w);
  add(avg.pace > 0 ? 'Quicker than your usual' : 'Slower than your usual', avg.pace, 1 - w);
  // A cut-short session can drop to half; otherwise showing up keeps at least 80%.
  const r = i.durationSec / i.target.durationSec;
  return finish(parts, baseXp, r < 0.8 ? 0.5 : 0.8, true);
}

function finish(parts: XpPart[], baseXp: number, floor: number, planned: boolean): { total: number; parts: XpPart[] } {
  const raw = parts.reduce((sum, p) => sum + p.amount, 0);
  const adjusted = Math.max(Math.round(baseXp * floor), raw);
  if (adjusted > raw) parts.push({ label: 'Showing-up floor', amount: adjusted - raw });
  let total = adjusted;
  if (planned) {
    parts.push({ label: 'Planned session done', amount: XP.plannedBonus });
    total += XP.plannedBonus;
  }
  return { total, parts };
}

/** Strength / mobility (and the legacy flat run rule, used for partial strength sessions). */
export function sessionXp(kind: 'run' | 'strength', planned: boolean, completion: number): number {
  if (!planned) return XP.extraSession;
  const base = kind === 'run' ? 50 : XP.strength;
  if (completion >= 0.9) return base;
  if (completion >= XP.partialThreshold) return Math.round(base * XP.partialFactor);
  return Math.round(base * 0.3);
}
