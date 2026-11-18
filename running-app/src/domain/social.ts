/**
 * Friends: shared pure helpers. What gets posted is built here so it's easy to
 * test that no coordinates or hidden stats ever leave the phone.
 */
import { averagePace } from './gps.ts';
import { divisionLabel } from './ranks.ts';
import { routePolyline, shareHeadline, type ShareContext, type ShareOptions } from './share.ts';
import type { Activity } from './types.ts';

/** Unambiguous alphabet (no 0/O/1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function friendCode(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

export function normaliseCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export interface SharedRunPayload {
  activity_date: string;
  kind: 'run' | 'strength';
  headline: string;
  title: string;
  duration_sec: number;
  distance_m: number | null;
  pace_sec_per_km: number | null;
  /** Shape only, scaled into a 100×60 box. Never coordinates. */
  route_shape: string | null;
  streak: number | null;
  week_done: number | null;
  week_total: number | null;
  rank_label: string | null;
}

export function buildSharedRun(a: Activity, o: ShareOptions, ctx: ShareContext, hideEnds: boolean): SharedRunPayload {
  const pace = o.showPace && a.distanceM ? averagePace(a.distanceM, a.durationSec, 'km') : null;
  return {
    activity_date: a.date,
    kind: a.kind,
    headline: shareHeadline(a).slice(0, 80),
    title: a.title.slice(0, 120),
    duration_sec: Math.round(a.durationSec),
    distance_m: o.showDistance && a.distanceM ? Math.round(a.distanceM) : null,
    pace_sec_per_km: pace ? Math.round(pace) : null,
    route_shape: o.showRoute ? routePolyline(a.route, 100, 60, 4, hideEnds) : null,
    streak: o.showStreak ? ctx.streak : null,
    week_done: o.showStreak ? ctx.weekDone : null,
    week_total: o.showStreak ? ctx.weekTotal : null,
    rank_label: o.showRank ? divisionLabel(ctx.division) : null,
  };
}
