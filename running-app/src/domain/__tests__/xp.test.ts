/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lengthBase, runXp } from '../xp.ts';
import { completeSession, createInitialState, onboard, submitFeedback, todaySessions } from '../engine.ts';
import { addDays } from '../dates.ts';

const noBase = { avgDurationSec: null, avgPaceSecPerKm: null };
const usual = { avgDurationSec: 30 * 60, avgPaceSecPerKm: 360 }; // 30 min at 6:00/km

test('base XP by length tiers', () => {
  assert.deepEqual([5, 15, 29, 30, 45, 60, 89, 90, 150].map((m) => lengthBase(m * 60).xp), [30, 40, 40, 50, 60, 75, 75, 90, 90]);
});

test('planned bonus and half XP for unplanned', () => {
  assert.equal(runXp({ durationSec: 1800, planned: true, level: 'consistent', baseline: noBase }).total, 60);
  assert.equal(runXp({ durationSec: 1800, planned: false, level: 'consistent', baseline: noBase }).total, 25);
});

test('longer and quicker than usual earn more; shorter and slower earn less (bounded)', () => {
  const avg = runXp({ durationSec: 1800, distanceM: 5000, planned: true, runType: 'tempo', level: 'consistent', baseline: usual }).total;
  const longer = runXp({ durationSec: 2700, distanceM: 7500, planned: true, runType: 'tempo', level: 'consistent', baseline: usual });
  const quicker = runXp({ durationSec: 1800, distanceM: 5500, planned: true, runType: 'tempo', level: 'consistent', baseline: usual });
  const slower = runXp({ durationSec: 1800, distanceM: 4500, planned: true, runType: 'tempo', level: 'consistent', baseline: usual });
  assert.equal(avg, 60);
  assert.ok(longer.total > 60 + 10, `longer ${longer.total}`); // bigger tier + length bonus
  assert.ok(quicker.total > avg && quicker.parts.some((p) => p.label === 'Quicker than your usual'));
  assert.ok(slower.total < avg && slower.total >= Math.round(50 * 0.8) + 10, `slower ${slower.total}`);
  // Massive outliers are capped: ±15% length, +15%/−10% pace, floor 80%.
  const huge = runXp({ durationSec: 1800, distanceM: 9000, planned: false, runType: undefined, level: 'consistent', baseline: usual });
  assert.equal(huge.total, Math.round(25 + 25 * 0.15));
  const crawl = runXp({ durationSec: 600, distanceM: 1000, planned: false, level: 'consistent', baseline: usual });
  assert.ok(crawl.total >= Math.round(15 * 0.8));
});

test('guardrails: easy runs can’t farm pace, walk-runs and new runners get no pace effect', () => {
  const easyFast = runXp({ durationSec: 1800, distanceM: 6500, planned: true, runType: 'easy', level: 'consistent', baseline: usual, easyFastPace: 340 });
  const easyAtTopOfRange = runXp({ durationSec: 1800, distanceM: 1800 / 340 * 1000, planned: true, runType: 'easy', level: 'consistent', baseline: usual, easyFastPace: 340 });
  assert.equal(easyFast.total, easyAtTopOfRange.total, 'running an easy run faster than the easy range earns nothing extra');
  // Someone whose usual pace is quicker than their easy range: a quick easy run isn't penalised.
  const quickUsual = runXp({ durationSec: 1800, distanceM: 5000, planned: true, runType: 'long', level: 'consistent', baseline: { avgDurationSec: 1800, avgPaceSecPerKm: 375 }, easyFastPace: 381 });
  assert.ok(!quickUsual.parts.some((p) => p.label === 'Slower than your usual'), JSON.stringify(quickUsual.parts));
  const walkRun = runXp({ durationSec: 1800, distanceM: 6000, planned: true, runType: 'walk_run', level: 'returning', baseline: usual });
  assert.ok(!walkRun.parts.some((p) => /Quicker|Slower/.test(p.label)));
  const newbie = runXp({ durationSec: 1800, distanceM: 6000, planned: true, runType: 'easy', level: 'new', baseline: usual });
  assert.ok(!newbie.parts.some((p) => /Quicker|Slower/.test(p.label)));
});

test('the engine compares against your own last runs and stores the breakdown', () => {
  const START = '2026-01-05';
  let s = onboard(createInitialState(START), { level: 'consistent', frequency: null, goal: 'habit', issues: [], includeQuality: false }, START);
  for (let i = 0; i < 3; i++) {
    s = completeSession(s, { kind: 'run', title: 'x', startedAt: i * 1e9, endedAt: i * 1e9 + 1, durationSec: 1800, distanceM: 5000 }, addDays(START, -i - 1)).state;
  }
  const planned = todaySessions(s, START)[0];
  const r = completeSession(s, { plannedSessionId: planned.id, kind: 'run', title: 'x', startedAt: 5e9, endedAt: 5e9 + 1, durationSec: 2700, distanceM: 7500 }, START);
  assert.ok(r.activity.xpParts!.some((p) => p.label === 'Longer than your usual'));
  assert.equal(r.activity.xpEarned, r.activity.xpParts!.reduce((a, p) => a + p.amount, 0));
  const f = submitFeedback(r.state, r.activity.id, 'easy', 'none', START).state.activities.find((x) => x.id === r.activity.id)!;
  assert.equal(f.xpEarned, f.xpParts!.reduce((a, p) => a + p.amount, 0), 'breakdown still adds up after the check-in');
});

test('planned runs are scored mostly against their target', () => {
  const target = { durationSec: 1800, paceRange: [366, 414] as [number, number] };
  const common = { planned: true, runType: 'easy' as const, level: 'consistent' as const, baseline: usual, target };
  const onTarget = runXp({ ...common, durationSec: 1800, distanceM: 1800 / 390 * 1000 });
  // 50 base + 50×10%×0.7 (length) + 50×10%×0.7 (easy pace) + 10 planned
  assert.equal(onTarget.total, 50 + 4 + 4 + 10);
  assert.ok(onTarget.parts.some((p) => p.label === 'Hit the target length'));
  assert.ok(onTarget.parts.some((p) => p.label === 'Easy pace, as planned'));
  // Doubling the planned run doesn't jump a tier: base still comes from the plan.
  const doubled = runXp({ ...common, durationSec: 3600, distanceM: 3600 / 390 * 1000 });
  assert.ok(doubled.total <= onTarget.total + 5, `doubled ${doubled.total} vs ${onTarget.total}`);
  // Rushing an easy run: no pace bonus (and it says so).
  const rushed = runXp({ ...common, durationSec: 1800, distanceM: 1800 / 320 * 1000 });
  assert.ok(rushed.total < onTarget.total);
  assert.ok(rushed.parts.some((p) => p.label.startsWith('Quicker than easy')));
  // Cut short: scales down, floor 50%.
  const half = runXp({ ...common, durationSec: 900, distanceM: 900 / 390 * 1000 });
  assert.ok(half.total < onTarget.total - 10 && half.total >= 25 + 10);
});

test('races reward hitting the target pace', () => {
  const t = { durationSec: 1500, paceTarget: 300 };
  const c = { planned: true, runType: 'race' as const, level: 'consistent' as const, baseline: noBase, target: t };
  const hit = runXp({ ...c, durationSec: 1490, distanceM: 5000 });
  const missed = runXp({ ...c, durationSec: 1650, distanceM: 5000 });
  assert.ok(hit.parts.some((p) => p.label === 'Hit your target pace'));
  assert.ok(missed.parts.some((p) => p.label === 'Off your target pace'));
  assert.ok(hit.total > missed.total);
});
