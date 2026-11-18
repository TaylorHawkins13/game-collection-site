/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageRepPace, currentRepPace, repCue, repStats, repVerdict, repWindows } from '../reps.ts';
import { addFix, createTracker, pauseTracker, resumeTracker } from '../gps.ts';
import { runXp } from '../xp.ts';

const M = 1 / 111_195;
const w = { warmupMin: 1, runSec: 60, walkSec: 60, repeats: 3, cooldownMin: 1 };

/** Simulate a workout: 2.5 m/s easy, 4 m/s during reps (= 4:10/km). */
function simulate(pauseAt?: number) {
  let t = createTracker(0, 'km');
  let pos = 0;
  for (let s = 0; s <= 60 + 3 * 120 + 60; s++) {
    if (pauseAt !== undefined && s === pauseAt) t = pauseTracker(t, s * 1000);
    if (pauseAt !== undefined && s === pauseAt + 30) t = resumeTracker(t, s * 1000);
    if (pauseAt !== undefined && s >= pauseAt && s < pauseAt + 30) continue;
    const moving = pauseAt !== undefined && s >= pauseAt + 30 ? s - 30 : s;
    const inRep = repWindows(w).some(([a, b]) => moving > a && moving <= b);
    pos += inRep ? 4 : 2.5;
    t = addFix(t, { lat: 51.5 + pos * M, lng: -0.1, t: s * 1000, accuracy: 5 });
  }
  return t;
}

test('rep windows follow the structure', () => {
  assert.deepEqual(repWindows(w), [[60, 120], [180, 240], [300, 360]]);
});

test('per-rep distance and pace come only from inside each rep', () => {
  const t = simulate();
  const reps = repStats(t, w, 480);
  assert.equal(reps.length, 3);
  for (const r of reps) {
    assert.ok(Math.abs(r.distanceM - 240) < 12, `rep ${r.index} ${r.distanceM} m`);
    assert.ok(Math.abs(r.paceSecPerKm! - 250) < 12, `rep pace ${r.paceSecPerKm}`);
  }
  assert.ok(Math.abs(averageRepPace(reps)! - 250) < 10);
  assert.equal(repStats(t, w, 150).length, 1, 'only finished reps');
  assert.ok(Math.abs(currentRepPace(t, w, 210)! - 250) < 20);
});

test('a pause mid-workout does not distort rep timing', () => {
  const t = simulate(150); // pause during the first recovery
  const reps = repStats(t, w, 480);
  for (const r of reps) assert.ok(Math.abs(r.paceSecPerKm! - 250) < 15, `rep ${r.index} ${r.paceSecPerKm}`);
});

test('verdicts and cues', () => {
  assert.equal(repVerdict(250, 250), 'on_target');
  assert.equal(repVerdict(235, 250), 'quick');
  assert.equal(repVerdict(270, 250), 'slow');
  const say = (s: number) => `${Math.floor(s / 60)} ${s % 60}`;
  assert.match(repCue({ index: 2, durationSec: 60, distanceM: 240, paceSecPerKm: 250 }, 250, say), /Rep 2: 4 10\. Right on target/);
  assert.match(repCue({ index: 2, durationSec: 60, distanceM: 0, paceSecPerKm: null }, 250, say), /Rep 2 done/);
});

test('workout XP uses average rep pace against the target', () => {
  const target = { durationSec: 1800, repPaceTarget: 300 };
  const c = { planned: true, runType: 'intervals' as const, level: 'consistent' as const, baseline: { avgDurationSec: null, avgPaceSecPerKm: null } };
  const hit = runXp({ ...c, durationSec: 1800, distanceM: 5000, target: { ...target, repPace: 298 } });
  const slow = runXp({ ...c, durationSec: 1800, distanceM: 5000, target: { ...target, repPace: 340 } });
  assert.ok(hit.parts.some((p) => p.label === 'Reps on target pace'), JSON.stringify(hit.parts));
  assert.ok(slow.parts.some((p) => p.label === 'Reps slower than target'));
  assert.ok(hit.total > slow.total);
});
