/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lengthBase, runXp } from '../xp.ts';
import { generateWeek, stepCap, LADDER } from '../plan.ts';
import { phaseFor, racePace, raceWeekPlan, recoveryDays, taperDays } from '../races.ts';
import { defaultProfile } from '../engine.ts';
import type { Race } from '../types.ts';

test('XP bands cover beginners through ultras and keep rising', () => {
  const mins = [10, 20, 35, 50, 70, 100, 150, 200, 300, 420, 600, 900, 1500];
  const xps = mins.map((m) => lengthBase(m * 60).xp);
  assert.deepEqual(xps, [30, 40, 50, 60, 75, 90, 110, 130, 155, 180, 210, 240, 240]);
  for (let i = 1; i < xps.length; i++) assert.ok(xps[i] >= xps[i - 1]);
  const hundredMiler = runXp({ durationSec: 26 * 3600, planned: true, level: 'experienced', baseline: { avgDurationSec: null, avgPaceSecPerKm: null }, target: { durationSec: 26 * 3600 } });
  assert.ok(hundredMiler.total > 250 && hundredMiler.parts[0].label.includes('12+ h'));
});

const ultra = (over: Partial<Race> = {}): Race => ({ id: 'u', name: 'Western States 100', date: '2026-06-27', distanceM: 160934, terrain: 'trail', pbAttempt: true, ...over });

test('ultra taper, recovery and a longer build', () => {
  assert.equal(taperDays(ultra()), 21);
  assert.equal(taperDays(ultra({ distanceM: 50000 })), 14);
  assert.equal(recoveryDays(ultra()), 35, '100 mi trail: 30 × 1.3, capped at 35');
  assert.equal(recoveryDays(ultra({ distanceM: 50000, terrain: 'road' })), 18);
  assert.equal(phaseFor(ultra(), '2026-03-16'), 'build', '15 weeks out is build for an ultra');
});

test('ultra pace prediction is slower than plain Riegel, and slower again on trail', () => {
  const road = racePace(ultra({ terrain: 'road', distanceM: 100000 }), 1200)!;
  const trail = racePace(ultra({ terrain: 'trail', distanceM: 100000 }), 1200)!;
  assert.ok(road > 1200 / 5 * 1.2, `road ultra pace ${road}`);
  assert.ok(trail > road * 1.1);
});

test('ultra build: hours-long long runs plus a back-to-back the day before', () => {
  const p = { ...defaultProfile({ level: 'experienced', frequency: null, goal: 'ultra', issues: [], includeQuality: false }, '2026-01-05'), runsPerWeek: 5 };
  assert.equal(stepCap('ultra', 'experienced'), 24);
  assert.equal(LADDER[24].minutes, 90);
  const peak = generateWeek(p, 20, '2026-05-18', 24, 'hold', 1200, [ultra()]);
  const long = peak.sessions.find((s) => s.runType === 'long')!;
  assert.ok(long.durationMin >= 240, `long run ${long.durationMin} min`);
  assert.match(long.title, / h/);
  const b2b = peak.sessions.find((s) => s.title.startsWith('Back-to-back'));
  assert.ok(b2b, 'back-to-back added');
  assert.ok(b2b!.durationMin >= long.durationMin * 0.4);
  assert.equal(peak.sessions.find((s) => s.workout)?.runType, 'hills', 'trail ultra → hills');
  assert.ok(raceWeekPlan([ultra()], '2026-05-18', 'experienced', 1200).backToBack);
});
