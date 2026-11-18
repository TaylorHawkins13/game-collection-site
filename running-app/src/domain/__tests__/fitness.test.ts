/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeSession, createInitialState, onboard, savePersonalBest, submitFeedback, tick } from '../engine.ts';
import { addDays } from '../dates.ts';
import { currentFiveK } from '../fitness.ts';
import { allSessions } from '../plan.ts';
import type { AppState, Feel } from '../types.ts';

const START = '2026-01-05';

function runner(pbSec = 1500): AppState {
  return onboard(
    createInitialState(START),
    { level: 'consistent', frequency: null, goal: '5k_faster', issues: [], includeQuality: false, pbs: [{ distance: '5k', timeSec: pbSec, recency: 'recent' }] },
    START,
  );
}

/** Log a run of `km` at `paceSec` per km on `day`, planned if a session exists. */
function run(s: AppState, day: string, km: number, paceSec: number, feel: Feel, plannedId?: string) {
  const r = completeSession(
    s,
    { plannedSessionId: plannedId, kind: 'run', title: 'x', startedAt: Date.parse(day) + Math.random() * 1000, endedAt: Date.parse(day) + 1, durationSec: km * paceSec, distanceM: km * 1000 },
    day,
  );
  const f = submitFeedback(r.state, r.activity.id, feel, 'none', day);
  return { state: f.state, events: [...r.events, ...f.events] };
}

test('fitness starts from the PB', () => {
  assert.equal(currentFiveK(runner()), 1500);
});

test('a run faster than current fitness raises it (capped at 5%) and retargets workouts', () => {
  let s = runner(1500);
  // 5 km at 4:40/km = 23:20, much faster than a 25:00 estimate.
  const r = run(s, START, 5, 280, 'hard');
  s = r.state;
  assert.equal(currentFiveK(s), 1425, '5% cap');
  assert.ok(r.events.some((e) => e.type === 'fitness' && e.direction === 'up'));
  assert.ok(r.events.some((e) => e.type === 'possible_pb'), '5K run that beats the PB is offered as a PB');
  // Next week's workout uses the new paces.
  s = tick(s, addDays(START, 7)).state;
  const workout = allSessions(s.plan).find((x) => x.workout && x.status === 'planned');
  assert.ok(workout);
  assert.ok(workout!.targetPaceSecPerKm! < 321, `retargeted: ${workout!.targetPaceSecPerKm}`);
});

test('easy runs that keep feeling hard and slow ease paces and block progression', () => {
  let s = runner(1500); // easy 6:06–6:54/km
  for (let i = 0; i < 3; i++) s = run(s, addDays(START, i * 2), 5, 440, 'hard').state; // 7:20/km, hard
  assert.equal(currentFiveK(s), 1530, '2% slower');
  assert.ok(s.notices.some((n) => n.text.includes('feeling hard')));
  const next = tick(s, addDays(START, 7)).state;
  assert.notEqual(next.plan!.weeks[1].directive, 'progress');
});

test('two easy workouts in a row nudge fitness up; two hard ones nudge it down', () => {
  let s = runner(1500);
  s = tick(s, addDays(START, 7)).state; // week 2 has a tempo
  const w1 = s.plan!.weeks[1];
  const tempo = w1.sessions.find((x) => x.workout)!;
  s = run(s, tempo.date, 6, 360, 'easy', tempo.id).state;
  s = tick(s, addDays(START, 14)).state;
  const intervals = s.plan!.weeks[2].sessions.find((x) => x.workout)!;
  const before = currentFiveK(s)!;
  s = run(s, intervals.date, 6, 360, 'easy', intervals.id).state;
  assert.equal(currentFiveK(s), Math.round(before * 0.985));
});

test('a long break eases fitness once, and returning runs rebuild it', () => {
  let s = runner(1500);
  s = run(s, START, 5, 380, 'easy').state;
  s = tick(s, addDays(START, 28)).state; // 4 weeks off
  const eased = currentFiveK(s)!;
  assert.ok(eased > 1500 && eased <= 1650, `eased to ${eased}`);
  s = tick(s, addDays(START, 35)).state;
  assert.equal(currentFiveK(s), eased, 'applied once per break');
});

test('saving a detected PB updates PBs and fitness', () => {
  const s = savePersonalBest(runner(1500), { distance: '5k', timeSec: 1440 }, START).state;
  assert.equal(s.profile!.pbs.find((p) => p.distance === '5k')!.timeSec, 1440);
  assert.equal(currentFiveK(s), 1440);
});

test('runners without PBs get an estimate after 3 comfortable easy runs; new runners never do', () => {
  let s = onboard(createInitialState(START), { level: 'returning', frequency: 2, goal: 'habit', issues: [], includeQuality: false }, START);
  assert.equal(currentFiveK(s), null);
  for (let i = 0; i < 3; i++) s = run(s, addDays(START, i * 2), 4, 390, 'just_right').state;
  assert.equal(currentFiveK(s), 1500); // 6:30/km ÷ 1.3 × 5
  let n = onboard(createInitialState(START), { level: 'new', frequency: 0, goal: 'habit', issues: [], includeQuality: false }, START);
  for (let i = 0; i < 3; i++) n = run(n, addDays(START, i * 2), 3, 480, 'easy').state;
  assert.equal(currentFiveK(n), null);
});
