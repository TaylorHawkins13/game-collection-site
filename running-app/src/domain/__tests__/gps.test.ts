/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addFix, createTracker, currentPace, finalSplits, haversine, movingMs, pauseTracker, resumeTracker, trimRouteEnds } from '../gps.ts';

// ~1 m of latitude in degrees
const M = 1 / 111_195;

function line(t0: number, metersPerSec: number, seconds: number, startM = 0) {
  return Array.from({ length: seconds + 1 }, (_, i) => ({ lat: 51.5 + (startM + i * metersPerSec) * M, lng: -0.1, t: t0 + i * 1000, accuracy: 5 }));
}

test('haversine ≈ meters', () => {
  const d = haversine({ lat: 51.5, lng: -0.1 }, { lat: 51.5 + 1000 * M, lng: -0.1 });
  assert.ok(Math.abs(d - 1000) < 1);
});

test('accumulates distance and per-km splits from moving time', () => {
  let t = createTracker(0, 'km');
  for (const f of line(0, 3, 700)) t = addFix(t, f); // 2.1 km at 3 m/s
  assert.ok(Math.abs(t.distanceM - 2100) < 3);
  assert.equal(t.splits.length, 2);
  assert.ok(Math.abs(t.splits[0].durationSec - 333) <= 1);
  const splits = finalSplits(t, 700_000);
  assert.equal(splits.length, 3);
  assert.ok(splits[2].distanceM > 90 && splits[2].distanceM < 110);
  const pace = currentPace(t, 700_000)!;
  assert.ok(Math.abs(pace - 333.3) < 2);
});

test('rejects inaccurate fixes and GPS jumps', () => {
  let t = createTracker(0, 'km');
  t = addFix(t, { lat: 51.5, lng: -0.1, t: 0, accuracy: 5 });
  t = addFix(t, { lat: 51.5 + 500 * M, lng: -0.1, t: 1000, accuracy: 5 }); // 500 m/s
  t = addFix(t, { lat: 51.5 + 10 * M, lng: -0.1, t: 2000, accuracy: 80 }); // poor accuracy
  assert.equal(t.distanceM, 0);
  t = addFix(t, { lat: 51.5 + 6 * M, lng: -0.1, t: 3000, accuracy: 5 });
  assert.ok(t.distanceM > 5);
});

test('pause excludes time and distance; resume does not bridge the gap', () => {
  let t = createTracker(0, 'km');
  for (const f of line(0, 3, 100)) t = addFix(t, f);
  t = pauseTracker(t, 100_000);
  for (const f of line(100_000, 3, 50, 300)) t = addFix(t, f); // ignored while paused
  t = resumeTracker(t, 200_000);
  for (const f of line(200_000, 3, 100, 1000)) t = addFix(t, f); // jumped 700 m while paused
  assert.ok(Math.abs(t.distanceM - 600) < 3);
  assert.equal(movingMs(t, 300_000), 200_000);
});

test('treadmill mode ignores GPS', () => {
  let t = createTracker(0, 'km', true);
  for (const f of line(0, 3, 50)) t = addFix(t, f);
  assert.equal(t.distanceM, 0);
});

test('privacy trim removes route ends', () => {
  const route = line(0, 5, 400).map(({ lat, lng, t }) => ({ lat, lng, t })); // 2 km
  const trimmed = trimRouteEnds(route, 200);
  const first = haversine(route[0], trimmed[0]);
  const last = haversine(route[route.length - 1], trimmed[trimmed.length - 1]);
  assert.ok(first >= 195 && last >= 195);
  assert.deepEqual(trimRouteEnds(route.slice(0, 60), 200), []); // short route: hide entirely
});
