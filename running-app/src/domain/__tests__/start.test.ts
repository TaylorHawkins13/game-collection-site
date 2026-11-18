/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeSession, createInitialState, missedThisWeek, onboard, setPlanStart, tick, todaySessions } from '../engine.ts';
import { addDays } from '../dates.ts';
import { consistency, planStreak } from '../metrics.ts';
import { currentWeek, upcomingPlanStart } from '../plan.ts';

const TODAY = '2026-11-18';
const answers = { level: 'returning' as const, frequency: 1 as const, goal: 'habit' as const, issues: [], includeQuality: false };

test('a plan can start on a future date; nothing is "missed" before it', () => {
  const jan1 = '2027-01-01';
  let s = onboard(createInitialState(TODAY), { ...answers, startDate: jan1 }, TODAY);
  assert.equal(s.plan!.startDate, jan1);
  assert.equal(s.plan!.weeks[0].sessions[0].date, jan1, 'first session on the start date');
  assert.equal(upcomingPlanStart(s.plan, TODAY)?.start, jan1);
  for (let d = TODAY; d < jan1; d = addDays(d, 7)) s = tick(s, d).state;
  s = tick(s, addDays(jan1, -1)).state;
  assert.equal(s.plan!.weeks.length, 1, 'no weeks generated before the start');
  assert.equal(missedThisWeek(s, addDays(jan1, -1)).length, 0);
  assert.equal(consistency(s, addDays(jan1, -1)).completion28, 1);
  assert.equal(planStreak(s, addDays(jan1, -1)), 0);
  // A run before the start still counts (as an extra).
  const r = completeSession(s, { kind: 'run', title: 'Early run', startedAt: 0, endedAt: 1, durationSec: 1800 }, '2026-12-20');
  assert.ok(r.activity.xpEarned > 0);
  // On the day, today's session is there.
  s = tick(s, jan1).state;
  assert.ok(currentWeek(s.plan!, jan1));
  assert.equal(todaySessions(s, jan1).filter((x) => !x.optional).length, 1);
});

test('changing the start before it begins rebuilds the plan', () => {
  let s = onboard(createInitialState(TODAY), { ...answers, startDate: '2026-11-23' }, TODAY);
  s = setPlanStart(s, TODAY, TODAY);
  assert.equal(s.plan!.startDate, TODAY);
  assert.equal(todaySessions(s, TODAY).filter((x) => !x.optional).length, 1);
  assert.equal(setPlanStart(s, addDays(TODAY, -3), TODAY), s, 'no dates in the past');
});

test('restarting a running plan keeps history and rank, clears what was left, starts a new block', () => {
  let s = onboard(createInitialState(TODAY), answers, TODAY);
  const first = todaySessions(s, TODAY)[0];
  s = completeSession(s, { plannedSessionId: first.id, kind: 'run', title: 'x', startedAt: 0, endedAt: 1, durationSec: first.durationMin * 60 }, TODAY).state;
  const xp = s.rank.seasonXp;
  const restart = addDays(TODAY, 10);
  s = setPlanStart(s, restart, addDays(TODAY, 1));
  assert.equal(s.rank.seasonXp, xp, 'XP and rank kept');
  assert.equal(s.activities.length, 1, 'history kept');
  const old = s.plan!.weeks[0];
  assert.ok(old.sessions.some((x) => x.status === 'completed'), 'completed session kept');
  assert.ok(!old.sessions.some((x) => x.status === 'planned' && x.date >= addDays(TODAY, 1)), 'remaining sessions cleared');
  assert.equal(s.plan!.weeks[s.plan!.weeks.length - 1].start, restart);
  assert.equal(upcomingPlanStart(s.plan, addDays(TODAY, 8))?.start, restart, 'gap before the new block');
  s = tick(s, addDays(TODAY, 9)).state;
  assert.equal(missedThisWeek(s, addDays(TODAY, 9)).length, 0, 'gap days are not misses');
});
