/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, importHistory, onboard, pendingCheckIns, submitFeedback, todaySessions } from '../engine.ts';
import { matchImportedRun } from '../matching.ts';
import { addDays } from '../dates.ts';
import { allSessions } from '../plan.ts';
import { XP } from '../xp.ts';
import type { AppState, ImportedRun } from '../types.ts';

const START = '2026-01-05'; // returning runner: runs day 0, 2, 4; strength on a rest day

function runner(): AppState {
  return onboard(createInitialState(START), { level: 'returning', frequency: 2, goal: 'habit', issues: [], includeQuality: false }, START);
}
let n = 0;
function watch(date: string, minutes: number, extra: Partial<ImportedRun> = {}): ImportedRun {
  n++;
  const startedAt = Date.parse(`${date}T07:00:00`) + n * 3_600_000;
  return { id: `ah-${n}`, source: 'apple_health', externalId: `x${n}`, date, startedAt, durationSec: minutes * 60, distanceM: minutes * 160, avgHr: 141, title: 'Run (Garmin Connect)', ...extra };
}

test('a watch run on a planned day ticks it off with normal XP and asks for a check-in', () => {
  const s = runner();
  const planned = todaySessions(s, START)[0];
  const r = importHistory(s, [watch(START, planned.durationMin + 2)], START);
  assert.equal(todaySessions(r.state, START).find((x) => x.id === planned.id)!.status, 'completed');
  const act = r.state.activities[0];
  assert.equal(act.importedFrom, 'apple_health');
  assert.equal(act.xpEarned, XP.run);
  assert.equal(act.healthSynced, true, 'never written back to Health');
  assert.equal(pendingCheckIns(r.state, START).length, 1);
  assert.equal(pendingCheckIns(submitFeedback(r.state, act.id, 'easy', 'none', START).state, START).length, 0);
  assert.equal(importHistory(r.state, [watch(START, planned.durationMin + 2, { externalId: `x${n}`, id: `ah-${n}` })], START).state.activities.length, 1, 'no double count');
});

test('every activity counts — odd lengths, rest days, strength — with no questions asked', () => {
  const s = runner();
  const planned = todaySessions(s, START)[0];
  const short = importHistory(s, [watch(START, 6)], START).state;
  assert.equal(todaySessions(short, START).find((x) => x.id === planned.id)!.status, 'completed', 'short run still ticks it off (partial XP)');
  assert.ok(short.activities[0].xpEarned > 0 && short.activities[0].xpEarned < XP.run);
  const rest = importHistory(s, [watch(addDays(START, 1), 30)], addDays(START, 1)).state;
  assert.equal(rest.activities.length, 1);
  assert.equal(rest.activities[0].xpEarned, XP.extraSession);
  const strengthDay = allSessions(s.plan).find((x) => x.kind === 'strength')!;
  const str = importHistory(s, [watch(strengthDay.date, 15, { kind: 'strength', title: 'Traditional Strength Training (Garmin)' })], strengthDay.date).state;
  assert.equal(allSessions(str.plan).find((x) => x.id === strengthDay.id)!.status, 'completed');
  assert.equal(str.activities[0].xpEarned, XP.strength);
  assert.equal((str.pendingMatches ?? []).length, 0);
});

test('activities from earlier in the plan count too, and extras cap at 3 a day', () => {
  const s = runner();
  const later = addDays(START, 10);
  const r = importHistory(s, [watch(START, 25)], later);
  assert.equal(r.state.activities.length, 1, 'ten days later still counts');
  const day = addDays(START, 1);
  const many = importHistory(s, [1, 2, 3, 4, 5].map(() => watch(day, 20)), day).state;
  assert.equal(many.activities.length, 5);
  assert.equal(many.activities.filter((a) => a.xpEarned > 0).length, XP.extraPerDay);
});

test('history from before the plan only sets fitness; Steady-recorded runs never double count', () => {
  const s = runner();
  assert.equal(matchImportedRun(s, watch(addDays(START, -10), 30), START), null);
  const planned = todaySessions(s, START)[0];
  const mine = { ...s, activities: [{ id: 'mine', date: START, startedAt: Date.parse(`${START}T07:02:00`), endedAt: 0, kind: 'run' as const, title: 'x', durationSec: 1500, xpEarned: 50, completion: 1 }] };
  assert.equal(matchImportedRun(mine, { ...watch(START, planned.durationMin), startedAt: Date.parse(`${START}T07:00:00`) }, START), null);
});
