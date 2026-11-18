/** Consistency metrics derived from the plan. */
import { addDays, diffDays, rangeKeys } from './dates.ts';
import { allSessions } from './plan.ts';
import type { AppState, DateKey, PlannedSession } from './types.ts';

export function isPaused(state: Pick<AppState, 'pauses'>, k: DateKey): boolean {
  return state.pauses.some((p) => p.start <= k && k <= p.end);
}

/** Sessions that count toward completion %: core (non-optional), not dropped/paused. */
export function countsTowardCompletion(s: PlannedSession): boolean {
  return !s.optional && s.status !== 'dropped' && s.status !== 'paused';
}

/**
 * Plan completion over [from, to]. Sessions dated today or later only count if
 * already completed (you can't "miss" today before it's over).
 */
export function completionRate(state: AppState, from: DateKey, to: DateKey, today: DateKey): { rate: number; done: number; due: number } {
  const sessions = allSessions(state.plan).filter(
    (s) => countsTowardCompletion(s) && s.date >= from && s.date <= to && !isPaused(state, s.date),
  );
  const due = sessions.filter((s) => s.date < today || s.status === 'completed');
  const done = due.filter((s) => s.status === 'completed').length;
  // No sessions due yet: treat as fully consistent rather than 0% (fresh plans, pauses).
  return { rate: due.length ? done / due.length : 1, done, due: due.length };
}

export function completionLastDays(state: AppState, today: DateKey, days: number) {
  return completionRate(state, addDays(today, -(days - 1)), today, today);
}

/** Weeks (of the last 4 plan weeks, including the current one) with ≥1 completed session. */
export function activeWeeks(state: AppState, today: DateKey, n = 4): number {
  if (!state.plan) return 0;
  const weeks = state.plan.weeks.filter((w) => w.start <= today).slice(-n);
  return weeks.filter((w) => w.sessions.some((s) => s.status === 'completed')).length;
}

export function consistency(state: AppState, today: DateKey) {
  const c28 = completionLastDays(state, today, 28);
  return { completion28: c28.rate, activeWeeks4: activeWeeks(state, today, 4) };
}

/**
 * Plan streak: consecutive days on which the plan was honoured. Rest days count
 * (resting is part of the plan); a missed/skipped core session ends it; paused
 * days are neutral; today only counts once its sessions are done.
 */
export function planStreak(state: AppState, today: DateKey): number {
  if (!state.plan) return 0;
  const byDate = new Map<DateKey, PlannedSession[]>();
  for (const s of allSessions(state.plan)) {
    if (!countsTowardCompletion(s)) continue;
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }
  let streak = 0;
  for (let k = today; k >= state.plan.startDate; k = addDays(k, -1)) {
    if (isPaused(state, k)) continue;
    const sessions = byDate.get(k) ?? [];
    const allDone = sessions.every((s) => s.status === 'completed');
    if (k === today && !allDone) continue; // still pending today
    if (!allDone) break;
    streak += 1;
  }
  return streak;
}

export interface DayStatus {
  date: DateKey;
  state: 'done' | 'missed' | 'rest' | 'planned' | 'paused' | 'none' | 'extra';
}

/** One entry per day for the consistency calendar. */
export function calendar(state: AppState, from: DateKey, to: DateKey, today: DateKey): DayStatus[] {
  const sessions = allSessions(state.plan);
  return rangeKeys(from, to).map((date) => {
    if (isPaused(state, date)) return { date, state: 'paused' };
    const day = sessions.filter((s) => s.date === date && s.status !== 'dropped');
    const core = day.filter((s) => !s.optional);
    const extra = state.activities.some((a) => a.date === date && !a.plannedSessionId);
    if (day.some((s) => s.status === 'completed') || extra) {
      return { date, state: core.length === 0 && !day.some((s) => s.status === 'completed') ? 'extra' : 'done' };
    }
    if (!state.plan || date < state.plan.startDate) return { date, state: 'none' };
    if (core.length === 0) return { date, state: date <= today ? 'rest' : 'none' };
    if (date < today) return { date, state: 'missed' };
    return { date, state: 'planned' };
  });
}

export function daysSinceLastActivity(state: AppState, today: DateKey): number | null {
  const last = state.activities.reduce<DateKey | null>((m, a) => (!m || a.date > m ? a.date : m), null);
  return last ? diffDays(last, today) : null;
}
