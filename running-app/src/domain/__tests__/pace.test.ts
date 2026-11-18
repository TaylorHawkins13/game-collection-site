/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fiveKEquivalent, formatTime, isPlausible, pacesFor, parseTime, predictTime, riegel, suggestedGoalTime } from '../pace.ts';
import { buildCues } from '../cues.ts';
import { defaultProfile } from '../engine.ts';
import { createPlan, generateWeek, startingStep } from '../plan.ts';
import { easeSession } from '../adaptation.ts';
import type { PersonalBest } from '../types.ts';

const TODAY = '2026-01-05';

test('time parsing and formatting', () => {
  assert.equal(parseTime('25:30'), 1530);
  assert.equal(parseTime('1:52:10'), 6730);
  assert.equal(parseTime('52'), 3120);
  assert.equal(parseTime('25:75'), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime(''), null);
  assert.equal(formatTime(1530), '25:30');
  assert.equal(formatTime(6730), '1:52:10');
});

test('Riegel conversion and best-equivalent 5K', () => {
  assert.ok(Math.abs(riegel(1500, 5000, 10000) - 3127) < 2);
  const pbs: PersonalBest[] = [
    { distance: '10k', timeSec: 3000, recency: 'recent' }, // ≈ 23:59 5K
    { distance: '5k', timeSec: 1500, recency: 'older' }, // 25:00 × 1.10 = 27:30
  ];
  const f = fiveKEquivalent(pbs, 'consistent')!;
  assert.ok(Math.abs(f - riegel(3000, 10000, 5000)) < 1, 'uses the best (10K) equivalent');
  assert.ok(fiveKEquivalent([{ distance: '5k', timeSec: 1500, recency: 'recent' }], 'returning')! > 1500, 'returning runners adjusted slower');
  assert.equal(fiveKEquivalent([], 'consistent'), null);
});

test('typos are rejected', () => {
  assert.ok(!isPlausible({ distance: '5k', timeSec: 300, recency: 'recent' })); // 5 min 5K
  assert.ok(!isPlausible({ distance: 'marathon', timeSec: 60 * 60 * 9, recency: 'recent' })); // walking pace
  assert.ok(isPlausible({ distance: 'half', timeSec: 2 * 3600, recency: 'recent' }));
});

test('training paces from a 25:00 5K', () => {
  const p = pacesFor([{ distance: '5k', timeSec: 1500, recency: 'recent' }], 'consistent')!;
  assert.equal(p.interval, 300); // 5:00/km
  assert.equal(p.tempo, 321);
  assert.deepEqual(p.easy, [366, 414]); // 6:06–6:54/km
  assert.ok(Math.abs(predictTime(1500, '10k') - 3127) < 2);
  assert.equal(suggestedGoalTime([{ distance: '5k', timeSec: 1500, recency: 'recent' }], 'consistent', '5k_faster'), 1455);
});

function profile(extra = {}) {
  return { ...defaultProfile({ level: 'consistent', frequency: null, goal: '5k_faster', issues: [], includeQuality: false, pbs: [{ distance: '5k', timeSec: 1500, recency: 'recent' }] }, TODAY), ...extra };
}

test('"get faster" goals add one tempo/interval session at PB paces', () => {
  const p = profile();
  assert.equal(generateWeek(p, 0, TODAY, 12, 'hold').sessions.filter((s) => s.workout).length, 0, 'week 1 stays easy');
  const q1 = generateWeek(p, 1, TODAY, 12, 'hold').sessions.filter((s) => s.workout);
  const q2 = generateWeek(p, 2, TODAY, 12, 'hold').sessions.filter((s) => s.workout);
  assert.equal(q1.length, 1);
  assert.equal(q1[0].runType, 'tempo');
  assert.equal(q1[0].targetPaceSecPerKm, 321);
  assert.equal(q2[0].runType, 'intervals');
  assert.equal(q2[0].targetPaceSecPerKm, 300);
  // No quality work in ease or recovery weeks.
  assert.equal(generateWeek(p, 4, TODAY, 12, 'ease').sessions.filter((s) => s.workout).length, 0);
  assert.equal(generateWeek(p, 3, TODAY, 12, 'recovery').sessions.filter((s) => s.workout).length, 0);
  // Without PBs the session is by feel.
  assert.equal(generateWeek(profile({ pbs: [] }), 1, TODAY, 12, 'hold').sessions.find((s) => s.workout)?.targetPaceSecPerKm, undefined);
  // Beginners never get them.
  assert.equal(generateWeek(profile({ level: 'new' }), 1, TODAY, 12, 'hold').sessions.filter((s) => s.workout).length, 0);
});

test('easing a workout turns it into an easy run', () => {
  const q = generateWeek(profile(), 1, TODAY, 12, 'hold').sessions.find((s) => s.workout)!;
  const e = easeSession(q);
  assert.equal(e.runType, 'easy');
  assert.equal(e.workout, undefined);
});

test('workout cues mention effort and the PB target pace', () => {
  const q = generateWeek(profile(), 1, TODAY, 12, 'hold').sessions.find((s) => s.workout)!;
  const cues = buildCues(q, 'consistent', '5 minutes 21 seconds per kilometer');
  assert.match(cues[1].text, /Comfortably hard/);
  assert.match(cues[1].text, /5 minutes 21/);
  assert.equal(cues[cues.length - 1].kind, 'end');
});

test('a recent long-race PB starts seasoned runners a step higher; more goals have caps', () => {
  assert.equal(startingStep('experienced', null, [{ distance: 'half', timeSec: 6000, recency: 'recent' }]), 14);
  assert.equal(startingStep('experienced', null, [{ distance: 'half', timeSec: 6000, recency: 'older' }]), 13);
  const marathon = createPlan(profile({ level: 'experienced', goal: 'marathon' }), TODAY);
  assert.ok(marathon.weeks[0].sessions.length > 0);
});
