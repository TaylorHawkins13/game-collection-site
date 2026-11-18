/**
 * What goes on a shared run: consistency first (session, streak, week), with
 * distance/pace/route only when the runner chooses. Pure so it can be tested.
 */
import { formatShort, weekdayLong } from './dates.ts';
import { averagePace, formatDistance, formatDuration, formatPace, haversine, trimRouteEnds } from './gps.ts';
import { divisionLabel } from './ranks.ts';
import type { Activity, RoutePoint, Units } from './types.ts';

export interface ShareOptions {
  showDistance: boolean;
  showPace: boolean;
  showRoute: boolean;
  showRank: boolean;
  showStreak: boolean;
}

export function defaultShareOptions(level: string, hasRoute: boolean): ShareOptions {
  const beginner = level === 'new' || level === 'returning';
  return { showDistance: true, showPace: !beginner, showRoute: hasRoute, showRank: true, showStreak: true };
}

export interface ShareContext {
  units: Units;
  division: number;
  streak: number;
  weekDone: number;
  weekTotal: number;
}

export function shareHeadline(a: Activity): string {
  if (a.kind === 'strength') return 'Strength session done 💪';
  if (a.title && /race|marathon|half|10k|5k|parkrun/i.test(a.title) && !/^Easy|^Long|^Walk|^Tempo|^Intervals|^Hills/.test(a.title)) return `${a.title} — finished! 🏁`;
  return a.plannedSessionId ? 'Planned run: done ✅' : 'Bonus run ✅';
}

export function shareText(a: Activity, o: ShareOptions, ctx: ShareContext): string {
  const lines = [shareHeadline(a), `${weekdayLong(a.date)} ${formatShort(a.date)} · ${a.title}`];
  const stats = [`⏱ ${formatDuration(a.durationSec)}`];
  if (o.showDistance && a.distanceM) stats.push(`📍 ${formatDistance(a.distanceM, ctx.units)}`);
  const pace = a.distanceM ? averagePace(a.distanceM, a.durationSec, ctx.units) : null;
  if (o.showPace && pace) stats.push(`⚡ ${formatPace(pace, ctx.units)}`);
  lines.push(stats.join('  '));
  const extras: string[] = [];
  if (o.showStreak && ctx.streak >= 2) extras.push(`🔥 ${ctx.streak}-day plan streak`);
  if (o.showStreak && ctx.weekTotal > 0) extras.push(`${ctx.weekDone}/${ctx.weekTotal} sessions this week`);
  if (o.showRank) extras.push(`Rank: ${divisionLabel(ctx.division)}`);
  if (extras.length) lines.push(extras.join(' · '));
  lines.push('Tracked with Steady — showing up > speed.');
  return lines.join('\n');
}

/** Route scaled into a w×h box (privacy-trimmed), as "x,y x,y …" for an SVG polyline. */
export function routePolyline(route: RoutePoint[] | undefined, w: number, h: number, pad = 12, hideEnds = true): string | null {
  const pts = route ? (hideEnds ? trimRouteEnds(route) : route) : [];
  if (pts.length < 2) return null;
  const lat0 = pts[0].lat;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p.lng * kx);
  const ys = pts.map((p) => -p.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = Math.min((w - pad * 2) / (maxX - minX || span), (h - pad * 2) / (maxY - minY || span));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  // Thin very long routes so the string stays small.
  const step = Math.max(1, Math.floor(pts.length / 400));
  const out: string[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(`${(ox + (xs[i] - minX) * scale).toFixed(1)},${(oy + (ys[i] - minY) * scale).toFixed(1)}`);
  return out.join(' ');
}

export function routeLengthM(route: RoutePoint[]): number {
  let d = 0;
  for (let i = 1; i < route.length; i++) d += haversine(route[i - 1], route[i]);
  return d;
}
