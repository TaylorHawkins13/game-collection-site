/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base64ToBytes, parseHeartRate, summarizeSamples } from '../hr.ts';
import { liveStatus } from '../liveStatus.ts';
import { createTracker, addFix } from '../gps.ts';
import { toGpx } from '../gpx.ts';
import { fitnessFromHistory, historySummary, levelHint, mergeImports } from '../history.ts';
import { createInitialState, importHistory, onboard } from '../engine.ts';
import { addDays } from '../dates.ts';
import { currentFiveK } from '../fitness.ts';
import { createPlan } from '../plan.ts';
import { defaultProfile } from '../engine.ts';
import type { ImportedRun } from '../types.ts';

test('heart-rate measurement parsing (uint8, uint16, junk)', () => {
  assert.equal(parseHeartRate(Uint8Array.from([0x00, 142])), 142);
  assert.equal(parseHeartRate(Uint8Array.from([0x01, 0x2c, 0x00])), 44);
  assert.equal(parseHeartRate(Uint8Array.from([0x16, 75, 0x10, 0x03])), 75); // contact + RR flags
  assert.equal(parseHeartRate(Uint8Array.from([0x00, 5])), null);
  assert.equal(parseHeartRate(Uint8Array.from([0x00])), null);
  assert.deepEqual([...base64ToBytes('AI4=')], [0x00, 142]);
});

test('HR summary is time-weighted and caps dropouts', () => {
  const s = summarizeSamples([{ t: 0, bpm: 120 }, { t: 5000, bpm: 140 }, { t: 10000, bpm: 160 }, { t: 600000, bpm: 150 }]);
  assert.equal(s!.max, 160);
  assert.ok(s!.avg > 135 && s!.avg < 150, `avg ${s!.avg}`);
  assert.equal(summarizeSamples([]), null);
});

test('live status: walk-run countdown, continuous progress, paused', () => {
  const p = defaultProfile({ level: 'new', frequency: 0, goal: 'habit', issues: [], includeQuality: false }, '2026-01-05');
  const session = createPlan(p, '2026-01-05').weeks[0].sessions[0];
  let t = createTracker(0, 'km');
  t = addFix(t, { lat: 51.5, lng: -0.1, t: 0, accuracy: 5 });
  const s = liveStatus(t, session, 185_000, 'km', 132);
  assert.match(s.subtitle, /^Run 1\/6/);
  assert.match(s.subtitle, /♥ 132/);
  assert.equal(s.phaseEndsAt, 185_000 + 25_000);
  const easy = { ...session, walkRun: undefined, durationMin: 20, title: 'Easy run · 20 min' };
  assert.equal(liveStatus(t, easy, 600_000, 'km', null).progress, 0.5);
  const paused = liveStatus({ ...t, paused: true, segments: [{ start: 0, end: 60_000 }] }, easy, 600_000, 'km', null);
  assert.match(paused.title, /^Paused · 1:00/);
});

test('GPX output is well-formed and escaped', () => {
  const a = { id: 'a', date: '2026-01-05', startedAt: Date.UTC(2026, 0, 5, 8), endedAt: 0, kind: 'run' as const, title: 'Tom & Jerry <run>', durationSec: 60, xpEarned: 0, completion: 1 };
  const g = toGpx(a, [{ lat: 51.5, lng: -0.1, t: a.startedAt, alt: 12.34 }, { lat: 51.5001, lng: -0.1, t: a.startedAt + 1000 }]);
  assert.match(g, /<name>Tom &amp; Jerry &lt;run&gt;<\/name>/);
  assert.equal((g.match(/<trkpt /g) ?? []).length, 2);
  assert.match(g, /<ele>12.3<\/ele>/);
  assert.match(g, /<time>2026-01-05T08:00:00.000Z<\/time>/);
});

const TODAY = '2026-03-01';
function hist(n: number, paceSec = 330, km = 6): ImportedRun[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(TODAY, -i * 3 - 1);
    return { id: `h${i}`, source: 'apple_health', externalId: `x${i}`, date, startedAt: Date.parse(date) + 8 * 3600e3, durationSec: km * paceSec, distanceM: km * 1000, title: 'Running' };
  });
}

test('imports dedupe by id, by overlap with recorded runs, and skip tiny entries', () => {
  const s = onboard(createInitialState(TODAY), { level: 'consistent', frequency: null, goal: 'habit', issues: [], includeQuality: false }, TODAY);
  const runs = hist(5);
  const withRecorded = { ...s, activities: [{ id: 'mine', date: runs[0].date, startedAt: runs[0].startedAt + 60_000, endedAt: 0, kind: 'run' as const, title: 'x', durationSec: 1800, xpEarned: 50, completion: 1 }] };
  const m = mergeImports(withRecorded, [...runs, { ...runs[1] }, { ...runs[2], externalId: 'short', startedAt: 1, durationSec: 60 }]);
  assert.equal(m.added, 4, 'one overlaps a Steady run, one duplicate, one too short');
  assert.equal(mergeImports({ ...withRecorded, importedRuns: m.runs }, runs).added, 0);
});

test('history sets fitness when there is none, never awards XP, and hints at level', () => {
  let s = onboard(createInitialState(TODAY), { level: 'consistent', frequency: null, goal: 'habit', issues: [], includeQuality: false }, TODAY);
  assert.equal(currentFiveK(s), null);
  const r = importHistory(s, hist(10, 330, 6), TODAY);
  s = r.state;
  assert.equal(r.added, 10);
  assert.ok(currentFiveK(s)! > 1500 && currentFiveK(s)! < 1700, `history 5K ${currentFiveK(s)}`);
  assert.equal(s.rank.seasonXp, 0, 'no XP from imports');
  assert.equal(Object.keys(s.badges).length, 0, 'no badges from imports');
  assert.ok(r.events.some((e) => e.type === 'history_imported' && e.count === 10));
  assert.equal(fitnessFromHistory(hist(1), TODAY), null, 'needs at least 2 runs');
  assert.match(levelHint(historySummary(hist(20), TODAY), 'new')!, /Returning/);
  // New runners: imports never set paces.
  const n = importHistory(onboard(createInitialState(TODAY), { level: 'new', frequency: 0, goal: 'habit', issues: [], includeQuality: false }, TODAY), hist(10), TODAY).state;
  assert.equal(currentFiveK(n), null);
});
