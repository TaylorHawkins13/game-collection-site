/**
 * Pure GPS run-tracking reducer. The background location task feeds raw fixes
 * in; this filters noise, accumulates distance and splits, and tracks moving
 * time across pause/resume. Time is derived from timestamps, never from JS
 * timers, so it stays correct while the app is backgrounded or the screen is off.
 */
import type { RoutePoint, Split, Units } from './types.ts';

export const METERS_PER_UNIT: Record<Units, number> = { km: 1000, mi: 1609.344 };

export interface RawFix {
  lat: number;
  lng: number;
  t: number;
  accuracy?: number | null;
  alt?: number | null;
}

export interface TrackerState {
  startedAt: number;
  /** Moving segments: [start, end]; end undefined while running. */
  segments: { start: number; end?: number }[];
  paused: boolean;
  treadmill: boolean;
  points: RoutePoint[];
  distanceM: number;
  /** Moving time (ms) at the last accepted point. */
  movingMsAtLast: number;
  /** True right after start/resume: the next fix anchors but adds no distance. */
  needsAnchor: boolean;
  splitUnitM: number;
  splits: Split[];
  lastSplitMovingMs: number;
}

export const MAX_ACCURACY_M = 30;
export const MAX_SPEED_MPS = 8; // anything faster is a GPS jump, not a runner
export const MIN_STEP_M = 3; // ignore jitter while standing still

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function createTracker(now: number, units: Units, treadmill = false): TrackerState {
  return {
    startedAt: now,
    segments: [{ start: now }],
    paused: false,
    treadmill,
    points: [],
    distanceM: 0,
    movingMsAtLast: 0,
    needsAnchor: true,
    splitUnitM: METERS_PER_UNIT[units],
    splits: [],
    lastSplitMovingMs: 0,
  };
}

export function pauseTracker(t: TrackerState, now: number): TrackerState {
  if (t.paused) return t;
  const segments = t.segments.map((s, i) => (i === t.segments.length - 1 ? { ...s, end: now } : s));
  return { ...t, paused: true, segments };
}

export function resumeTracker(t: TrackerState, now: number): TrackerState {
  if (!t.paused) return t;
  return { ...t, paused: false, needsAnchor: true, segments: [...t.segments, { start: now }] };
}

export function movingMs(t: TrackerState, now: number): number {
  return t.segments.reduce((sum, s) => sum + Math.max(0, (s.end ?? now) - s.start), 0);
}

/** Moving time (ms) elapsed by wall-clock timestamp `ts` — correct for past timestamps too. */
export function movingAt(t: TrackerState, ts: number): number {
  return t.segments.reduce((sum, s) => sum + Math.max(0, Math.min(s.end ?? ts, ts) - s.start), 0);
}

/** Is timestamp `ts` inside a moving segment? */
function inMovingSegment(t: TrackerState, ts: number): boolean {
  return t.segments.some((s) => ts >= s.start && (s.end === undefined || ts <= s.end));
}

export function addFix(t: TrackerState, fix: RawFix): TrackerState {
  if (t.paused || t.treadmill) return t;
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) return t;
  if (!inMovingSegment(t, fix.t)) return t;
  const point: RoutePoint = { lat: fix.lat, lng: fix.lng, t: fix.t, ...(fix.alt != null ? { alt: fix.alt } : {}) };
  const prev = t.points[t.points.length - 1];
  const movingAtFix = movingAt(t, fix.t);

  if (t.needsAnchor || !prev) {
    return { ...t, points: [...t.points, point], needsAnchor: false, movingMsAtLast: movingAtFix };
  }
  const dt = (fix.t - prev.t) / 1000;
  if (dt <= 0) return t;
  const d = haversine(prev, point);
  if (d < MIN_STEP_M) return t;
  if (d / dt > MAX_SPEED_MPS) return t;

  const distanceM = t.distanceM + d;
  const splits = [...t.splits];
  let lastSplitMovingMs = t.lastSplitMovingMs;
  // A single step can (in theory) cross more than one split boundary.
  while (distanceM >= (splits.length + 1) * t.splitUnitM) {
    const boundary = (splits.length + 1) * t.splitUnitM;
    const frac = (boundary - t.distanceM) / d;
    const atMs = t.movingMsAtLast + frac * (movingAtFix - t.movingMsAtLast);
    splits.push({ index: splits.length + 1, distanceM: t.splitUnitM, durationSec: Math.round((atMs - lastSplitMovingMs) / 1000) });
    lastSplitMovingMs = atMs;
  }
  return { ...t, points: [...t.points, point], distanceM, splits, lastSplitMovingMs, movingMsAtLast: movingAtFix };
}

/** Final splits including the partial last one. */
export function finalSplits(t: TrackerState, now: number): Split[] {
  const rest = t.distanceM - t.splits.length * t.splitUnitM;
  if (rest < 50) return t.splits;
  return [
    ...t.splits,
    { index: t.splits.length + 1, distanceM: Math.round(rest), durationSec: Math.round((movingMs(t, now) - t.lastSplitMovingMs) / 1000) },
  ];
}

/** Rolling pace (sec per unit) over the last `windowSec` of points. */
export function currentPace(t: TrackerState, now: number, windowSec = 30): number | null {
  if (t.paused || t.points.length < 2) return null;
  const cutoff = now - windowSec * 1000;
  const recent = t.points.filter((p) => p.t >= cutoff);
  if (recent.length < 2) return null;
  let d = 0;
  for (let i = 1; i < recent.length; i++) d += haversine(recent[i - 1], recent[i]);
  const secs = (recent[recent.length - 1].t - recent[0].t) / 1000;
  if (d < 10 || secs <= 0) return null;
  return (secs / d) * t.splitUnitM;
}

export function averagePace(distanceM: number, durationSec: number, units: Units): number | null {
  if (distanceM < 50 || durationSec <= 0) return null;
  return (durationSec / distanceM) * METERS_PER_UNIT[units];
}

/** Privacy: drop the first/last `meters` of a route before showing or sharing it. */
export function trimRouteEnds(route: RoutePoint[], meters = 200): RoutePoint[] {
  if (route.length < 3) return [];
  let total = 0;
  for (let i = 1; i < route.length; i++) total += haversine(route[i - 1], route[i]);
  if (total <= meters * 2.5) return [];
  let startIdx = 0;
  for (let acc = 0; startIdx < route.length - 1 && acc < meters; startIdx++) acc += haversine(route[startIdx], route[startIdx + 1]);
  let endIdx = route.length - 1;
  for (let acc = 0; endIdx > 0 && acc < meters; endIdx--) acc += haversine(route[endIdx - 1], route[endIdx]);
  return endIdx > startIdx ? route.slice(startIdx, endIdx + 1) : [];
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function formatPace(secPerUnit: number | null, units: Units): string {
  if (secPerUnit === null || !isFinite(secPerUnit) || secPerUnit > 60 * 30) return `–:–– /${units}`;
  const s = Math.round(secPerUnit);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /${units}`;
}

export function formatDistance(m: number | undefined, units: Units): string {
  if (m === undefined) return '–';
  return `${(m / METERS_PER_UNIT[units]).toFixed(2)} ${units}`;
}
