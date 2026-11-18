/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimRestDay,
  completeSession,
  createInitialState,
  dropSession,
  endPause,
  missedThisWeek,
  moveSession,
  onboard,
  pausePlan,
  submitFeedback,
  tick,
  todaySessions,
  updateProfile,
} from '../engine.ts';
import { addDays } from '../dates.ts';
import { consistency, planStreak } from '../metrics.ts';
import { XP } from '../xp.ts';
import type { AppState, PlannedSession } from '../types.ts';

const START = '2026-01-05';

function fresh(level: 'new' | 'experienced' = 'new'): AppState {
  return onboard(createInitialState(START), { level, frequency: 0, goal: 'habit', issues: [], includeQuality: false }, START);
}

function doSession(state: AppState, s: PlannedSession, day: string, feel: 'easy' | 'just_right' | 'hard' = 'easy') {
  const r = completeSession(
    state,
    { plannedSessionId: s.id, kind: s.kind, title: s.title, startedAt: Date.parse(day), endedAt: Date.parse(day) + s.durationMin * 60000, durationSec: s.durationMin * 60 },
    day,
  );
  const f = submitFeedback(r.state, r.activity.id, feel, 'none', day);
  return { state: f.state, events: [...r.events, ...f.events] };
}

/** Simulate a user who completes every core session for `weeks` weeks. */
function simulate(state: AppState, weeks: number) {
  let s = state;
  let day = s.plan!.startDate;
  const end = addDays(day, weeks * 7);
  for (; day < end; day = addDays(day, 1)) {
    s = tick(s, day).state;
    for (const sess of todaySessions(s, day)) {
      if (sess.optional || sess.status !== 'planned') continue;
      s = doSession(s, sess, day).state;
    }
  }
  return tick(s, day).state;
}

test('completing a planned run gives 50 XP + feedback bonus; first-session badge', () => {
  const s = fresh();
  const today = todaySessions(s, START)[0];
  const r = completeSession(s, { plannedSessionId: today.id, kind: 'run', title: today.title, startedAt: 0, endedAt: 1, durationSec: today.durationMin * 60 }, START);
  assert.equal(r.activity.xpEarned, XP.run);
  assert.ok(r.events.some((e) => e.type === 'badge' && e.id === 'first_session'));
  const f = submitFeedback(r.state, r.activity.id, 'easy', 'none', START);
  assert.equal(f.state.rank.seasonXp, XP.run + XP.feedback);
  // Feedback is only rewarded once.
  const again = submitFeedback(f.state, r.activity.id, 'hard', 'none', START);
  assert.equal(again.state.rank.seasonXp, XP.run + XP.feedback);
});

test('extra unplanned sessions earn a small amount, up to 3 a day', () => {
  let s = fresh();
  const xps: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = completeSession(s, { kind: 'run', title: `Extra ${i}`, startedAt: i, endedAt: i + 1, durationSec: 3600 }, START);
    xps.push(r.activity.xpEarned);
    s = r.state;
  }
  assert.deepEqual(xps, [XP.extraSession, XP.extraSession, XP.extraSession, 0]);
});

test('a full week pays the weekly target bonus and Week 1 badge', () => {
  const s = simulate(fresh(), 1);
  assert.ok(s.weeklyTargetPaid.includes(START));
  assert.ok(s.badges.week1_complete);
  assert.ok(s.badges.three_session_week);
});

test('missed sessions are marked, never punished, and can be rescheduled or dropped', () => {
  let s = fresh();
  const [first] = todaySessions(s, START);
  const day2 = addDays(START, 1);
  s = tick(s, day2).state;
  const missed = missedThisWeek(s, day2);
  assert.equal(missed[0].id, first.id);
  const xpBefore = s.rank.seasonXp;
  assert.equal(xpBefore, 0);
  const moved = moveSession(s, first.id, day2, day2);
  assert.equal(todaySessions(moved, day2).find((x) => x.id === first.id)?.status, 'planned');
  const dropped = dropSession(s, first.id);
  assert.equal(missedThisWeek(dropped, day2).length, 0);
});

test('consistent users climb through Bronze and Silver within a season', () => {
  const s = simulate(fresh(), 10);
  assert.ok(s.rank.division >= 3, `division ${s.rank.division}`);
  assert.ok(s.plan!.step > 0, 'plan progressed');
  assert.ok(s.badges.streak_7);
});

test('plan progresses gently: never more than one step per week', () => {
  const s = simulate(fresh(), 8);
  assert.ok(s.plan!.step <= 8);
});

test('pausing excludes days from completion and resumes cleanly', () => {
  let s = fresh();
  s = pausePlan(s, START, 7, 'sick');
  s = tick(s, addDays(START, 7)).state;
  assert.equal(consistency(s, addDays(START, 7)).completion28, 1, 'paused week not counted as missed');
  assert.equal(s.plan!.weeks[1].directive, 'ease');
  s = pausePlan(s, addDays(START, 7), 10, 'travel');
  s = endPause(s, addDays(START, 9));
  assert.ok(todaySessions(s, addDays(START, 9)).every((x) => x.status !== 'paused'));
});

test('rest days can be claimed once for a small reward', () => {
  let s = fresh();
  const rest = addDays(START, 1); // offsets 0,2,4 → day 1 is rest
  s = tick(s, rest).state;
  const r = claimRestDay(s, rest);
  assert.equal(r.state.rank.seasonXp, XP.restDay);
  assert.equal(claimRestDay(r.state, rest).state.rank.seasonXp, XP.restDay);
  assert.equal(claimRestDay(s, START).state.restClaims.length, 0, 'not on a session day');
});

test('season rollover records a finish badge and soft-resets', () => {
  let s = fresh('experienced');
  s = { ...s, rank: { ...s.rank, seasonId: '2026-Q1', division: 9, xp: 100, startDivision: 6 } };
  s = simulate(s, 2);
  // Jump to the next season.
  const r = tick(s, '2026-04-01');
  const reset = r.events.find((e) => e.type === 'season_reset');
  assert.ok(reset);
  assert.equal(r.state.rank.seasonId, '2026-Q2');
  assert.ok(r.state.seasonFinishes[0].label.startsWith('Platinum – Q1 2026'));
  assert.ok(r.state.rank.division < 9);
});

test('streak counts rest days and breaks on a missed session', () => {
  let s = simulate(fresh(), 2);
  const today = addDays(START, 14);
  assert.ok(planStreak(s, today) >= 13);
  const next = todaySessions(s, today)[0];
  assert.ok(next);
  s = tick(s, addDays(today, 1)).state;
  // Day 15 is a rest day (kept), day 14's run was missed → streak restarts.
  assert.equal(planStreak(s, addDays(today, 1)), 1);
});

test('changing runs per week rebuilds the rest of the current week only', () => {
  let s = fresh();
  s = doSession(s, todaySessions(s, START)[0], START).state;
  const updated = updateProfile(s, { runsPerWeek: 2 }, addDays(START, 1));
  const week = updated.plan!.weeks[0];
  assert.equal(week.sessions.filter((x) => x.status === 'completed').length, 1);
  assert.ok(week.sessions.filter((x) => x.kind === 'run').length <= 3);
});

test('gold promotion is gated by plan completion', () => {
  let s = fresh();
  s = { ...s, rank: { ...s.rank, division: 5, xp: 449 } };
  s = { ...s, activities: [] };
  // No completed sessions due → completion counts as 1 but active weeks are 0 → gated.
  const today = todaySessions(s, START)[0];
  const r = completeSession(s, { plannedSessionId: today.id, kind: 'run', title: 'x', startedAt: 0, endedAt: 1, durationSec: 9999 }, START);
  assert.equal(r.state.rank.division, 5);
  assert.ok(r.events.some((e) => e.type === 'gated'));
});
