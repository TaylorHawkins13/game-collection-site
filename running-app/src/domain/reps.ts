/**
 * Per-rep timing for structured workouts (tempo / intervals / hills).
 * Rep windows come from the workout structure in *moving* time; distance is
 * taken from GPS points inside each window (interpolating at the edges), so
 * pauses and the warm-up/recoveries never leak into rep pace.
 */
import { haversine, movingAt, type TrackerState } from './gps.ts';
import type { WalkRunStructure } from './types.ts';

export interface RepStat {
  index: number; // 1-based
  durationSec: number;
  distanceM: number;
  paceSecPerKm: number | null;
}

/** [start, end] moving seconds of each hard rep. */
export function repWindows(w: WalkRunStructure): [number, number][] {
  const out: [number, number][] = [];
  let t = w.warmupMin * 60;
  for (let i = 0; i < w.repeats; i++) {
    out.push([t, t + w.runSec]);
    t += w.runSec + w.walkSec;
  }
  return out;
}

/** Distance covered between moving-seconds a and b. */
function distanceBetween(t: TrackerState, a: number, b: number): number {
  const pts = t.points.map((p) => ({ p, m: movingAt(t, p.t) / 1000 }));
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const x = pts[i - 1];
    const y = pts[i];
    if (y.m <= a || x.m >= b || y.m <= x.m) continue;
    const seg = haversine(x.p, y.p);
    // Skip jumps across a pause (a resume re-anchors without distance).
    if (seg / Math.max(0.001, y.m - x.m) > 8) continue;
    const lo = Math.max(a, x.m);
    const hi = Math.min(b, y.m);
    d += seg * ((hi - lo) / (y.m - x.m));
  }
  return d;
}

/** Stats for every rep that has finished by `elapsedSec` (moving). */
export function repStats(t: TrackerState, w: WalkRunStructure, elapsedSec: number): RepStat[] {
  return repWindows(w)
    .filter(([, end]) => end <= elapsedSec + 0.5)
    .map(([s, e], i) => {
      const distanceM = t.treadmill ? 0 : distanceBetween(t, s, e);
      return { index: i + 1, durationSec: e - s, distanceM: Math.round(distanceM), paceSecPerKm: distanceM >= 50 ? Math.round((e - s) / (distanceM / 1000)) : null };
    });
}

/** Pace so far in the rep currently running, or null. */
export function currentRepPace(t: TrackerState, w: WalkRunStructure, elapsedSec: number): number | null {
  const win = repWindows(w).find(([s, e]) => elapsedSec >= s && elapsedSec < e);
  if (!win || elapsedSec - win[0] < 15) return null;
  const d = distanceBetween(t, win[0], elapsedSec);
  return d >= 30 ? (elapsedSec - win[0]) / (d / 1000) : null;
}

/** Duration-weighted average rep pace. */
export function averageRepPace(reps: RepStat[]): number | null {
  const ok = reps.filter((r) => r.paceSecPerKm && r.distanceM >= 50);
  if (!ok.length) return null;
  const dist = ok.reduce((s, r) => s + r.distanceM, 0);
  const time = ok.reduce((s, r) => s + r.durationSec, 0);
  return time / (dist / 1000);
}

export type RepVerdict = 'on_target' | 'quick' | 'slow';

/** Within 3% of target counts as on target. */
export function repVerdict(pace: number, target: number): RepVerdict {
  const rel = pace / target - 1;
  return rel < -0.03 ? 'quick' : rel > 0.03 ? 'slow' : 'on_target';
}

export function repCue(rep: RepStat, target: number | undefined, spokenPace: (secPerKm: number) => string): string {
  if (!rep.paceSecPerKm) return `Rep ${rep.index} done.`;
  const pace = spokenPace(rep.paceSecPerKm);
  if (!target) return `Rep ${rep.index}: ${pace}.`;
  const v = repVerdict(rep.paceSecPerKm, target);
  return `Rep ${rep.index}: ${pace}. ${v === 'on_target' ? 'Right on target.' : v === 'quick' ? 'A bit quick — ease into the next one.' : 'A little slow — that’s fine, keep it controlled.'}`;
}
