/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countImportedRun, createInitialState, dismissMatch, importHistory, onboard, pendingCheckIns, submitFeedback, todaySessions, updateProfile } from '../engine.ts';
import { matchImportedRun } from '../matching.ts';
import { addDays } from '../dates.ts';
import type { AppState, ImportedRun } from '../types.ts';

const START = '2026-01-05'; // plan week: runs on day 0, 2, 4

function runner(): AppState {
  return onboard(createInitialState(START), { level: 'returning', frequency: 2, goal: 'habit', issues: [], includeQuality: false }, START);
}
function watchRun(date: string, minutes: number, extra: Partial<ImportedRun> = {}): ImportedRun {
  const startedAt = Date.parse(`${date}T07:00:00`);
  return { id: `ah-${date}-${minutes}`, source: 'apple_health', externalId: `${date}-${minutes}`, date, startedAt, durationSec: minutes * 60, distanceM: minutes * 160, avgHr: 141, title: 'Run (Garmin Connect)', ...extra };
}

test('a watch run on a planned day is counted automatically with normal XP', () => {
  const s = runner();
  const planned = todaySessions(s, START)[0];
  const r = importHistory(s, [watchRun(START, planned.durationMin + 2)], START);
  const done = todaySessions(r.state, START).find((x) => x.id === planned.id)!;
  assert.equal(done.status, 'completed');
  const act = r.state.activities[0];
  assert.equal(act.importedFrom, 'apple_health');
  assert.equal(act.avgHr, 141);
  assert.equal(act.healthSynced, true, 'never written back to Health (it came from there)');
  assert.equal(r.state.rank.seasonXp, 50);
  assert.ok(r.events.some((e) => e.type === 'watch_run_counted'));
  assert.equal(pendingCheckIns(r.state, START).length, 1, 'asks how it felt');
  const f = submitFeedback(r.state, act.id, 'easy', 'none', START).state;
  assert.equal(pendingCheckIns(f, START).length, 0);
  // Re-importing the same run does nothing.
  assert.equal(importHistory(r.state, [watchRun(START, planned.durationMin + 2)], START).state.activities.length, 1);
});

test('a run done yesterday still ticks off yesterday’s (missed) session', () => {
  let s = runner();
  const planned = todaySessions(s, START)[0];
  const r = importHistory(s, [watchRun(START, planned.durationMin)], addDays(START, 1));
  assert.equal(r.state.plan!.weeks[0].sessions.find((x) => x.id === planned.id)!.status, 'completed');
});

test('ambiguous runs ask instead of guessing; nothing-planned days offer an extra run', () => {
  const s = runner();
  const planned = todaySessions(s, START)[0];
  const tooShort = importHistory(s, [watchRun(START, 4 + 2)], START); // tiny run (6 min)
  assert.equal(tooShort.state.pendingMatches!.length, 1);
  assert.equal(tooShort.state.pendingMatches![0].sessionId, planned.id);
  assert.match(tooShort.state.pendingMatches![0].reason, /planned/);
  const restDay = importHistory(s, [watchRun(addDays(START, 1), 30)], addDays(START, 1));
  assert.equal(restDay.state.pendingMatches![0].sessionId, null);
  // Saying yes counts it; saying no just clears it.
  const yes = countImportedRun(restDay.state, restDay.state.pendingMatches![0].importedRunId, null, addDays(START, 1)).state;
  assert.equal(yes.activities.length, 1);
  assert.equal(yes.pendingMatches!.length, 0);
  assert.equal(dismissMatch(restDay.state, restDay.state.pendingMatches![0].importedRunId).pendingMatches!.length, 0);
});

test('old history never back-fills sessions, and the toggle turns auto-counting off', () => {
  const s = runner();
  assert.equal(matchImportedRun(s, watchRun(addDays(START, -10), 30), START), null, 'before the plan started');
  const later = addDays(START, 10);
  const old = importHistory(s, [watchRun(START, 25)], later);
  assert.equal(old.state.activities.length, 0, 'more than 3 days ago');
  const off = updateProfile(s, { autoCountWatchRuns: false }, START);
  const planned = todaySessions(off, START)[0];
  const r = importHistory(off, [watchRun(START, planned.durationMin)], START);
  assert.equal(r.state.activities.length, 0);
  assert.equal(r.state.pendingMatches!.length, 1, 'asks instead');
});

test('runs Steady recorded itself are never double counted', () => {
  let s = runner();
  const planned = todaySessions(s, START)[0];
  s = { ...s, activities: [{ id: 'mine', date: START, startedAt: Date.parse(`${START}T07:02:00`), endedAt: 0, kind: 'run', title: 'x', durationSec: 1500, xpEarned: 50, completion: 1 }] };
  assert.equal(matchImportedRun(s, watchRun(START, planned.durationMin), START), null);
});
